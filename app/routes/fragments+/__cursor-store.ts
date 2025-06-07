// Store for cursor-based pagination
// This maintains a mapping of page numbers to cursors

type CursorMap = {
  [page: number]: string;
};

// In-memory store for cursors
let cursorStore: CursorMap = {};

export function storeCursor(page: number, cursor: string) {
  cursorStore[page] = cursor;
}

export function getCursor(page: number): string | undefined {
  return cursorStore[page];
}

export function clearCursors() {
  cursorStore = {};
}

export function getFirstPageCursor(): string | undefined {
  return cursorStore[1];
}

export function getLastKnownPage(): number {
  const pages = Object.keys(cursorStore).map(Number);
  return pages.length ? Math.max(...pages) : 0;
}