"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ChatMessage } from "./types";

type Store = {
  postcode?: string;
  monthly?: number;
  apr?: number;
  maxPrice?: number;
  messages: ChatMessage[];
  setPostcode: (p: string) => void;
  setAffordability: (input: {
    monthly: number;
    apr: number;
    maxPrice: number;
  }) => void;
  appendMessage: (m: ChatMessage) => void;
  reset: () => void;
};

export const useStore = create<Store>()(
  persist(
    (set) => ({
      postcode: undefined,
      monthly: undefined,
      apr: undefined,
      maxPrice: undefined,
      messages: [],
      setPostcode: (p) => set({ postcode: p.trim().toUpperCase() }),
      setAffordability: ({ monthly, apr, maxPrice }) =>
        set({ monthly, apr, maxPrice }),
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
