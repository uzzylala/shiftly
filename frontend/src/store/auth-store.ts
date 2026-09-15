import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthTokens, AuthUser } from "@shiftly/shared";

interface AuthState {
  user: AuthUser | null;
  tokens: AuthTokens | null;
  setSession: (user: AuthUser, tokens: AuthTokens) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tokens: null,
      setSession: (user, tokens) => set({ user, tokens }),
      clearSession: () => set({ user: null, tokens: null }),
    }),
    { name: "shiftly-auth" },
  ),
);
