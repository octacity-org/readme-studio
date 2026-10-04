export type TableAction = 'row-above' | 'row-below' | 'column-left' | 'column-right'
  | 'row-up' | 'row-down' | 'column-left-move' | 'column-right-move'
  | 'align-left' | 'align-center' | 'align-right' | 'delete-row' | 'delete-column' | 'clear-cell';
export interface TableCellPosition { readonly row: number; readonly column: number }

function appendEmptyRow(table: HTMLTableElement, before: HTMLTableRowElement | null = null): HTMLTableRowElement {
  const row = table.ownerDocument.createElement('tr');
  for (const header of Array.from(table.rows[0].cells)) {
    const cell = table.ownerDocument.createElement('td');
    const align = header.getAttribute('align');
    if (align) cell.setAttribute('align', align);
    row.appendChild(cell);
  }
  let body = before?.parentElement?.tagName === 'TBODY' ? before.parentElement
    : Array.from(table.children).find(element => element.tagName === 'TBODY');
  if (!body) { body = table.ownerDocument.createElement('tbody'); table.appendChild(body); }
  body.insertBefore(row, before);
  return row;
}

export function editTableCell(table: HTMLTableElement, rowIndex: number, columnIndex: number, action: TableAction): TableCellPosition | null {
  const row = table.rows[rowIndex];
  const cell = row?.cells[columnIndex];
  if (!cell) return null;
  let nextRow = rowIndex;
  let nextColumn = columnIndex;
  if (action === 'row-above' || action === 'row-below') {
    if (action === 'row-above' && rowIndex === 0) return null;
    nextRow = rowIndex + (action === 'row-below' ? 1 : 0);
    appendEmptyRow(table, table.rows[nextRow] ?? null);
  } else if (action === 'column-left' || action === 'column-right') {
    nextColumn += action === 'column-right' ? 1 : 0;
    for (const currentRow of Array.from(table.rows)) {
      const newCell = table.ownerDocument.createElement(currentRow === table.rows[0] ? 'th' : 'td');
      currentRow.insertBefore(newCell, currentRow.cells[nextColumn] ?? null);
    }
  } else if (action === 'row-up' || action === 'row-down') {
    nextRow += action === 'row-up' ? -1 : 1;
    if (rowIndex === 0 || nextRow < 1 || nextRow >= table.rows.length) return null;
    const other = table.rows[nextRow];
    if (row.parentNode !== other.parentNode) return null;
    row.parentNode?.insertBefore(row, action === 'row-up' ? other : other.nextSibling);
  } else if (action === 'column-left-move' || action === 'column-right-move') {
    nextColumn += action === 'column-left-move' ? -1 : 1;
    if (nextColumn < 0 || nextColumn >= row.cells.length) return null;
    for (const currentRow of Array.from(table.rows)) {
      const moving = currentRow.cells[columnIndex];
      const other = currentRow.cells[nextColumn];
      currentRow.insertBefore(moving, action === 'column-left-move' ? other : other.nextSibling);
    }
  } else if (action.startsWith('align-')) {
    for (const currentRow of Array.from(table.rows)) currentRow.cells[columnIndex].setAttribute('align', action.slice(6));
  } else if (action === 'delete-row') {
    if (rowIndex === 0) return null;
    row.remove();
    nextRow = Math.min(rowIndex, table.rows.length - 1);
  } else if (action === 'delete-column') {
    if (row.cells.length <= 1) return null;
    for (const currentRow of Array.from(table.rows)) currentRow.cells[columnIndex].remove();
    nextColumn = Math.min(columnIndex, table.rows[0].cells.length - 1);
  } else if (action === 'clear-cell') cell.textContent = '';
  return { row: nextRow, column: nextColumn };
}

export function nextTableCell(row: number, column: number, rowCount: number, columnCount: number, backwards: boolean): TableCellPosition | null {
  const index = row * columnCount + column + (backwards ? -1 : 1);
  if (index < 0 || rowCount < 1 || columnCount < 1) return null;
  return { row: Math.floor(index / columnCount), column: index % columnCount };
}

/** Spreadsheet clipboard text is tab-separated, with quoted multiline cells. */
export function parseTableClipboard(text: string): string[][] | null {
  if (!/[\t\r\n]/.test(text)) return null;
  const normalized = text.replace(/\r\n?/g, '\n');
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    if (character === '"' && (quoted || value === '')) {
      if (quoted && normalized[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (!quoted && (character === '\t' || character === '\n')) {
      row.push(value); value = '';
      if (character === '\n') { rows.push(row); row = []; }
    } else value += character;
  }
  if (row.length || value || !normalized.endsWith('\n')) { row.push(value); rows.push(row); }
  return rows.length ? rows : null;
}

export function pasteTableCells(table: HTMLTableElement, rowIndex: number, columnIndex: number, values: readonly (readonly string[])[]): void {
  const width = columnIndex + Math.max(0, ...values.map(row => row.length));
  while (table.rows[0].cells.length < width) editTableCell(table, 0, table.rows[0].cells.length - 1, 'column-right');
  while (table.rows.length < rowIndex + values.length) appendEmptyRow(table);
  values.forEach((row, rowOffset) => row.forEach((value, columnOffset) => {
    const cell = table.rows[rowIndex + rowOffset].cells[columnIndex + columnOffset];
    cell.textContent = '';
    value.split('\n').forEach((line, index) => {
      if (index) cell.appendChild(table.ownerDocument.createElement('br'));
      cell.appendChild(table.ownerDocument.createTextNode(line));
    });
  }));
}
