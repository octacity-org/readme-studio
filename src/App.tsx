import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { createEffect, createMemo, createSignal, onSettled, Show } from 'solid-js';
import './App.css';
import { GitHubModal, type GitHubModalTab } from './components/GitHubModal';
import { ProfileInspector } from './components/ProfileInspector';
import { VisualEditor, type VisualEditorHandle } from './components/VisualEditor';
import { FloatingWidget } from './components/FloatingWidget';
import { ToolIcon } from './components/ToolIcon';
import { TOOL_DRAG_TYPE, type WidgetPosition } from './lib/workspace-widgets';
import { getGameDataUri } from './lib/arcade-preview';
import { fetchRealGitHubContributions, getCachedContributions } from './lib/contributions';
import {
  clearStoredSession,
  getStoredSession,
  handleOAuthCallback,
  SESSION_CLEARED_EVENT,
  startGitHubLogin,
  type GitHubSessionData,
} from './lib/github';
import {
  PROFILE_TOOL_CATALOG,
  getRequiredProfileFiles,
  type ArcadeGame,
  type ProfileToolId,
} from './lib/profile';
import {
  buildBadgeMarkdown,
  buildBadgeUrl,
  buildShieldPresetMarkdown,
  buildShieldPresetUrl,
  DEFAULT_SHIELD_BADGE_INPUTS,
  generateProjectTree,
  generateTableOfContents,
  insertText,
  SHIELD_BADGE_PRESETS,
  type BadgeOptions,
  type ShieldBadgeInputKey,
  type ShieldBadgeInputs,
  type ShieldBadgePresetId,
} from './lib/readme';

const STORAGE_KEY = 'readme-studio:draft';
const STARTER_README = `# Acme project

> A short, useful description of what this project does and who it is for.

## Features

- Fast to set up
- Pleasant to use
- Built for the web

## Getting started

\`\`\`bash
bun install
bun run dev
\`\`\`

## License

MIT
`;

type PanelMode = 'editor' | 'preview';
type EditorStyle = 'visual' | 'plain';
type InsertTool = 'heading' | 'link' | 'image' | 'code' | 'table' | 'details' | 'centered';
type ToolPanel = InsertTool | ProfileToolId | 'badge' | 'toc' | 'tree';
type InspectorTab = 'tool' | 'document' | 'checks' | 'export';

const insertHelpers = [
  { id: 'heading', label: 'Heading', hint: 'H2', description: 'Start a clear README section.', before: '## ', after: '', placeholder: 'Section title' },
  { id: 'link', label: 'Link', hint: '↗', description: 'Add linked text with a URL.', before: '[', after: '](https://example.com)', placeholder: 'link text' },
  { id: 'image', label: 'Image / GIF', hint: '▧', description: 'Insert an accessible image or animation.', before: '![', after: '](https://example.com/image.png)', placeholder: 'alt text' },
  { id: 'code', label: 'Code block', hint: '</>', description: 'Add a fenced TypeScript example.', before: '\n```ts\n', after: '\n```\n', placeholder: '// your code' },
  { id: 'table', label: 'Table', hint: '⌗', description: 'Create a two-column GFM table.', before: '\n| Column | Column |\n| :-- | :-- |\n| Value | Value |\n', after: '', placeholder: '' },
  { id: 'details', label: 'Details', hint: '⌄', description: 'Hide optional content in a disclosure.', before: '\n<details>\n<summary>More details</summary>\n\n', after: '\n</details>\n', placeholder: 'Hidden content' },
  { id: 'centered', label: 'Centered block', hint: '↔', description: 'Center badges, logos, or short copy.', before: '\n<div align="center">\n\n', after: '\n\n</div>\n', placeholder: 'Centered content' },
] as const;

const profileToolIds = new Set<ProfileToolId>(PROFILE_TOOL_CATALOG.map(({ id }) => id));

function isProfileTool(tool: ToolPanel): tool is ProfileToolId {
  return profileToolIds.has(tool as ProfileToolId);
}

const shieldFieldMeta: Record<ShieldBadgeInputKey, { readonly label: string; readonly placeholder: string }> = {
  repository: { label: 'GitHub repository', placeholder: 'owner/repository' },
  workflow: { label: 'Workflow file', placeholder: 'ci.yml' },
  branch: { label: 'Branch (optional)', placeholder: 'main' },
  packageName: { label: 'npm package', placeholder: '@scope/package' },
  discordServerId: { label: 'Discord server ID', placeholder: '308323056592486420' },
  docsProject: { label: 'Read the Docs project', placeholder: 'project-slug' },
};

function preparePreviewMarkdown(raw: string, _refreshTrigger?: number): string {
  let content = raw;

  // Replace snake raw GitHub URLs with simulated animated SVG Data URI in preview
  content = content.replace(
    /https:\/\/raw\.githubusercontent\.com\/([^/]+)\/[^/]+\/output\/snake(-dark)?\.svg/g,
    (_, user, dark) => {
      const matrix = getCachedContributions(user) ?? undefined;
      return getGameDataUri('snake', { username: user, theme: dark ? 'dark' : 'light', matrix });
    },
  );

  // Replace arcade game raw GitHub URLs with simulated animated SVG Data URI in preview
  content = content.replace(
    /https:\/\/raw\.githubusercontent\.com\/([^/]+)\/[^/]+\/output\/(pacman|breakout|galaga|puzzle-bobble|bomberman)-contribution-graph(-dark)?\.svg/g,
    (_, user, game: ArcadeGame, dark) => {
      const matrix = getCachedContributions(user) ?? undefined;
      return getGameDataUri(game, { username: user, theme: dark ? 'dark' : 'light', matrix });
    },
  );

  return content;
}

function App() {
  const initialDraft = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  const collapsePanelsInitially = typeof window !== 'undefined' && window.innerWidth <= 900;

  const [markdown, setMarkdown] = createSignal(initialDraft ?? STARTER_README);
  const [fileName, setFileName] = createSignal('README.md');
  const [panelMode, setPanelMode] = createSignal<PanelMode>('editor');
  const [editorStyle, setEditorStyle] = createSignal<EditorStyle>('visual');
  const [activeTool, setActiveTool] = createSignal<ToolPanel>('heading');
  const [inspectorTab, setInspectorTab] = createSignal<InspectorTab>('tool');
  const [toolboxCollapsed, setToolboxCollapsed] = createSignal(collapsePanelsInitially);
  const [widgetOpen, setWidgetOpen] = createSignal(false);
  const [widgetPosition, setWidgetPosition] = createSignal<WidgetPosition>({ left: 270, top: 100 });
  const [insertDraft, setInsertDraft] = createSignal('');
  const [toolDragHint, setToolDragHint] = createSignal<{ label: string; left: number; top: number } | null>(null);
  const [saved, setSaved] = createSignal(true);
  const [draggingFile, setDraggingFile] = createSignal(false);
  const [treePaths, setTreePaths] = createSignal('src/App.tsx\nsrc/lib/readme.ts\npublic/favicon.ico\nREADME.md');
  const [badge, setBadge] = createSignal<BadgeOptions>({
    label: 'build', message: 'passing', color: '2f855a', style: 'flat-square', logo: 'github', link: '',
  });
  const [selectedBadgePreset, setSelectedBadgePreset] = createSignal<ShieldBadgePresetId | null>('build');
  const [shieldInputs, setShieldInputs] = createSignal<ShieldBadgeInputs>(DEFAULT_SHIELD_BADGE_INPUTS);

  // GitHub connection & modal state
  const [session, setSession] = createSignal<GitHubSessionData | null>(getStoredSession());
  const [gitHubModalOpen, setGitHubModalOpen] = createSignal(false);
  const [gitHubModalTab, setGitHubModalTab] = createSignal<GitHubModalTab>('open');
  const [activityRefresh, setActivityRefresh] = createSignal(0);

  let editor: HTMLTextAreaElement | undefined;
  let toolPointerDrag: { tool: ToolPanel; x: number; y: number; moved: boolean } | undefined;
  let suppressToolClickUntil = 0;
  let visualEditor: VisualEditorHandle | undefined;
  let fileInput!: HTMLInputElement;

  marked.setOptions({ gfm: true, breaks: false });

  // Fetch real contribution activity when session is active
  createEffect(session, (currentSession) => {
    const user = currentSession?.user.login;
    if (user) {
      fetchRealGitHubContributions(user, currentSession.token)
        .then(() => setActivityRefresh((v) => v + 1))
        .catch(() => {});
    }
  });

  createEffect(session, (currentSession) => {
    if (typeof window === 'undefined' || !currentSession) return;
    const expiresIn = Date.parse(currentSession.expiresAt) - Date.now();
    if (expiresIn <= 0) {
      clearStoredSession();
      return;
    }
    const timer = window.setTimeout(() => clearStoredSession(), Math.min(expiresIn, 2_147_483_647));
    return () => window.clearTimeout(timer);
  });

  // Client-side initialization
  if (typeof window !== 'undefined') {
    handleOAuthCallback()
      .then((newSession) => {
        if (newSession) {
          setSession(newSession);
          setGitHubModalTab('open');
          setGitHubModalOpen(true);
        }
      })
      .catch((error) => console.error('OAuth callback error:', error));


  }

  onSettled(() => {
    if (typeof window === 'undefined') return;
    const handleSessionCleared = () => {
      setSession(null);
      setGitHubModalOpen(false);
    };
    window.addEventListener(SESSION_CLEARED_EVENT, handleSessionCleared);
    return () => window.removeEventListener(SESSION_CLEARED_EVENT, handleSessionCleared);
  });

  // Auto-save effect
  createEffect(markdown, (value) => {
    if (typeof window === 'undefined') return;

    setSaved(false);
    const timer = window.setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, value);
      setSaved(true);
    }, 450);

    return () => window.clearTimeout(timer);
  });

  const renderedMarkdown = createMemo(() => {
    const previewContent = preparePreviewMarkdown(markdown(), activityRefresh());
    const html = marked.parse(previewContent, { async: false });
    return DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      ADD_DATA_URI_TAGS: ['img', 'source'],
    });
  });

  const stats = createMemo(() => {
    const content = markdown();
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    return { words, characters: content.length, lines: content.split('\n').length };
  });

  const activeInsertTool = createMemo(() => insertHelpers.find((tool) => tool.id === activeTool()));
  const activeToolTitle = createMemo(() => activeInsertTool()?.label
    ?? PROFILE_TOOL_CATALOG.find(({ id }) => id === activeTool())?.label
    ?? ({ badge: 'Shields.io badge', toc: 'Table of contents', tree: 'Project tree' } as const)[activeTool() as 'badge' | 'toc' | 'tree']);
  const selectedShieldPreset = createMemo(() => SHIELD_BADGE_PRESETS.find(({ id }) => id === selectedBadgePreset()));
  const generatedBadgeUrl = createMemo(() => {
    const preset = selectedShieldPreset();
    return preset?.kind === 'dynamic'
      ? buildShieldPresetUrl(preset.id, shieldInputs(), badge().style)
      : buildBadgeUrl(badge());
  });
  const generatedBadgeMarkdown = createMemo(() => {
    const preset = selectedShieldPreset();
    return preset?.kind === 'dynamic'
      ? buildShieldPresetMarkdown(preset.id, shieldInputs(), badge().style, badge().link)
      : buildBadgeMarkdown(badge());
  });
  const requiredProfileFiles = createMemo(() => getRequiredProfileFiles(markdown()));

  const outline = createMemo(() => markdown().split('\n').flatMap((line) => {
    const match = /^(#{1,6})\s+(.+)$/.exec(line.trim());
    return match ? [{ depth: match[1].length, label: match[2].replace(/[*_`]/g, '') }] : [];
  }));

  const documentChecks = createMemo(() => {
    const headings = outline().map((heading) => heading.label.toLowerCase());
    const duplicateHeadings = headings.filter((heading, index) => headings.indexOf(heading) !== index).length;
    const missingAltText = (markdown().match(/!\[\s*\]\(/g) ?? []).length;
    return [
      { label: 'Document title', passed: outline().some((heading) => heading.depth === 1), detail: 'Include one H1 project title.' },
      { label: 'Image alt text', passed: missingAltText === 0, detail: missingAltText ? `${missingAltText} image${missingAltText === 1 ? '' : 's'} need alt text.` : 'Every Markdown image has alt text.' },
      { label: 'Unique headings', passed: duplicateHeadings === 0, detail: duplicateHeadings ? `${duplicateHeadings} duplicate heading${duplicateHeadings === 1 ? '' : 's'} found.` : 'No duplicate headings found.' },
    ];
  });

  function selectTool(tool: ToolPanel, event?: MouseEvent | DragEvent | PointerEvent): void {
    if (event?.type === 'click' && performance.now() < suppressToolClickUntil) return;
    setActiveTool(tool);
    const helper = insertHelpers.find(({ id }) => id === tool);
    if (helper) setInsertDraft(`${helper.before}${helper.placeholder}${helper.after}`);
    setInspectorTab('tool');
    setWidgetPosition({ left: event ? event.clientX + 20 : 270, top: event ? event.clientY + 12 : 100 });
    setWidgetOpen(true);
    if (window.innerWidth <= 900) setToolboxCollapsed(true);
  }

  function openDocumentWidget(tab: Exclude<InspectorTab, 'tool'>): void {
    setInspectorTab(tab);
    setWidgetPosition({ left: window.innerWidth - 370, top: 90 });
    setWidgetOpen(true);
    if (window.innerWidth <= 900) setToolboxCollapsed(true);
  }

  function dragTool(event: DragEvent, tool: ToolPanel): void {
    event.dataTransfer?.setData(TOOL_DRAG_TYPE, tool);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
    setWidgetOpen(false);
  }

  function dropTool(id: string, event: DragEvent | PointerEvent): void {
    const helper = insertHelpers.find((tool) => tool.id === id);
    if (helper) {
      setActiveTool(helper.id);
      applyInsertion(helper.before, helper.after, helper.placeholder);
    } else if (id === 'badge' || id === 'toc' || id === 'tree' || profileToolIds.has(id as ProfileToolId)) {
      selectTool(id as ToolPanel, event);
    }
  }

  function startToolPointer(event: PointerEvent, tool: ToolPanel): void {
    if (event.button !== 0) return;
    event.preventDefault();
    toolPointerDrag = { tool, x: event.clientX, y: event.clientY, moved: false };
    event.currentTarget instanceof HTMLElement && event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveToolPointer(event: PointerEvent): void {
    if (!toolPointerDrag) return;
    if (Math.hypot(event.clientX - toolPointerDrag.x, event.clientY - toolPointerDrag.y) > 6) toolPointerDrag.moved = true;
    if (!toolPointerDrag.moved) return;
    setWidgetOpen(false);
    setToolDragHint({ label: 'Insert block', left: event.clientX + 14, top: event.clientY + 14 });
    if (panelMode() === 'editor' && editorStyle() === 'visual') visualEditor?.previewDrop(event.clientX, event.clientY);
  }

  function endToolPointer(event: PointerEvent): void {
    if (toolPointerDrag?.moved) {
      suppressToolClickUntil = performance.now() + 250;
      if (panelMode() === 'editor') {
        if (editorStyle() === 'visual') visualEditor?.dropTool(toolPointerDrag.tool, event);
        else if (editor?.isConnected) {
          const rect = editor.getBoundingClientRect();
          if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) dropTool(toolPointerDrag.tool, event);
        }
      }
    }
    cancelToolPointer();
  }

  function cancelToolPointer(): void {
    toolPointerDrag = undefined;
    setToolDragHint(null);
    visualEditor?.cancelDrop();
  }

  function updateBadge<K extends keyof BadgeOptions>(key: K, value: BadgeOptions[K], keepPreset = false): void {
    if (!keepPreset) setSelectedBadgePreset(null);
    setBadge((current) => ({ ...current, [key]: value }));
  }

  function applyBadgePreset(preset: (typeof SHIELD_BADGE_PRESETS)[number]): void {
    setBadge({ ...preset.options, link: '' });
    setSelectedBadgePreset(preset.id);
  }

  function updateShieldInput(key: ShieldBadgeInputKey, value: string): void {
    setShieldInputs((current) => ({ ...current, [key]: value }));
  }

  function insertGeneratedBadge(): void {
    const badgeMarkdown = generatedBadgeMarkdown();
    if (badgeMarkdown) applyInsertion(badgeMarkdown);
  }

  function applyInsertion(before: string, after = '', placeholder = ''): void {
    if (editorStyle() === 'plain' && editor?.isConnected) {
      const start = editor.selectionStart ?? editor.value.length;
      const end = editor.selectionEnd ?? start;
      const result = insertText(editor.value, start, end, before, after, placeholder);
      const replacement = result.value.slice(start, result.selectionEnd + after.length);
      replaceEditorRange(replacement, start, end, result.selectionStart, result.selectionEnd);
      return;
    }

    const insertion = `${before}${placeholder}${after}`;
    if (visualEditor?.insertMarkdown(insertion)) return;
    setMarkdown((current) => `${current}\n\n${insertion}\n\n`);
  }

  function replaceEditorRange(
    replacement: string,
    start: number,
    end: number,
    selectionStart: number,
    selectionEnd: number,
  ): void {
    if (editorStyle() === 'plain' && editor?.isConnected) {
      editor.focus();
      editor.setSelectionRange(start, end);

      if (!document.execCommand('insertText', false, replacement)) {
        editor.setRangeText(replacement, start, end, 'end');
      }

      setMarkdown(editor.value);
      editor.setSelectionRange(selectionStart, selectionEnd);
    } else {
      setMarkdown((current) => current.slice(0, start) + replacement + current.slice(end));
    }
  }

  function replaceEditorDocument(value: string): void {
    if (editor) {
      replaceEditorRange(value, 0, editor.value.length, value.length, value.length);
    } else {
      setMarkdown(value);
    }
  }

  function downloadFile(name: string, content: string, type = 'text/plain;charset=utf-8'): void {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function downloadReadme(): void {
    downloadFile('README.md', markdown(), 'text/markdown;charset=utf-8');
  }

  function insertProfileMarkdown(value: string): void {
    applyInsertion(`\n\n${value}\n\n`);
  }

  function replaceWithProfileTemplate(value: string): void {
    if (markdown().trim() && !window.confirm('Use this profile template? Your current README will be replaced.')) return;
    replaceEditorDocument(`${value.trim()}\n`);
    setFileName('README.md');
  }

  function importFile(file?: File): void {
    if (!file || (!file.name.endsWith('.md') && !file.name.endsWith('.markdown'))) return;
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') {
        replaceEditorDocument(reader.result);
        setFileName(file.name);
      }
    });
    reader.readAsText(file);
  }

  function resetReadme(): void {
    if (markdown().trim() && !window.confirm('Start a new README? Your current local draft will be replaced.')) return;
    const freshReadme = '# Project name\n\nDescribe your project here.\n';
    replaceEditorDocument(freshReadme);
    setFileName('README.md');
    if (editor) requestAnimationFrame(() => editor?.focus());
  }

  function insertToc(): void {
    const toc = generateTableOfContents(markdown());
    applyInsertion('\n## Table of contents\n\n', '\n', toc || '- Add some section headings first');
  }

  function insertTree(): void {
    applyInsertion('\n## Project structure\n\n```text\n', '\n```\n', generateProjectTree(treePaths()));
  }

  function handleKeyboard(event: KeyboardEvent): void {
    if (!(event.metaKey || event.ctrlKey)) return;
    const key = event.key.toLowerCase();
    if (key === 's') { event.preventDefault(); downloadReadme(); }
    else if (key === 'b') { event.preventDefault(); applyInsertion('**', '**', 'bold text'); }
    else if (key === 'k') { event.preventDefault(); applyInsertion('[', '](https://example.com)', 'link text'); }
  }

  function openGitHubModal(tab: GitHubModalTab = 'open'): void {
    setGitHubModalTab(tab);
    setGitHubModalOpen(true);
  }

  function handleLogoutGitHub(): void {
    clearStoredSession();
    setSession(null);
    setGitHubModalOpen(false);
  }

  function handleLoadedReadme(content: string, repoFullName: string): void {
    replaceEditorDocument(content);
    setFileName(`${repoFullName}/README.md`);
  }

  return (
    <div class="app-shell" onDragEnter={(event) => { if (event.dataTransfer?.types.includes('Files')) { event.preventDefault(); setDraggingFile(true); } }} onDragOver={(event) => { if (event.dataTransfer?.types.includes('Files')) event.preventDefault(); }} onDragLeave={(event) => { if (event.currentTarget === event.target) setDraggingFile(false); }} onDrop={(event) => { if (event.dataTransfer?.types.includes('Files')) { event.preventDefault(); setDraggingFile(false); importFile(event.dataTransfer.files[0]); } }}>
      <header class="topbar">
        <div class="brand" aria-label="Readme Studio"><span class="brand-mark">R/</span><span>Readme Studio</span></div>
        <div class="topbar-context">
          <div class="document-status"><span class="file-dot" aria-hidden="true" /><span class="file-name">{fileName()}</span><span class="metadata-separator" aria-hidden="true">·</span><span class="save-status">{saved() ? 'Saved locally' : 'Saving…'}</span></div>
          <div class="topbar-workspace-controls">
            <div class="editor-style-switcher" aria-label="Editor style">
              <button class={{ active: editorStyle() === 'visual' }} aria-label="Visual editor" onClick={() => setEditorStyle('visual')}>
                <ToolIcon tool="visual" /><span class="control-label">Visual Editor</span>
              </button>
              <button class={{ active: editorStyle() === 'plain' }} aria-label="Plain Markdown editor" onClick={() => setEditorStyle('plain')}>
                <ToolIcon tool="markdown" /><span class="control-label">Plain Markdown</span>
              </button>
            </div>
            <div class="view-switcher" aria-label="Workspace view">
              {(['editor', 'preview'] as const).map((mode) => (
                <button class={{ active: panelMode() === mode }} onClick={() => setPanelMode(mode)}>
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div class="top-actions">
          <input ref={fileInput} class="visually-hidden" type="file" accept=".md,.markdown,text/markdown" onChange={(event) => importFile(event.currentTarget.files?.[0])} />
          
          <Show when={session()} fallback={
            <button class="button github-btn" aria-label="Connect GitHub" onClick={() => startGitHubLogin()}>
              <ToolIcon tool="github" /><span class="github-label">Connect GitHub</span>
            </button>
          }>
            <button class="button github-btn connected" onClick={() => openGitHubModal('open')} title="Manage GitHub connection">
              <img class="user-avatar-small" src={session()?.user.avatar_url} alt="" />
              <span>@{session()?.user.login}</span>
            </button>
            <button class="button ghost" onClick={() => openGitHubModal('publish')}>
              Publish
            </button>
          </Show>

          <button class="button ghost" onClick={resetReadme}>New</button>
          <button class="button ghost" onClick={() => fileInput.click()}>Import</button>
          <button class="button primary" onClick={downloadReadme}>Export</button>
        </div>
      </header>

      <div class={['studio-body', { 'toolbox-collapsed': toolboxCollapsed() }]}>
        <Show when={toolboxCollapsed()}><button class="edge-toggle toolbox-expand" aria-label="Expand toolbox" aria-expanded="false" onClick={() => setToolboxCollapsed(false)}><ToolIcon tool="expand" /></button></Show>

        <aside class="toolbox-panel" aria-label="README toolbox">
          <div class="panel-heading"><p class="eyebrow">Readme kit</p><h2>Toolbox</h2><button class="toolbox-collapse" aria-label="Collapse toolbox" aria-expanded="true" onClick={() => setToolboxCollapsed(true)}><ToolIcon tool="collapse" /></button><p>Drag to insert · Click to configure.</p></div>
          <div class="tool-groups" onPointerMove={moveToolPointer} onPointerUp={endToolPointer} onPointerCancel={cancelToolPointer}>
            <section class="tool-group insert-tools">
              <h3>Insert</h3>
              <div class="tool-list">{insertHelpers.map((tool) => <button draggable="true" onPointerDown={(event) => startToolPointer(event, tool.id)} onDragStart={(event) => dragTool(event, tool.id)} class={{ active: widgetOpen() && inspectorTab() === 'tool' && activeTool() === tool.id }} onClick={(event) => selectTool(tool.id, event)}><ToolIcon tool={tool.id} /><strong>{tool.label}</strong></button>)}</div>
            </section>
            <section class="tool-group">
              <h3>Badges</h3>
              <div class="tool-list tool-list-rows"><button draggable="true" onPointerDown={(event) => startToolPointer(event, 'badge')} onDragStart={(event) => dragTool(event, 'badge')} class={{ active: widgetOpen() && inspectorTab() === 'tool' && activeTool() === 'badge' }} onClick={(event) => selectTool('badge', event)}><ToolIcon tool="badge" /><strong>Shields.io</strong></button></div>
            </section>
            <section class="tool-group profile-tools">
              <h3>Profile README</h3>
              <div class="tool-list tool-list-rows">{PROFILE_TOOL_CATALOG.map((tool) => <button draggable="true" onPointerDown={(event) => startToolPointer(event, tool.id)} onDragStart={(event) => dragTool(event, tool.id)} class={{ active: widgetOpen() && inspectorTab() === 'tool' && activeTool() === tool.id }} onClick={(event) => selectTool(tool.id, event)}><ToolIcon tool={tool.id} /><strong>{tool.label}</strong></button>)}</div>
            </section>
            <section class="tool-group">
              <h3>Utilities</h3>
              <div class="tool-list tool-list-rows">
                <button draggable="true" onPointerDown={(event) => startToolPointer(event, 'toc')} onDragStart={(event) => dragTool(event, 'toc')} onClick={(event) => selectTool('toc', event)}><ToolIcon tool="toc" /><strong>Table of contents</strong></button>
                <button draggable="true" onPointerDown={(event) => startToolPointer(event, 'tree')} onDragStart={(event) => dragTool(event, 'tree')} onClick={(event) => selectTool('tree', event)}><ToolIcon tool="tree" /><strong>Project tree</strong></button>
                <button onClick={() => openDocumentWidget('document')}><ToolIcon tool="document" /><strong>Outline & statistics</strong></button>
                <button onClick={() => openDocumentWidget('checks')}><ToolIcon tool="checks" /><strong>README checks</strong></button>
                <button onClick={() => openDocumentWidget('export')}><ToolIcon tool="export" /><strong>Export & workflows</strong></button>
              </div>
            </section>
          </div>
          <div class="shortcut-card"><span>Quick keys</span><p><kbd>⌘</kbd><kbd>B</kbd> bold · <kbd>⌘</kbd><kbd>K</kbd> link</p></div>
        </aside>

        <main class="workbench">
          <div class={['workspace', panelMode()]}>
            <section class={['editor-pane', { hidden: panelMode() === 'preview' }]}>
              <Show when={editorStyle() === 'visual'} fallback={
                <textarea
                  ref={(element) => {
                    editor = element;
                    editor.value = markdown();
                  }}
                  onInput={(event) => setMarkdown(event.currentTarget.value)}
                  onKeyDown={handleKeyboard}
                  onDragOver={(event) => {
                    if (event.dataTransfer?.types.includes(TOOL_DRAG_TYPE)) {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'copy';
                    }
                  }}
                  onDrop={(event) => {
                    const tool = event.dataTransfer?.getData(TOOL_DRAG_TYPE);
                    if (!tool) return;
                    event.preventDefault();
                    event.stopPropagation();
                    dropTool(tool, event);
                  }}
                  spellcheck={false}
                  aria-label="Markdown editor"
                />
              }>
                <VisualEditor
                  ref={(handle) => { visualEditor = handle; }}
                  markdown={() => markdown()}
                  onChange={(newMd) => {
                    setMarkdown(newMd);
                    if (editor?.isConnected) editor.value = newMd;
                  }}
                  onOpenBadgeTool={() => selectTool('badge')}
                  onToolDrop={dropTool}
                  onContextOpen={() => setWidgetOpen(false)}
                />
              </Show>
            </section>
            <section class={['preview-pane', { hidden: panelMode() === 'editor' }]}>
              <div class="preview-scroll">
                <Show when={markdown().trim()} fallback={<div class="empty-state"><span>R/</span><h2>Your README starts here</h2><p>Write Markdown in the editor or import a file to see it rendered.</p></div>}>
                  <article class="markdown-body" innerHTML={renderedMarkdown()} />
                </Show>
              </div>
            </section>
          </div>
        </main>

        <Show when={widgetOpen()}>
        <FloatingWidget title={inspectorTab() === 'tool' ? activeToolTitle() : ({ document: 'Document', checks: 'README checks', export: 'Export' } as const)[inspectorTab() as 'document' | 'checks' | 'export']} position={widgetPosition()} onClose={() => {
          setWidgetOpen(false);
          if (panelMode() === 'editor') {
            if (editorStyle() === 'visual') visualEditor?.focus();
            else editor?.focus();
          }
        }}>
          <div class="inspector-content">
            <Show when={inspectorTab() === 'tool'}>
              <div aria-label="Tool options">
                <p class="eyebrow">Selected tool</p><h2>{activeToolTitle()}</h2>
                <Show when={activeInsertTool()} fallback={
                  <>
                    <Show when={isProfileTool(activeTool())}>
                      <ProfileInspector
                        tool={activeTool() as ProfileToolId}
                        currentUser={session()?.user}
                        sessionToken={session()?.token}
                        onInsert={insertProfileMarkdown}
                        onReplace={replaceWithProfileTemplate}
                      />
                    </Show>
                    <Show when={activeTool() === 'badge'}>
                      <p class="inspector-description">Build a Shields.io badge and insert generated Markdown.</p>
                      <div class="preset-heading"><span>Badge sources</span><small>{SHIELD_BADGE_PRESETS.length} badges</small></div>
                      <div class="badge-preset-grid" aria-label="Badge presets">
                        {SHIELD_BADGE_PRESETS.map((preset) => <button class={['badge-preset', { active: selectedBadgePreset() === preset.id }]} aria-label={`${preset.name} badge preset`} aria-pressed={selectedBadgePreset() === preset.id ? 'true' : 'false'} onClick={() => applyBadgePreset(preset)}><img src={buildBadgeUrl(preset.options)} alt="" /><div><span>{preset.name}</span><small class={['badge-kind', preset.kind]}>{preset.kind === 'dynamic' ? 'Live' : 'Static'}</small></div></button>)}
                      </div>
                      <Show when={selectedShieldPreset()}>{(preset) => <p class="selected-preset-description"><strong>{preset().name}</strong>{preset().description}</p>}</Show>
                      <Show when={selectedShieldPreset()?.kind === 'dynamic'}>
                        <div class="badge-source-fields" aria-label="Badge source fields">
                          {selectedShieldPreset()?.fields.map((field) => <label>{shieldFieldMeta[field].label}<input value={shieldInputs()[field]} placeholder={shieldFieldMeta[field].placeholder} onInput={(event) => updateShieldInput(field, event.currentTarget.value)} /></label>)}
                        </div>
                      </Show>
                      <div class="badge-preview"><Show when={generatedBadgeUrl()} fallback={<div class="badge-preview-empty"><span>LIVE</span><p>Enter the source details to preview this badge.</p></div>}>{(url) => <img src={url()} alt="Generated badge preview" />}</Show></div>
                      <Show when={selectedShieldPreset()?.kind !== 'dynamic'}>
                        <label>Label<input value={badge().label} onInput={(event) => updateBadge('label', event.currentTarget.value)} /></label>
                        <label>Message<input value={badge().message} onInput={(event) => updateBadge('message', event.currentTarget.value)} /></label>
                        <label>Color<input value={badge().color} onInput={(event) => updateBadge('color', event.currentTarget.value)} /></label>
                        <label>Logo<input value={badge().logo} placeholder="github" onInput={(event) => updateBadge('logo', event.currentTarget.value)} /></label>
                      </Show>
                      <label>Style<select value={badge().style} onChange={(event) => updateBadge('style', event.currentTarget.value, selectedShieldPreset()?.kind === 'dynamic')}><option value="flat">Flat</option><option value="flat-square">Square</option><option value="for-the-badge">For the badge</option><option value="plastic">Plastic</option></select></label>
                      <label>Link (optional)<input value={badge().link} placeholder="https://…" onInput={(event) => updateBadge('link', event.currentTarget.value, selectedShieldPreset()?.kind === 'dynamic')} /></label>
                      <button class="wide-action" disabled={!generatedBadgeMarkdown()} onClick={insertGeneratedBadge}>Insert badge</button>
                    </Show>
                    <Show when={activeTool() === 'toc'}>
                      <p class="inspector-description">Generate linked navigation from the document’s H2–H6 headings.</p>
                      <pre class="snippet-preview">{generateTableOfContents(markdown()) || 'Add section headings to generate a TOC.'}</pre>
                      <button class="wide-action" onClick={insertToc}>Generate & insert</button>
                    </Show>
                    <Show when={activeTool() === 'tree'}>
                      <p class="inspector-description">Paste one project path per line.</p>
                      <label>Project paths<textarea class="path-editor" value={treePaths()} onInput={(event) => setTreePaths(event.currentTarget.value)} aria-label="Project file paths" /></label>
                      <button class="wide-action" onClick={insertTree}>Generate & insert</button>
                    </Show>
                  </>
                }>
                  {(tool) => <><p class="inspector-description">{tool().description}</p><label>Markdown block<textarea class="path-editor" value={insertDraft()} onInput={(event) => setInsertDraft(event.currentTarget.value)} /></label><button class="wide-action" onClick={() => { applyInsertion(insertDraft()); setWidgetOpen(false); }}>Insert at cursor</button></>}
                </Show>
              </div>
            </Show>

            <Show when={inspectorTab() === 'document'}>
              <p class="eyebrow">Structure</p><h2>Document</h2>
              <section class="stats-card" aria-label="Editor statistics"><div><strong>{stats().words}</strong><span>Words</span></div><div><strong>{stats().lines}</strong><span>Lines</span></div><div><strong>{stats().characters}</strong><span>Chars</span></div></section>
              <div class="outline"><h3>Outline</h3><Show when={outline().length} fallback={<p>No headings yet.</p>}>{outline().map((heading) => <div style={{ '--depth': heading.depth }}><span>H{heading.depth}</span>{heading.label}</div>)}</Show></div>
            </Show>

            <Show when={inspectorTab() === 'checks'}>
              <p class="eyebrow">README health</p><h2>Checks</h2><p class="inspector-description">Fast checks for common GitHub README issues.</p>
              <div class="check-list">{documentChecks().map((check) => <div class={{ passed: check.passed }}><span aria-hidden="true">{check.passed ? '✓' : '!'}</span><p><strong>{check.label}</strong><small>{check.detail}</small></p></div>)}</div>
            </Show>

            <Show when={inspectorTab() === 'export'}>
              <p class="eyebrow">File output</p><h2>Export</h2><p class="inspector-description">Download your README and any generated automation files or publish directly to GitHub.</p>
              
              <Show when={session()} fallback={
                <button class="wide-action" onClick={() => startGitHubLogin()}>Connect GitHub to Publish</button>
              }>
                <button class="wide-action" onClick={() => openGitHubModal('publish')}>Publish directly to GitHub</button>
              </Show>

              <div class="export-file"><span aria-hidden="true">.MD</span><div><strong>{fileName()}</strong><small>{stats().lines} lines · {stats().words} words</small></div></div>
              <button class="button ghost wide-action" onClick={downloadReadme}>Download README.md</button>
              <Show when={requiredProfileFiles().length}>
                <div class="workflow-files">
                  <h3>Required workflow files</h3>
                  {requiredProfileFiles().map((file) => (
                    <button onClick={() => downloadFile(file.path.split('/').pop() ?? 'workflow.yml', file.content, 'text/yaml;charset=utf-8')}>
                      <span aria-hidden="true">YML</span>
                      <div><strong>{file.path}</strong><small>Download for GitHub Actions</small></div>
                    </button>
                  ))}
                </div>
              </Show>
              <section class="compatibility"><h3>Target environment</h3><p>Optimized for GitHub Flavored Markdown (GFM) and GitHub repository/profile displays.</p></section>
              <nav class="project-links" aria-label="Readme Studio information">
                <a href="/readme-studio/about/">About</a>
                <a href="/readme-studio/privacy/">Privacy</a>
                <a href="/readme-studio/contact/">Contact</a>
              </nav>
            </Show>
          </div>
        </FloatingWidget>
        </Show>
      </div>

      <Show when={draggingFile()}><div class="drop-overlay"><div><span aria-hidden="true">↓</span><strong>Drop your Markdown file here</strong><small>Imports .md and .markdown documents</small></div></div></Show>
      <Show when={toolDragHint()}>{(hint) => <div class="tool-drag-hint" style={{ left: `${hint().left}px`, top: `${hint().top}px` }}>{hint().label}</div>}</Show>

      {/* GitHub Integration Modal */}
      <Show when={gitHubModalOpen()}>
        <GitHubModal
          initialTab={gitHubModalTab()}
          session={session()}
          readmeContent={markdown()}
          workflowFiles={requiredProfileFiles()}
          onClose={() => setGitHubModalOpen(false)}
          onLogin={() => startGitHubLogin()}
          onLogout={handleLogoutGitHub}
          onLoadReadme={handleLoadedReadme}
        />
      </Show>
    </div>
  );
}

export default App;
