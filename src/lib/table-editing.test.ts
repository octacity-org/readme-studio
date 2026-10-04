import { describe, expect, test } from 'bun:test';
import { editTableCell, nextTableCell, parseTableClipboard, pasteTableCells } from './table-editing';

// Turndown already uses this DOM implementation in the existing converter tests.
const { createDocument } = require('@mixmark-io/domino') as { createDocument: (html: string) => Document };
function fixture(): HTMLTableElement {
  const doc = createDocument('<table><thead><tr><th align="left">A</th><th align="right">B</th></tr></thead><tbody><tr><td>a1</td><td>b1</td></tr><tr><td>a2</td><td>b2</td></tr></tbody></table>');
  return doc.querySelector('table') as HTMLTableElement;
}

describe('table editing', () => {
  test('inserts above/below and left/right at the selected position', () => {
    const table = fixture();
    expect(editTableCell(table, 2, 0, 'row-above')).toEqual({ row: 2, column: 0 });
    expect(table.rows[3].cells[0].textContent).toBe('a2');
    editTableCell(table, 1, 0, 'row-below');
    expect(table.rows[2].cells[0].textContent).toBe('');
    editTableCell(table, 1, 1, 'column-left');
    expect(table.rows[0].cells[2].textContent).toBe('B');
    editTableCell(table, 1, 1, 'column-right');
    expect(table.rows[0].cells.length).toBe(4);
  });
  test('keeps the required header and last column; prevents moving body rows into headers', () => {
    const table = fixture();
    expect(editTableCell(table, 0, 0, 'row-above')).toBeNull();
    expect(editTableCell(table, 0, 0, 'delete-row')).toBeNull();
    expect(editTableCell(table, 1, 0, 'row-up')).toBeNull();
    editTableCell(table, 1, 0, 'delete-column');
    expect(editTableCell(table, 1, 0, 'delete-column')).toBeNull();
  });
  test('moves rows and columns without losing formatting or column alignment', () => {
    const table = fixture();
    expect(editTableCell(table, 1, 0, 'row-down')).toEqual({ row: 2, column: 0 });
    expect(table.rows[1].cells[0].textContent).toBe('a2');
    expect(editTableCell(table, 2, 0, 'column-right-move')).toEqual({ row: 2, column: 1 });
    expect(table.rows[0].cells[0].getAttribute('align')).toBe('right');
    expect(table.rows[2].cells[1].textContent).toBe('a1');
    editTableCell(table, 2, 1, 'align-center');
    expect(Array.from(table.rows).every(row => row.cells[1].getAttribute('align') === 'center')).toBe(true);
  });
  test('new rows inherit column alignment and deletion keeps a valid selection', () => {
    const table = fixture();
    editTableCell(table, 2, 1, 'row-below');
    expect(table.rows[3].cells[1].getAttribute('align')).toBe('right');
    expect(editTableCell(table, 3, 1, 'delete-row')).toEqual({ row: 2, column: 1 });
    expect(editTableCell(table, 2, 1, 'delete-column')).toEqual({ row: 2, column: 0 });
  });
  test('Tab traverses cells, appends at the end, and Shift+Tab exits at the beginning', () => {
    expect(nextTableCell(0, 1, 3, 2, false)).toEqual({ row: 1, column: 0 });
    expect(nextTableCell(2, 1, 3, 2, false)).toEqual({ row: 3, column: 0 });
    expect(nextTableCell(1, 0, 3, 2, true)).toEqual({ row: 0, column: 1 });
    expect(nextTableCell(0, 0, 3, 2, true)).toBeNull();
  });
  test('pastes a rectangle from the selected cell, expanding rows and columns safely', () => {
    const table = fixture();
    const rows = parseTableClipboard('first\t<script>alert(1)</script>\r\n"two\nlines"\t"a""b"\r\n');
    expect(rows).toEqual([['first', '<script>alert(1)</script>'], ['two\nlines', 'a"b']]);
    if (!rows) throw new Error('Expected spreadsheet cells');
    pasteTableCells(table, 2, 1, rows);
    expect(table.rows.length).toBe(4);
    expect(table.rows[0].cells.length).toBe(3);
    expect(table.rows[2].cells[2].textContent).toBe('<script>alert(1)</script>');
    expect(table.querySelector('script')).toBeFalsy();
    expect(table.rows[3].cells[1].innerHTML).toContain('<br');
    expect(parseTableClipboard('ordinary text')).toBeNull();
  });
});
