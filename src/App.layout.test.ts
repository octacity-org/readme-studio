import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';

describe('App layout', () => {
  test('keeps collapse inside the header and uses consistent chrome icons', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'App.tsx'), 'utf-8');
    const heading = source.match(/<div class="panel-heading">([\s\S]*?)<\/div>/)?.[1] ?? '';
    expect(heading).toContain('Collapse toolbox');
    expect(source).toContain('class="edge-toggle toolbox-expand"');
    const topBar = source.match(/<header class="topbar">([\s\S]*?)<\/header>/)?.[1] ?? '';
    expect(topBar).not.toMatch(/[✨📝🐙]/u);
    expect(topBar).toContain('<ToolIcon');
  });
  test('uses accessible icon-backed tools and full-width rows for long labels', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'App.tsx'), 'utf-8');
    const toolbox = source.match(/<aside class="toolbox-panel"([\s\S]*?)<\/aside>/)?.[1] ?? '';
    expect(toolbox).toContain('Drag to insert · Click to configure.');
    expect(toolbox).toContain('tool-list tool-list-rows');
    expect(toolbox).toContain('<ToolIcon');
    expect(toolbox).not.toContain('tool.hint');
    const styles = fs.readFileSync(path.resolve(__dirname, 'App.css'), 'utf-8');
    expect(styles).toContain('.tool-icon');
    expect(styles).toContain('.tool-list-rows');
  });
  test('places editor controls in the top bar instead of the workbench', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'App.tsx'), 'utf-8');
    const topBar = source.match(/<header class="topbar">([\s\S]*?)<\/header>/)?.[1] ?? '';
    const workbench = source.match(/<main class="workbench">([\s\S]*?)<div class=\{\['workspace'/)?.[1] ?? '';

    expect(topBar).toContain('editor-style-switcher');
    expect(topBar).toContain('view-switcher');
    expect(workbench).not.toContain('editor-style-switcher');
    expect(workbench).not.toContain('view-switcher');

    const styles = fs.readFileSync(path.resolve(__dirname, 'App.css'), 'utf-8');
    expect(styles).toContain('.editor-style-switcher .control-label { display: none; }');
  });
});
