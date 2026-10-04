import { describe, expect, test } from 'bun:test';
import { EditorHistory } from './editor-history';

describe('visual editor history', () => {
  test('undoes typing, helper insertion, and reordering in their original sequence', () => {
    const history = new EditorHistory({ html: '<p>Start</p>' });
    history.record({ html: '<p>Start typing</p>' });
    history.record({ html: '<p>Start typing</p><h2>Features</h2>' });
    history.record({ html: '<h2>Features</h2><p>Start typing</p>' });
    expect(history.undo()?.html).toBe('<p>Start typing</p><h2>Features</h2>');
    expect(history.undo()?.html).toBe('<p>Start typing</p>');
    expect(history.undo()?.html).toBe('<p>Start</p>');
    expect(history.undo()).toBeNull();
    expect(history.redo()?.html).toBe('<p>Start typing</p>');
  });

  test('coalesces consecutive typing but keeps structural edits separate', () => {
    const history = new EditorHistory({ html: '' });
    history.record({ html: 'a' }, true, 100);
    history.record({ html: 'ab' }, true, 200);
    history.record({ html: 'abc' }, true, 300);
    history.record({ html: 'abc<h2>Title</h2>' }, false, 400);
    expect(history.undo()?.html).toBe('abc');
    expect(history.undo()?.html).toBe('');
  });

  test('retains the pre-edit selection when undoing a widget edit', () => {
    const selection = { startPath: [0, 0], startOffset: 2, endPath: [0, 0], endOffset: 2 };
    const history = new EditorHistory({ html: '<p>hello</p>' });
    history.captureSelection(selection);
    history.record({ html: '<h2>hello</h2>' });
    expect(history.undo()?.selection).toEqual(selection);
  });

  test('clears redo after a new edit and ignores unchanged HTML', () => {
    const history = new EditorHistory({ html: 'a' });
    history.record({ html: 'b' });
    history.record({ html: 'b' });
    expect(history.undo()?.html).toBe('a');
    history.record({ html: 'c' });
    expect(history.redo()).toBeNull();
    expect(history.undo()?.html).toBe('a');
  });

  test('resets history for an externally replaced document and bounds retained edits', () => {
    const history = new EditorHistory({ html: '' });
    for (let index = 1; index <= 110; index += 1) history.record({ html: String(index) });
    let count = 0;
    while (history.undo()) count += 1;
    expect(count).toBe(100);
    history.reset({ html: 'Imported' });
    expect(history.undo()).toBeNull();
    expect(history.redo()).toBeNull();
  });
});
