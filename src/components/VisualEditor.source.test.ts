import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';

describe('VisualEditor behavior wiring', () => {
  const source = fs.readFileSync(path.resolve(__dirname, 'VisualEditor.tsx'), 'utf-8');

  test('accepts reactive Markdown and exposes undoable insertion', () => {
    expect(source).toContain('readonly markdown: Accessor<string>');
    expect(source).toContain('readonly ref?: (handle: VisualEditorHandle) => void');
    expect(source).toContain("document.execCommand('insertHTML', false, markdownToVisualHtml(markdown))");
  });

  test('offers undoable controls for the selected table cell', () => {
    expect(source).toContain('aria-label="Table controls"');
    for (const action of [
      'row-above', 'row-below', 'row-up', 'row-down',
      'column-left', 'column-right', 'column-left-move', 'column-right-move',
      'delete-row', 'delete-column', 'clear-cell', 'delete-table',
    ]) {
      expect(source).toContain(`onClick={() => editTable('${action}')}`);
    }
    expect(source).toContain('onClick={() => editTable(`align-${align}`)}');
    expect(source).toMatch(/<button\b[^>]*disabled=\{state\(\)\.isHeader\}[^>]*onClick=\{\(\) => editTable\('delete-row'\)\}/);
    expect(source).toMatch(/<button\b[^>]*disabled=\{state\(\)\.columnCount <= 1\}[^>]*onClick=\{\(\) => editTable\('delete-column'\)\}/);

    const replacement = source.slice(source.indexOf('  function replaceTable('), source.indexOf('  function editTable('));
    expect(replacement).toMatch(/history\.captureSelection\(selectionBookmark\(\)\);[\s\S]*table\.replaceWith\(replacement\);[\s\S]*triggerSync\(\);/);
    const edit = source.slice(source.indexOf('  function editTable('), source.indexOf('  function handleTablePaste('));
    expect(edit).toContain('editTableCell(table, rowIndex, columnIndex, action)');
    expect(edit).toContain('replaceTable(selected.table, table, position)');
    expect(edit).toMatch(/if \(action === 'delete-table'\) \{[\s\S]*history\.captureSelection\(selectionBookmark\(\)\);[\s\S]*selected\.table\.replaceWith\(paragraph\);[\s\S]*triggerSync\(\);/);
    expect(source).toContain('history.record({ html: editorRef.innerHTML, selection: selectionBookmark() }, typing)');
  });
});
