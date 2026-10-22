import { create } from "zustand";

interface UiState {
  selectedClassId: number | null;
  selectClass: (id: number | null) => void;
}

export const useUi = create<UiState>((set) => ({
  selectedClassId: null,
  selectClass: (id) => set({ selectedClassId: id }),
}));
