"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ChatMessage } from "./types";

type Store = {
  postcode?: string;
  messages: ChatMessage[];
  setPostcode: (p: string) => void;
  appendMessage: (m: ChatMessage) => void;
  reset: () => void;
};

export const useStore = create<Store>()(
  persist(
    (set) => ({
      postcode: undefined,
      messages: [],
      setPostcode: (p) => set({ postcode: p.trim().toUpperCase() }),
      appendMessage: (m) =>
        set((s) => ({ messages: [...s.messages, m] })),
      reset: () => set({ messages: [] }),
    }),
    {
      name: "ayan-carfinder-chat",
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
