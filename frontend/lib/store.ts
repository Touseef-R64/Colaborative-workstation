import { create } from "zustand";
import { ElementDTO } from "./api";

interface CursorState {
  x: number;
  y: number;
  user: string;
}

interface BoardState {
  elements: Record<string, ElementDTO>;
  cursors: Record<string, CursorState>;
  lockedBy: Record<string, string>;

  setElements: (elements: ElementDTO[]) => void;
  upsertElement: (element: ElementDTO) => void;
  removeElement: (id: string) => void;
  setCursor: (user: string, x: number, y: number) => void;
  lockElement: (id: string, user: string) => void;
  unlockElement: (id: string) => void;
}

export const useBoardStore = create<BoardState>((set) => ({
  elements: {},
  cursors: {},
  lockedBy: {},

  setElements: (elements) =>
    set({
      elements: Object.fromEntries(elements.map((el) => [el.id, el])),
    }),

  upsertElement: (element) =>
    set((state) => ({
      elements: { ...state.elements, [element.id]: { ...state.elements[element.id], ...element } },
    })),

  removeElement: (id) =>
    set((state) => {
      const { [id]: _removed, ...rest } = state.elements;
      return { elements: rest };
    }),

  setCursor: (user, x, y) =>
    set((state) => ({
      cursors: { ...state.cursors, [user]: { x, y, user } },
    })),

  lockElement: (id, user) =>
    set((state) => ({ lockedBy: { ...state.lockedBy, [id]: user } })),

  unlockElement: (id) =>
    set((state) => {
      const { [id]: _removed, ...rest } = state.lockedBy;
      return { lockedBy: rest };
    }),
}));
