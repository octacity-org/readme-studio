export interface EditorSelection {
  readonly startPath: readonly number[];
  readonly startOffset: number;
  readonly endPath: readonly number[];
  readonly endOffset: number;
}

export interface EditSnapshot {
  readonly html: string;
  readonly selection?: EditorSelection | null;
}

export class EditorHistory {
  private current: EditSnapshot;
  private past: EditSnapshot[] = [];
  private future: EditSnapshot[] = [];
  private lastTypingTime = 0;
  private typing = false;

  constructor(initial: EditSnapshot) { this.current = initial; }

  captureSelection(selection: EditorSelection | null): void {
    this.current = { ...this.current, selection };
  }

  record(snapshot: EditSnapshot, typing = false, now = Date.now()): void {
    if (snapshot.html === this.current.html) return;
    if (!(typing && this.typing && now - this.lastTypingTime < 750)) {
      this.past.push(this.current);
      if (this.past.length > 100) this.past.shift();
    }
    this.current = snapshot;
    this.future = [];
    this.typing = typing;
    this.lastTypingTime = now;
  }

  undo(): EditSnapshot | null {
    const snapshot = this.past.pop();
    if (!snapshot) return null;
    this.future.push(this.current);
    this.current = snapshot;
    this.typing = false;
    return snapshot;
  }

  redo(): EditSnapshot | null {
    const snapshot = this.future.pop();
    if (!snapshot) return null;
    this.past.push(this.current);
    this.current = snapshot;
    this.typing = false;
    return snapshot;
  }

  reset(snapshot: EditSnapshot): void {
    this.current = snapshot;
    this.past = [];
    this.future = [];
    this.typing = false;
  }
}
