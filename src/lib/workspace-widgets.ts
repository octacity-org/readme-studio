export const TOOL_DRAG_TYPE = 'application/x-readme-studio-tool';
export const BLOCK_DRAG_TYPE = 'application/x-readme-studio-block';

export interface WidgetPosition {
  readonly left: number;
  readonly top: number;
}

export function clampWidgetPosition(
  position: WidgetPosition,
  size: { readonly width: number; readonly height: number },
  viewport: { readonly width: number; readonly height: number },
  minimumTop = 70,
): WidgetPosition {
  return {
    left: Math.max(8, Math.min(position.left, viewport.width - size.width - 8)),
    top: Math.max(minimumTop, Math.min(position.top, viewport.height - size.height - 8)),
  };
}

// The destination is a boundary between blocks, before removal of the source.
export function reorderBlocks<T>(blocks: readonly T[], source: number, destination: number): T[] {
  const result = [...blocks];
  if (!Number.isInteger(source) || source < 0 || source >= blocks.length
    || !Number.isInteger(destination) || destination < 0 || destination > blocks.length) return result;
  const [block] = result.splice(source, 1);
  result.splice(destination > source ? destination - 1 : destination, 0, block);
  return result;
}

export function insertBlocks<T>(blocks: readonly T[], boundary: number, incoming: readonly T[]): T[] {
  const result = [...blocks];
  result.splice(Math.max(0, Math.min(boundary, blocks.length)), 0, ...incoming);
  return result;
}

export function isSafeReadmeUrl(value: string): boolean {
  if (!value.trim()) return false;
  try {
    const url = new URL(value.trim(), 'https://readme-studio.invalid/');
    return ['http:', 'https:', 'mailto:'].includes(url.protocol);
  } catch { return false; }
}
