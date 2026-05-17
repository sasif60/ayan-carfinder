"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ChatMessage, Listing } from "./types";

type Store = {
  postcode?: string;
  monthly?: number;
  apr?: number;
  maxPrice?: number;
  messages: ChatMessage[];
  saved: Listing[];
  setPostcode: (p: string) => void;
  setAffordability: (input: {
    monthly: number;
    apr: number;
    maxPrice: number;
  }) => void;
  appendMessage: (m: ChatMessage) => void;
  toggleSave: (l: Listing) => void;
  isSaved: (id: string) => boolean;
  reset: () => void;
};

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      postcode: undefined,
      monthly: undefined,
      apr: undefined,
      maxPrice: undefined,
      messages: [],
      saved: [],
      setPostcode: (p) => set({ postcode: p.trim().toUpperCase() }),
      setAffordability: ({ monthly, apr, maxPrice }) =>
        set({ monthly, apr, maxPrice }),
      appendMessage: (m) =>
        set((s) => ({ messages: [...s.messages, m] })),
      toggleSave: (l) =>
        set((s) => {
          const exists = s.saved.some((x) => x.id === l.id);
          return {
            saved: exists ? s.saved.filter((x) => x.id !== l.id) : [l, ...s.saved],
          };
        }),
      isSaved: (id) => get().saved.some((x) => x.id === id),
      reset: () => set({ messages: [] }),
    }),
    {
      name: "ayan-carfinder-chat",
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
