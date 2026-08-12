import { ElementDTO } from "./api";

// Gap between fresh siblings — leaves room to insert between them later
// without ever needing to renumber the whole board.
const STEP = 1000;

export function siblingsOf(
  elements: Record<string, ElementDTO>,
  parentId: string | null
): ElementDTO[] {
  return Object.values(elements)
    .filter((e) => (e.parent ?? null) === parentId)
    .sort((a, b) => a.z_index - b.z_index);
}

export function zIndexForNewElement(
  elements: Record<string, ElementDTO>,
  parentId: string | null
): number {
  const siblings = siblingsOf(elements, parentId);
  if (siblings.length === 0) return STEP;
  return siblings[siblings.length - 1].z_index + STEP;
}

export function zIndexBringToFront(elements: Record<string, ElementDTO>, id: string): number {
  const el = elements[id];
  const siblings = siblingsOf(elements, el.parent ?? null).filter((s) => s.id !== id);
  if (siblings.length === 0) return STEP;
  return siblings[siblings.length - 1].z_index + STEP;
}

export function zIndexSendToBack(elements: Record<string, ElementDTO>, id: string): number {
  const el = elements[id];
  const siblings = siblingsOf(elements, el.parent ?? null).filter((s) => s.id !== id);
  if (siblings.length === 0) return -STEP;
  return siblings[0].z_index - STEP;
}

export function zIndexStepForward(elements: Record<string, ElementDTO>, id: string): number | null {
  const el = elements[id];
  const siblings = siblingsOf(elements, el.parent ?? null);
  const idx = siblings.findIndex((s) => s.id === id);
  if (idx === -1 || idx === siblings.length - 1) return null; // already frontmost
  const next = siblings[idx + 1];
  const afterNext = siblings[idx + 2];
  return afterNext ? (next.z_index + afterNext.z_index) / 2 : next.z_index + STEP;
}

export function zIndexStepBackward(elements: Record<string, ElementDTO>, id: string): number | null {
  const el = elements[id];
  const siblings = siblingsOf(elements, el.parent ?? null);
  const idx = siblings.findIndex((s) => s.id === id);
  if (idx <= 0) return null; // already backmost
  const prev = siblings[idx - 1];
  const beforePrev = siblings[idx - 2];
  return beforePrev ? (prev.z_index + beforePrev.z_index) / 2 : prev.z_index - STEP;
}

// For drag-and-drop: insert between two known siblings (either can be null
// for "at the very front/back").
export function zIndexBetween(before: ElementDTO | null, after: ElementDTO | null): number {
  if (before && after) return (before.z_index + after.z_index) / 2;
  if (before && !after) return before.z_index + STEP;
  if (!before && after) return after.z_index - STEP;
  return STEP;
}