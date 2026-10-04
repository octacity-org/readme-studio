import { describe, expect, test } from 'bun:test';
import { clampWidgetPosition, insertBlocks, isSafeReadmeUrl, reorderBlocks, TOOL_DRAG_TYPE } from './workspace-widgets';
import { markdownToVisualHtml, visualHtmlToMarkdown } from './editor-converter';

describe('document block dragging', () => {
  test('moves a block before the drop boundary without changing its contents', () => {
    const blocks = ['<h1>Title</h1>', '<p>Description</p>', '<pre><code>npm install</code></pre>'];
    expect(reorderBlocks(blocks, 2, 1)).toEqual([blocks[0], blocks[2], blocks[1]]);
    expect(blocks[2]).toBe('<pre><code>npm install</code></pre>');
  });

  test('supports moving forward, to the end, and to the start', () => {
    expect(reorderBlocks(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'a', 'c']);
    expect(reorderBlocks(['a', 'b', 'c'], 0, 3)).toEqual(['b', 'c', 'a']);
    expect(reorderBlocks(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
  });

  test('ignores drops beside the original block and invalid drag indices', () => {
    const blocks = ['a', 'b', 'c'];
    expect(reorderBlocks(blocks, 1, 1)).toEqual(blocks);
    expect(reorderBlocks(blocks, 1, 2)).toEqual(blocks);
    expect(reorderBlocks(blocks, -1, 2)).toEqual(blocks);
    expect(reorderBlocks(blocks, 4, 0)).toEqual(blocks);
  });

  test('keeps tables and details intact when moved and exported as Markdown', () => {
    const table = markdownToVisualHtml('| Name | Value |\n| --- | --- |\n| Studio | Ready |');
    const details = '<details><summary>More</summary><p>Hidden content</p></details>';
    const result = visualHtmlToMarkdown(reorderBlocks(['<h1>Title</h1>', table, details], 2, 1).join(''));
    expect(result.indexOf('<details>')).toBeLessThan(result.indexOf('| Name | Value |'));
    expect(result).toContain('Hidden content');
    expect(result).toContain('| Studio | Ready |');
  });

  test('uses a private drag format so files and plain text are not treated as tools', () => {
    expect(TOOL_DRAG_TYPE).toBe('application/x-readme-studio-tool');
  });

  test('inserts dropped blocks at a document boundary, outside collapsed details', () => {
    const details = '<details><summary>More</summary><p>Hidden</p></details>';
    const code = '<pre><code>npm install</code></pre>';
    expect(insertBlocks(['<h1>Title</h1>', details], 2, [code])).toEqual(['<h1>Title</h1>', details, code]);
    expect(insertBlocks(['<h1>Title</h1>', details], 1, [code])).toEqual(['<h1>Title</h1>', code, details]);
  });
});

describe('floating widget positioning', () => {
  test('keeps draggable widgets inside the viewport and below the topbar', () => {
    expect(clampWidgetPosition({ left: -100, top: 20 }, { width: 340, height: 300 }, { width: 1200, height: 800 })).toEqual({ left: 8, top: 70 });
    expect(clampWidgetPosition({ left: 2000, top: 1000 }, { width: 340, height: 300 }, { width: 1200, height: 800 })).toEqual({ left: 852, top: 492 });
  });

  test('keeps the header reachable on small screens', () => {
    expect(clampWidgetPosition({ left: 500, top: 900 }, { width: 304, height: 700 }, { width: 320, height: 480 })).toEqual({ left: 8, top: 70 });
  });
});

test('contextual links accept repository paths and reject executable URLs', () => {
  for (const url of ['https://example.com', 'assets/logo.png', '../README.md', '#features', 'mailto:hello@example.com']) expect(isSafeReadmeUrl(url)).toBe(true);
  for (const url of ['', 'javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', '\njavascript:alert(1)']) expect(isSafeReadmeUrl(url)).toBe(false);
});
