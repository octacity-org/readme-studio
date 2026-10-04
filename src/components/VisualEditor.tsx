import { createEffect, createSignal, onSettled, Show, type Accessor } from 'solid-js';
import { markdownToVisualHtml, visualHtmlToMarkdown, updateEmptyQuoteHints } from '../lib/editor-converter';
import { FloatingWidget } from './FloatingWidget';
import { EditorHistory, type EditorSelection } from '../lib/editor-history';
import { BLOCK_DRAG_TYPE, TOOL_DRAG_TYPE, insertBlocks, isSafeReadmeUrl, reorderBlocks, type WidgetPosition } from '../lib/workspace-widgets';
import { editTableCell, nextTableCell, parseTableClipboard, pasteTableCells, type TableAction, type TableCellPosition } from '../lib/table-editing';

export interface VisualEditorProps {
  readonly markdown: Accessor<string>;
  readonly onChange: (markdown: string) => void;
  readonly ref?: (handle: VisualEditorHandle) => void;
  readonly onOpenBadgeTool?: () => void;
  readonly onOpenArcadeTool?: () => void;
  readonly onOpenStatsTool?: () => void;
  readonly onToolDrop?: (tool: string, event: DragEvent | PointerEvent) => void;
  readonly onContextOpen?: () => void;
}

export interface VisualEditorHandle {
  readonly insertMarkdown: (markdown: string) => boolean;
  readonly focus: () => void;
  readonly previewDrop: (x: number, y: number) => boolean;
  readonly dropTool: (tool: string, event: PointerEvent) => boolean;
  readonly cancelDrop: () => void;
}

interface SlashCommand {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly icon: string;
  readonly action: () => void;
}

interface SelectedTableCell {
  readonly cell: HTMLTableCellElement;
  readonly table: HTMLTableElement;
}

interface TableControlState {
  readonly columnCount: number;
  readonly rowCount: number;
  readonly row: number;
  readonly column: number;
  readonly isHeader: boolean;
  readonly alignment: string;
  readonly rect: { left: number; top: number; width: number; height: number };
}

type ElementKind = 'Heading' | 'Image' | 'Badge' | 'Link' | 'Code block' | 'Details' | 'Centered block';
interface ElementContext {
  readonly element: HTMLElement;
  readonly kind: ElementKind;
  readonly position: WidgetPosition;
}

export function VisualEditor(props: VisualEditorProps) {
  let editorRef: HTMLDivElement | undefined;
  let isInternalUpdate = false;
  let updateTimer: number | undefined;
  let lastSelection: Range | undefined;
  let draggedBlock: Element | undefined;
  let blockDragStart: { x: number; y: number; moved: boolean } | undefined;
  let dropBoundary = 0;
  let pendingDropAnchor: Node | null | undefined;
  const history = new EditorHistory({ html: '' });

  const [editorElement, setEditorElement] = createSignal<HTMLDivElement>();
  const [slashQuery, setSlashQuery] = createSignal('');
  const [slashOpen, setSlashOpen] = createSignal(false);
  const [slashPos, setSlashPos] = createSignal({ top: 0, left: 0 });
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [tableControls, setTableControls] = createSignal<TableControlState | null>(null);
  const [textControls, setTextControls] = createSignal(false);
  const [contextPosition, setContextPosition] = createSignal<WidgetPosition>({ left: 300, top: 110 });
  const [elementContext, setElementContext] = createSignal<ElementContext | null>(null);
  const [elementValue, setElementValue] = createSignal('');
  const [elementExtra, setElementExtra] = createSignal('');
  const [elementLink, setElementLink] = createSignal('');
  const [elementError, setElementError] = createSignal('');
  const [activeBlock, setActiveBlock] = createSignal<Element>();
  const [blockPosition, setBlockPosition] = createSignal<WidgetPosition>({ left: 0, top: 0 });
  const [dropMarker, setDropMarker] = createSignal<{ top: number; left: number; width: number } | null>(null);

  const slashCommands: SlashCommand[] = [
    {
      id: 'h1',
      title: 'Heading 1',
      description: 'Big title for project names',
      icon: 'H1',
      action: () => formatBlock('H1'),
    },
    {
      id: 'h2',
      title: 'Heading 2',
      description: 'Section heading for Features, Installation, etc.',
      icon: 'H2',
      action: () => formatBlock('H2'),
    },
    {
      id: 'h3',
      title: 'Heading 3',
      description: 'Sub-section heading',
      icon: 'H3',
      action: () => formatBlock('H3'),
    },
    {
      id: 'bullet',
      title: 'Bullet List',
      description: 'Create an unordered list',
      icon: '•',
      action: () => exec('insertUnorderedList'),
    },
    {
      id: 'number',
      title: 'Numbered List',
      description: 'Create an ordered sequence',
      icon: '1.',
      action: () => exec('insertOrderedList'),
    },
    {
      id: 'table',
      title: 'Table',
      description: 'Insert a 2x2 GitHub table',
      icon: '⌗',
      action: () => insertTable(),
    },
    {
      id: 'code',
      title: 'Code Block',
      description: 'Fenced preformatted code block',
      icon: '</>',
      action: () => insertCodeBlock(),
    },
    {
      id: 'quote',
      title: 'Quote',
      description: 'Capture a quote or highlight',
      icon: '”',
      action: () => formatBlock('BLOCKQUOTE'),
    },
    {
      id: 'divider',
      title: 'Divider',
      description: 'Horizontal divider rule',
      icon: '—',
      action: () => exec('insertHorizontalRule'),
    },
    {
      id: 'note',
      title: 'Alert Note',
      description: 'GitHub callout box',
      icon: '💡',
      action: () => insertAlert('NOTE'),
    },
  ];

  const filteredCommands = () => {
    const q = slashQuery().toLowerCase().replace(/^\//, '');
    if (!q) return slashCommands;
    return slashCommands.filter(
      (cmd) => cmd.id.includes(q) || cmd.title.toLowerCase().includes(q) || cmd.description.toLowerCase().includes(q),
    );
  };

  createEffect(() => [props.markdown(), editorElement()] as const, ([newMarkdown, element]) => {
    if (isInternalUpdate) return;
    if (element) {
      const currentMarkdown = visualHtmlToMarkdown(element.innerHTML);
      if (currentMarkdown.trim() !== newMarkdown.trim()) {
        element.innerHTML = markdownToVisualHtml(newMarkdown);
        history.reset({ html: element.innerHTML });
        closeContext();
        lastSelection = undefined;
      }
    }
  });

  props.ref?.({
    insertMarkdown,
    focus: () => { editorRef?.focus(); restoreSelection(); },
    previewDrop: updateDropBoundary,
    dropTool: (tool, event) => {
      if (!updateDropBoundary(event.clientX, event.clientY)) return false;
      placeInsertionAtDrop();
      setDropMarker(null);
      props.onToolDrop?.(tool, event);
      return true;
    },
    cancelDrop: () => setDropMarker(null),
  });

  onSettled(() => () => {
    if (updateTimer) window.clearTimeout(updateTimer);
    if (editorRef && isInternalUpdate) props.onChange(visualHtmlToMarkdown(editorRef.innerHTML));
  });

  function triggerSync(typing = false) {
    if (editorRef) updateEmptyQuoteHints(editorRef);
    if (editorRef) history.record({ html: editorRef.innerHTML, selection: selectionBookmark() }, typing);
    isInternalUpdate = true;
    if (updateTimer) window.clearTimeout(updateTimer);
    updateTimer = window.setTimeout(() => {
      if (editorRef) {
        const md = visualHtmlToMarkdown(editorRef.innerHTML);
        props.onChange(md);
      }
      isInternalUpdate = false;
    }, 150);
  }

  function captureSelection(): void {
    const selection = window.getSelection();
    if (!editorRef || !selection || selection.rangeCount === 0) {
      setTableControls(null);
      return;
    }
    const range = selection.getRangeAt(0);
    if (editorRef.contains(range.commonAncestorContainer)) {
      lastSelection = range.cloneRange();
      const selected = findTableCell(range);
      const rect = range.getBoundingClientRect();
      if (selected && !tableControls()) {
        const tableRect = selected.table.getBoundingClientRect();
        const cellRect = selected.cell.getBoundingClientRect();
        setContextPosition({
          left: tableRect.right + 332 < window.innerWidth ? tableRect.right + 12 : cellRect.left,
          top: tableRect.right + 332 < window.innerWidth ? cellRect.top : cellRect.bottom + 10,
        });
      } else if (!selected) setContextPosition({ left: rect.left, top: rect.bottom + 10 });
      setTextControls(!range.collapsed && !selected);
      setTableControls(selected ? {
        columnCount: selected.cell.parentElement?.children.length ?? 0,
        rowCount: selected.table.rows.length,
        row: selected.cell.closest('tr')?.rowIndex ?? 0,
        column: selected.cell.cellIndex,
        isHeader: selected.cell.closest('tr')?.rowIndex === 0,
        alignment: selected.table.rows[0]?.cells[selected.cell.cellIndex]?.getAttribute('align') || 'left',
        rect: selected.cell.getBoundingClientRect(),
      } : null);
    }
  }

  function selectionBookmark(): EditorSelection | null {
    const selection = window.getSelection();
    if (!editorRef || !selection?.rangeCount) return null;
    const range = selection.getRangeAt(0);
    if (!editorRef.contains(range.commonAncestorContainer)) return null;
    function path(node: Node): number[] {
      const result: number[] = [];
      while (node !== editorRef && node.parentNode) {
        result.unshift(Array.from(node.parentNode.childNodes).indexOf(node as ChildNode));
        node = node.parentNode;
      }
      return result;
    }
    return { startPath: path(range.startContainer), startOffset: range.startOffset, endPath: path(range.endContainer), endOffset: range.endOffset };
  }

  function restoreBookmark(bookmark?: EditorSelection | null): void {
    if (!editorRef) return;
    function nodeAt(path: readonly number[]): Node | null {
      let node: Node = editorRef as HTMLDivElement;
      for (const index of path) {
        const next = node.childNodes.item(index);
        if (!next) return null;
        node = next;
      }
      return node;
    }
    const range = document.createRange();
    const start = bookmark ? nodeAt(bookmark.startPath) : null;
    const end = bookmark ? nodeAt(bookmark.endPath) : null;
    if (bookmark && start && end) {
      const limit = (node: Node) => node.nodeType === Node.TEXT_NODE ? node.textContent?.length ?? 0 : node.childNodes.length;
      range.setStart(start, Math.min(bookmark.startOffset, limit(start)));
      range.setEnd(end, Math.min(bookmark.endOffset, limit(end)));
    } else { range.selectNodeContents(editorRef); range.collapse(false); }
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    lastSelection = range.cloneRange();
  }

  function undoOrRedo(redo = false): void {
    if (!editorRef) return;
    const snapshot = redo ? history.redo() : history.undo();
    if (!snapshot) return;
    editorRef.innerHTML = snapshot.html;
    editorRef.focus();
    restoreBookmark(snapshot.selection);
    closeContext();
    showBlockHandle(undefined);
    pendingDropAnchor = undefined;
    triggerSync();
  }

  function restoreSelection(): void {
    if (!lastSelection || !editorRef?.contains(lastSelection.commonAncestorContainer)) return;
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(lastSelection);
  }

  function insertMarkdown(markdown: string): boolean {
    if (!editorRef) return false;
    history.captureSelection(selectionBookmark());
    if (pendingDropAnchor !== undefined) {
      const nodes = Array.from(editorRef.childNodes);
      const index = pendingDropAnchor ? nodes.indexOf(pendingDropAnchor as ChildNode) : nodes.length;
      const incoming = document.createElement('div');
      incoming.innerHTML = markdownToVisualHtml(markdown);
      const container = document.createElement('div');
      for (const node of insertBlocks(nodes, index < 0 ? nodes.length : index, Array.from(incoming.childNodes))) container.append(node.cloneNode(true));
      pendingDropAnchor = undefined;
      return replaceDocumentHtml(container.innerHTML);
    }
    editorRef.focus();
    restoreSelection();
    const inserted = document.execCommand('insertHTML', false, markdownToVisualHtml(markdown));
    if (inserted) {
      captureSelection();
      triggerSync();
    }
    return inserted;
  }

  function exec(command: string, value?: string) {
    if (!editorRef) return;
    editorRef.focus();
    restoreSelection();
    document.execCommand(command, false, value);
    triggerSync();
  }

  function formatBlock(tag: string) {
    if (!editorRef) return;
    editorRef.focus();
    restoreSelection();
    document.execCommand('formatBlock', false, tag);
    triggerSync();
  }

  function insertLink() {
    const url = window.prompt('Enter link URL (e.g. https://github.com):');
    if (url) {
      exec('createLink', url);
    }
  }

  function insertInlineCode() {
    editorRef?.focus();
    restoreSelection();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const selectedText = range.toString() || 'code';
    const codeNode = document.createElement('code');
    codeNode.textContent = selectedText;
    document.execCommand('insertHTML', false, codeNode.outerHTML);
    triggerSync();
  }

  function insertTable() {
    const tableHtml = `
      <table>
        <thead>
          <tr><th>Feature</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td>Example 1</td><td>Value 1</td></tr>
          <tr><td>Example 2</td><td>Value 2</td></tr>
        </tbody>
      </table>
      <p><br></p>
    `;
    exec('insertHTML', tableHtml);
  }

  function findTableCell(range = lastSelection): SelectedTableCell | null {
    if (!editorRef || !range) return null;
    const node = range.commonAncestorContainer;
    const element = node instanceof Element ? node : node.parentElement;
    const cell = element?.closest<HTMLTableCellElement>('td, th');
    const table = cell?.closest<HTMLTableElement>('table');
    if (!cell || !table || !editorRef.contains(table)) return null;
    return { cell, table };
  }

  function focusTableCell(table: HTMLTableElement, position: TableCellPosition): void {
    const cell = table.rows[position.row]?.cells[position.column];
    if (!cell) return;
    editorRef?.focus();
    const range = document.createRange();
    range.selectNodeContents(cell);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    lastSelection = range.cloneRange();
    captureSelection();
  }

  function replaceTable(table: HTMLTableElement, replacement: HTMLTableElement, position: TableCellPosition): void {
    if (!editorRef) return;
    history.captureSelection(selectionBookmark());
    table.replaceWith(replacement);
    focusTableCell(replacement, position);
    showBlockHandle(replacement);
    setElementContext(null);
    triggerSync();
  }

  function editTable(action: TableAction | 'delete-table'): void {
    const selected = findTableCell();
    if (!selected) return;

    const rowIndex = selected.cell.closest<HTMLTableRowElement>('tr')?.rowIndex ?? -1;
    const columnIndex = selected.cell.cellIndex;
    const table = selected.table.cloneNode(true) as HTMLTableElement;
    if (action === 'delete-table') {
      history.captureSelection(selectionBookmark());
      const paragraph = document.createElement('p');
      paragraph.append(document.createElement('br'));
      selected.table.replaceWith(paragraph);
      editorRef?.focus();
      const range = document.createRange();
      range.selectNodeContents(paragraph);
      range.collapse(true);
      lastSelection = range;
      restoreSelection();
      closeContext();
      showBlockHandle(undefined);
      triggerSync();
      return;
    }
    const position = editTableCell(table, rowIndex, columnIndex, action);
    if (position) replaceTable(selected.table, table, position);
  }

  function handleTablePaste(event: ClipboardEvent): void {
    const selection = window.getSelection();
    const selected = selection?.rangeCount ? findTableCell(selection.getRangeAt(0)) : null;
    const values = parseTableClipboard(event.clipboardData?.getData('text/plain') ?? '');
    if (!selected || !values) return;
    event.preventDefault();
    const position = { row: selected.cell.closest('tr')?.rowIndex ?? 0, column: selected.cell.cellIndex };
    const table = selected.table.cloneNode(true) as HTMLTableElement;
    pasteTableCells(table, position.row, position.column, values);
    replaceTable(selected.table, table, position);
  }

  function insertCodeBlock() {
    const codeHtml = `<pre><code>// code snippet here</code></pre><p><br></p>`;
    exec('insertHTML', codeHtml);
  }

  function insertAlert(type: 'NOTE' | 'TIP' | 'IMPORTANT' | 'WARNING') {
    const alertHtml = `<blockquote><p>[!${type}]<br>Highlight important information for users here.</p></blockquote><p><br></p>`;
    exec('insertHTML', alertHtml);
  }

  function handleInput(event: InputEvent) {
    setElementContext(null);
    captureSelection();
    setTextControls(false);
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const node = selection.anchorNode;
      const text = node?.textContent || '';
      const offset = selection.anchorOffset;
      const beforeCursor = text.slice(0, offset);

      const slashMatch = /\/([a-zA-Z0-9_-]*)$/.exec(beforeCursor);
      if (slashMatch) {
        const range = selection.getRangeAt(0).cloneRange();
        const rect = range.getBoundingClientRect();
        setSlashPos({
          top: rect.bottom + window.scrollY + 6,
          left: Math.max(16, rect.left + window.scrollX),
        });
        setSlashQuery(slashMatch[1]);
        setSelectedIndex(0);
        setSlashOpen(true);
      } else {
        setSlashOpen(false);
      }
    }
    triggerSync(event.inputType === 'insertText' || event.inputType === 'deleteContentBackward' || event.isComposing);
  }

  function topLevelBlock(node: Node | null): Element | undefined {
    let element = node instanceof Element ? node : node?.parentElement;
    while (element && element.parentElement !== editorRef) element = element.parentElement;
    return element && element.parentElement === editorRef ? element : undefined;
  }

  function showBlockHandle(block: Element | undefined): void {
    setActiveBlock(block);
    if (block) {
      const rect = block.getBoundingClientRect();
      setBlockPosition({ left: rect.left - 30, top: rect.top });
    }
  }

  function closeContext(): void {
    setElementContext(null);
    setTextControls(false);
    setTableControls(null);
  }

  function dismissContext(): void {
    closeContext();
    editorRef?.focus();
    restoreSelection();
  }

  function handleEditorClick(event: MouseEvent): void {
    pendingDropAnchor = undefined;
    captureSelection();
    const target = event.target instanceof HTMLElement ? event.target : null;
    const block = topLevelBlock(target);
    if (block) showBlockHandle(block);
    if (tableControls() || textControls()) {
      setElementContext(null);
      props.onContextOpen?.();
      return;
    }
    const element = target?.closest<HTMLElement>('img, a, pre, summary, details, h1, h2, h3, h4, h5, h6, [align]');
    if (!element || !editorRef?.contains(element)) { setElementContext(null); return; }
    const selected = element.tagName === 'SUMMARY' ? element.closest<HTMLElement>('details') ?? element : element;
    const tag = selected.tagName;
    const kind: ElementKind = tag === 'IMG' ? (selected.getAttribute('src')?.includes('img.shields.io') ? 'Badge' : 'Image')
      : tag === 'A' ? 'Link' : tag === 'PRE' ? 'Code block' : tag === 'DETAILS' ? 'Details'
      : /^H[1-6]$/.test(tag) ? 'Heading' : 'Centered block';
    const rect = selected.getBoundingClientRect();
    setElementValue(tag === 'IMG' ? selected.getAttribute('src') ?? '' : tag === 'A' ? selected.getAttribute('href') ?? ''
      : tag === 'DETAILS' ? selected.querySelector('summary')?.textContent ?? '' : selected.textContent ?? '');
    setElementExtra(tag === 'IMG' ? selected.getAttribute('alt') ?? '' : tag === 'PRE'
      ? selected.querySelector('code')?.className.replace(/^language-/, '') ?? '' : '');
    setElementLink(tag === 'IMG' ? selected.closest('a')?.getAttribute('href') ?? '' : '');
    setElementError('');
    setElementContext({ element: selected, kind, position: { left: rect.right + 12, top: rect.top } });
    props.onContextOpen?.();
  }

  function replaceElement(element: HTMLElement, html: string): void {
    if (!editorRef?.contains(element)) { closeContext(); return; }
    editorRef.focus();
    const range = document.createRange();
    range.selectNode(element);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.execCommand('insertHTML', false, html);
    lastSelection = undefined;
    closeContext();
    triggerSync();
  }

  function applyElementOptions(): void {
    const context = elementContext();
    if (!context) return;
    const clone = context.element.cloneNode(true) as HTMLElement;
    if (context.kind === 'Image' || context.kind === 'Badge' || context.kind === 'Link') {
      const urls = [elementValue(), ...(context.kind !== 'Link' && elementLink() ? [elementLink()] : [])];
      if (urls.some((url) => !isSafeReadmeUrl(url))) {
        setElementError('Use an https:// URL, a relative path, or an anchor.');
        return;
      }
      clone.setAttribute(context.kind === 'Link' ? 'href' : 'src', elementValue().trim());
      if (context.kind !== 'Link') {
        clone.setAttribute('alt', elementExtra());
        const existingLink = context.element.closest('a');
        const link = document.createElement('a');
        link.setAttribute('href', elementLink().trim());
        link.append(clone);
        replaceElement(existingLink ?? context.element, elementLink().trim() ? link.outerHTML : clone.outerHTML);
        return;
      }
    } else if (context.kind === 'Code block') {
      const code = document.createElement('code');
      code.textContent = elementValue();
      if (elementExtra().trim()) code.className = `language-${elementExtra().trim().replace(/[^\w+-]/g, '')}`;
      clone.replaceChildren(code);
    } else if (context.kind === 'Details') {
      const summary = clone.querySelector('summary') ?? document.createElement('summary');
      summary.textContent = elementValue();
      if (!summary.parentElement) clone.prepend(summary);
    }
    replaceElement(context.element, clone.outerHTML);
  }

  function moveBlock(source: Element, destination: number): void {
    if (!editorRef || source.parentElement !== editorRef) return;
    const nodes = Array.from(editorRef.childNodes);
    const target = editorRef.children.item(destination);
    const boundary = target ? nodes.indexOf(target) : nodes.length;
    const sourceIndex = nodes.indexOf(source);
    if (boundary === sourceIndex || boundary === sourceIndex + 1) return;
    const container = document.createElement('div');
    for (const node of reorderBlocks(nodes, sourceIndex, boundary)) container.append(node.cloneNode(true));
    replaceDocumentHtml(container.innerHTML);
  }

  function replaceDocumentHtml(html: string): boolean {
    if (!editorRef) return false;
    history.captureSelection(selectionBookmark());
    editorRef.focus();
    // Record one snapshot for the complete move, without inheriting browser formatting.
    editorRef.innerHTML = html;
    lastSelection = undefined;
    restoreBookmark();
    showBlockHandle(undefined);
    closeContext();
    triggerSync();
    return true;
  }

  function updateDropBoundary(x: number, y: number): boolean {
    if (!editorRef) return false;
    const scroller = editorRef.parentElement;
    const scrollRect = scroller?.getBoundingClientRect();
    if (!scrollRect || x < scrollRect.left || x > scrollRect.right || y < scrollRect.top || y > scrollRect.bottom) {
      setDropMarker(null);
      return false;
    }
    const blocks = Array.from(editorRef.children);
    dropBoundary = blocks.findIndex((block) => {
      const rect = block.getBoundingClientRect();
      return y < rect.top + rect.height / 2;
    });
    if (dropBoundary < 0) dropBoundary = blocks.length;
    const bounds = editorRef.getBoundingClientRect();
    const next = blocks[dropBoundary]?.getBoundingClientRect();
    const last = blocks.at(-1)?.getBoundingClientRect();
    setDropMarker({ left: bounds.left, width: bounds.width, top: next ? next.top - 5 : (last?.bottom ?? bounds.top) + 5 });
    if (scroller && y < scrollRect.top + 40) scroller.scrollTop -= 18;
    if (scroller && y > scrollRect.bottom - 40) scroller.scrollTop += 18;
    return true;
  }

  function placeInsertionAtDrop(): void {
    if (!editorRef) return;
    const range = document.createRange();
    const next = editorRef.children.item(dropBoundary);
    pendingDropAnchor = next;
    if (next) range.setStartBefore(next);
    else { range.selectNodeContents(editorRef); range.collapse(false); }
    range.collapse(true);
    lastSelection = range;
    restoreSelection();
  }

  function dragOver(event: DragEvent): void {
    if (!event.dataTransfer?.types.some((type) => type === TOOL_DRAG_TYPE || type === BLOCK_DRAG_TYPE)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = draggedBlock ? 'move' : 'copy';
    updateDropBoundary(event.clientX, event.clientY);
  }

  function drop(event: DragEvent): void {
    if (!editorRef || !event.dataTransfer?.types.some((type) => type === TOOL_DRAG_TYPE || type === BLOCK_DRAG_TYPE)) return;
    event.preventDefault();
    event.stopPropagation();
    setDropMarker(null);
    if (draggedBlock) {
      moveBlock(draggedBlock, dropBoundary);
      draggedBlock = undefined;
    } else {
      placeInsertionAtDrop();
      props.onToolDrop?.(event.dataTransfer.getData(TOOL_DRAG_TYPE), event);
    }
  }

  function executeSlashCommand(cmd: SlashCommand) {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const node = selection.anchorNode;
      if (node && node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        const offset = selection.anchorOffset;
        const slashIdx = text.lastIndexOf('/', offset);
        if (slashIdx !== -1) {
          node.textContent = text.slice(0, slashIdx) + text.slice(offset);
        }
      }
    }
    setSlashOpen(false);
    cmd.action();
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (slashOpen()) {
      const cmds = filteredCommands();
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((idx) => (idx + 1) % (cmds.length || 1));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((idx) => (idx - 1 + cmds.length) % (cmds.length || 1));
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        if (cmds[selectedIndex()]) {
          executeSlashCommand(cmds[selectedIndex()]);
        }
        return;
      }
      if (event.key === 'Escape') {
        setSlashOpen(false);
        return;
      }
    }

    if (event.key === 'Tab' && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const selected = findTableCell();
      if (selected) {
        const position = nextTableCell(selected.cell.closest('tr')?.rowIndex ?? 0, selected.cell.cellIndex,
          selected.table.rows.length, selected.table.rows[0].cells.length, event.shiftKey);
        if (position) {
          event.preventDefault();
          if (position.row >= selected.table.rows.length) {
            const table = selected.table.cloneNode(true) as HTMLTableElement;
            editTableCell(table, table.rows.length - 1, 0, 'row-below');
            replaceTable(selected.table, table, position);
          } else focusTableCell(selected.table, position);
          return;
        }
      }
    }

    if (event.metaKey || event.ctrlKey) {
      const key = event.key.toLowerCase();
      if (key === 'z' || key === 'y') {
        event.preventDefault();
        undoOrRedo(key === 'y' || event.shiftKey);
      } else if (key === 'b') {
        event.preventDefault();
        exec('bold');
      } else if (key === 'i') {
        event.preventDefault();
        exec('italic');
      } else if (key === 'k') {
        event.preventDefault();
        insertLink();
      }
    }
  }

  return (
    <div class="visual-editor-container" onMouseLeave={() => { if (!draggedBlock) showBlockHandle(undefined); }}>
      <Show when={textControls()}>
      <FloatingWidget title="Text formatting" compact position={contextPosition()} onClose={dismissContext}>
      <div class="visual-toolbar" aria-label="Visual formatting toolbar" onMouseDown={(event) => event.preventDefault()}>
        <div class="toolbar-group">
          <button type="button" class="tool-btn" onClick={() => formatBlock('H1')} title="Heading 1 (H1)">
            <strong>H1</strong>
          </button>
          <button type="button" class="tool-btn" onClick={() => formatBlock('H2')} title="Heading 2 (H2)">
            <strong>H2</strong>
          </button>
          <button type="button" class="tool-btn" onClick={() => formatBlock('H3')} title="Heading 3 (H3)">
            <strong>H3</strong>
          </button>
          <button type="button" class="tool-btn" onClick={() => formatBlock('P')} title="Normal text (Paragraph)">
            <span>¶</span>
          </button>
        </div>

        <div class="toolbar-divider" />

        <div class="toolbar-group">
          <button type="button" class="tool-btn" onClick={() => exec('bold')} title="Bold (⌘B)">
            <strong>B</strong>
          </button>
          <button type="button" class="tool-btn" onClick={() => exec('italic')} title="Italic (⌘I)">
            <em>I</em>
          </button>
          <button type="button" class="tool-btn" onClick={() => exec('strikeThrough')} title="Strikethrough">
            <s>S</s>
          </button>
          <button type="button" class="tool-btn" onClick={insertInlineCode} title="Inline Code">
            <code>&lt;/&gt;</code>
          </button>
          <button type="button" class="tool-btn" onClick={insertLink} title="Link (⌘K)">
            <span>↗</span>
          </button>
        </div>

        <div class="toolbar-divider" />

        <div class="toolbar-group">
          <button type="button" class="tool-btn" onClick={() => exec('insertUnorderedList')} title="Bullet List">
            <span>• List</span>
          </button>
          <button type="button" class="tool-btn" onClick={() => exec('insertOrderedList')} title="Numbered List">
            <span>1. List</span>
          </button>
          <button type="button" class="tool-btn" onClick={insertTable} title="Insert Table">
            <span>⌗ Table</span>
          </button>
          <button type="button" class="tool-btn" onClick={insertCodeBlock} title="Code block">
            <span>{'{ }'} Code</span>
          </button>
          <button type="button" class="tool-btn" onClick={() => insertAlert('NOTE')} title="Alert note">
            <span>💡 Callout</span>
          </button>
        </div>

      </div>
      </FloatingWidget>
      </Show>

      <Show when={tableControls()}>{(state) => <>
        <FloatingWidget title="Table" compact position={contextPosition()} onClose={dismissContext}>
        <div class="table-options" aria-label="Table controls">
          <p class="table-selection-context" role="status">Row {state().row + 1} · Column {state().column + 1}
            <span>{state().isHeader ? 'Header' : 'Body'} · {state().rowCount} × {state().columnCount}</span>
          </p>
          <fieldset><legend>Row</legend><div class="widget-actions">
            <button type="button" class="tool-btn" disabled={state().isHeader} title={state().isHeader ? 'GitHub Markdown requires the header to stay first' : 'Insert row above selected cell'} onClick={() => editTable('row-above')}>Insert above</button>
            <button type="button" class="tool-btn" onClick={() => editTable('row-below')}>Insert below</button>
            <button type="button" class="tool-btn" disabled={state().row <= 1} onClick={() => editTable('row-up')}>Move up</button>
            <button type="button" class="tool-btn" disabled={state().isHeader || state().row === state().rowCount - 1} onClick={() => editTable('row-down')}>Move down</button>
          </div></fieldset>
          <fieldset><legend>Column</legend><div class="widget-actions">
            <button type="button" class="tool-btn" onClick={() => editTable('column-left')}>Insert left</button>
            <button type="button" class="tool-btn" onClick={() => editTable('column-right')}>Insert right</button>
            <button type="button" class="tool-btn" disabled={state().column === 0} onClick={() => editTable('column-left-move')}>Move left</button>
            <button type="button" class="tool-btn" disabled={state().column === state().columnCount - 1} onClick={() => editTable('column-right-move')}>Move right</button>
          </div></fieldset>
          <fieldset><legend>Column alignment</legend><div class="widget-actions">
            {(['left', 'center', 'right'] as const).map(align => <button type="button" class="tool-btn"
              aria-label={`Align column ${align}`} aria-pressed={state().alignment === align ? 'true' : 'false'}
              onClick={() => editTable(`align-${align}`)}>{align}</button>)}
          </div></fieldset>
          <fieldset><legend>Clear & remove</legend><div class="widget-actions">
            <button type="button" class="tool-btn" onClick={() => editTable('clear-cell')}>Clear cell</button>
            <button type="button" class="tool-btn danger" disabled={state().isHeader} title={state().isHeader ? 'The header row is required by GitHub Markdown' : 'Delete selected row'} onClick={() => editTable('delete-row')}>Delete row</button>
            <button type="button" class="tool-btn danger" disabled={state().columnCount <= 1} title="Keep at least one column" onClick={() => editTable('delete-column')}>Delete column</button>
            <button type="button" class="tool-btn danger" onClick={() => editTable('delete-table')}>Delete table</button>
          </div></fieldset>
          <p class="table-keyboard-hint">Tab / Shift+Tab to navigate. Tab at the end adds a row. Paste spreadsheet cells directly.</p>
        </div>
        </FloatingWidget>
        <div class="table-cell-selection" aria-hidden="true" style={{ left: `${state().rect.left}px`, top: `${state().rect.top}px`, width: `${state().rect.width}px`, height: `${state().rect.height}px` }} />
      </>}</Show>

      <Show when={elementContext()} keyed>{(context) => (
        <FloatingWidget title={context.kind} compact position={context.position} onClose={dismissContext}>
          <div class="element-options inspector-content">
            <Show when={context.kind === 'Heading'}>
              <p class="inspector-description">Heading level</p>
              <div class="widget-actions" onMouseDown={(event) => event.preventDefault()}>
                {[1, 2, 3, 4, 5, 6].map((level) => <button type="button" class="tool-btn" onClick={() => {
                  const heading = document.createElement(`h${level}`);
                  heading.innerHTML = context.element.innerHTML;
                  replaceElement(context.element, heading.outerHTML);
                }}>H{level}</button>)}
              </div>
            </Show>
            <Show when={context.kind === 'Image' || context.kind === 'Badge' || context.kind === 'Link'}>
              <label>{context.kind === 'Link' ? 'Destination URL' : 'Image URL'}<input value={elementValue()} onInput={(event) => setElementValue(event.currentTarget.value)} /></label>
              <Show when={context.kind !== 'Link'}>
                <label>Alt text<input value={elementExtra()} onInput={(event) => setElementExtra(event.currentTarget.value)} /></label>
                <label>Link (optional)<input value={elementLink()} onInput={(event) => setElementLink(event.currentTarget.value)} /></label>
              </Show>
            </Show>
            <Show when={context.kind === 'Code block'}>
              <label>Language<input value={elementExtra()} placeholder="typescript" onInput={(event) => setElementExtra(event.currentTarget.value)} /></label>
              <label>Code<textarea value={elementValue()} onInput={(event) => setElementValue(event.currentTarget.value)} rows={7} /></label>
            </Show>
            <Show when={context.kind === 'Details'}>
              <label>Summary<input value={elementValue()} onInput={(event) => setElementValue(event.currentTarget.value)} /></label>
            </Show>
            <Show when={context.kind === 'Centered block'}>
              <p class="inspector-description">Block alignment</p>
              <div class="widget-actions">{['left', 'center', 'right'].map((align) => <button type="button" class="tool-btn" onClick={() => {
                const clone = context.element.cloneNode(true) as HTMLElement;
                clone.setAttribute('align', align);
                replaceElement(context.element, clone.outerHTML);
              }}>{align}</button>)}</div>
            </Show>
            <Show when={elementError()}><p class="widget-error" role="alert">{elementError()}</p></Show>
            <Show when={context.kind !== 'Heading' && context.kind !== 'Centered block'}>
              <button type="button" class="wide-action" onClick={applyElementOptions}>Apply changes</button>
            </Show>
          </div>
        </FloatingWidget>
      )}</Show>

      {/* Editable Canvas */}
      <div class="visual-canvas-scroller" onDragOver={dragOver} onDrop={drop}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropMarker(null); }}
        onScroll={() => { if (!draggedBlock) showBlockHandle(undefined); closeContext(); }}>
        <div
          ref={(element) => {
            editorRef = element;
            setEditorElement(element);
          }}
          class="visual-editor-canvas markdown-body"
          contenteditable={true}
          spellcheck={false}
          onInput={handleInput}
          onPaste={handleTablePaste}
          onBeforeInput={(event) => {
            if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
              event.preventDefault();
              undoOrRedo(event.inputType === 'historyRedo');
            } else history.captureSelection(selectionBookmark());
          }}
          onKeyDown={handleKeyDown}
          onKeyUp={captureSelection}
          onMouseUp={captureSelection}
          onBlur={captureSelection}
          onClick={handleEditorClick}
          onMouseMove={(event) => {
            const block = topLevelBlock(event.target as Node);
            // Keep the handle reachable while crossing the canvas padding.
            if (!draggedBlock && block) showBlockHandle(block);
          }}
          aria-label="Visual README Canvas"
        />
      </div>

      <Show when={activeBlock()}>
        <div class="block-handle" style={{ left: `${blockPosition().left}px`, top: `${blockPosition().top}px` }}>
          <button type="button" draggable="true" aria-label="Drag block to reorder" title="Drag block · Alt + ↑/↓ to reorder"
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              draggedBlock = activeBlock();
              blockDragStart = { x: event.clientX, y: event.clientY, moved: false };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (!blockDragStart || !draggedBlock) return;
              if (Math.hypot(event.clientX - blockDragStart.x, event.clientY - blockDragStart.y) > 6) blockDragStart.moved = true;
              if (blockDragStart.moved) { closeContext(); updateDropBoundary(event.clientX, event.clientY); }
            }}
            onPointerUp={(event) => {
              if (draggedBlock && blockDragStart?.moved && updateDropBoundary(event.clientX, event.clientY)) moveBlock(draggedBlock, dropBoundary);
              draggedBlock = undefined;
              blockDragStart = undefined;
              setDropMarker(null);
            }}
            onPointerCancel={() => { draggedBlock = undefined; blockDragStart = undefined; setDropMarker(null); }}
            onDragStart={(event) => {
              draggedBlock = activeBlock();
              event.dataTransfer?.setData(BLOCK_DRAG_TYPE, 'move');
              if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = 'move';
                if (draggedBlock) event.dataTransfer.setDragImage(draggedBlock, 0, 0);
              }
              closeContext();
            }}
            onDragEnd={() => { draggedBlock = undefined; setDropMarker(null); }}
            onKeyDown={(event) => {
              const block = activeBlock();
              if (!event.altKey || !block || !editorRef || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
              event.preventDefault();
              const index = Array.from(editorRef.children).indexOf(block);
              const destination = event.key === 'ArrowUp' ? index - 1 : index + 2;
              if (destination >= 0 && destination <= editorRef.children.length) moveBlock(block, destination);
            }}
          >⠿</button>
        </div>
      </Show>
      <Show when={dropMarker()}>{(marker) => <div class="block-drop-marker" style={{ top: `${marker().top}px`, left: `${marker().left}px`, width: `${marker().width}px` }}><span>Drop block here</span></div>}</Show>

      {/* Floating Slash Command Palette */}
      <Show when={slashOpen() && filteredCommands().length > 0}>
        <div
          class="slash-menu"
          style={{
            top: `${slashPos().top}px`,
            left: `${slashPos().left}px`,
          }}
        >
          <div class="slash-menu-header">Insert block (type to filter)</div>
          <div class="slash-menu-list">
            {filteredCommands().map((cmd, idx) => (
              <button
                type="button"
                class={['slash-item', { active: idx === selectedIndex() }]}
                onClick={() => executeSlashCommand(cmd)}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <span class="slash-icon">{cmd.icon}</span>
                <div class="slash-text">
                  <strong>{cmd.title}</strong>
                  <small>{cmd.description}</small>
                </div>
              </button>
            ))}
          </div>
        </div>
      </Show>
    </div>
  );
}
