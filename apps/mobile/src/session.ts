import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { create } from "zustand";
import { ensureOwner } from "./db";

const KEY = "streetquest.session";

export type StoredSession = {
  token: string;
  userId: string;
  email: string;
  displayName: string;
};

type SessionState = {
  ready: boolean;
  token: string | null;
  userId: string | null;
  email: string | null;
  displayName: string | null;
  hydrate: () => Promise<void>;
  signIn: (session: StoredSession) => Promise<void>;
  signOut: () => Promise<void>;
};

async function readStored(): Promise<StoredSession | null> {
  try {
    const raw =
      Platform.OS === "web"
        ? typeof window === "undefined"
          ? null
          : window.localStorage.getItem(KEY)
        : await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed.token || !parsed.userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeStored(session: StoredSession): Promise<void> {
  const raw = JSON.stringify(session);
  if (Platform.OS === "web") {
    window.localStorage.setItem(KEY, raw);
    return;
  }
  await SecureStore.setItemAsync(KEY, raw);
}

async function clearStored(): Promise<void> {
  if (Platform.OS === "web") {
    window.localStorage.removeItem(KEY);
    return;
  }
  await SecureStore.deleteItemAsync(KEY);
}

export const useSession = create<SessionState>((set) => ({
  ready: false,
  token: null,
  userId: null,
  email: null,
  displayName: null,
  async hydrate() {
    try {
      const stored = await readStored();
      if (stored) {
        await ensureOwner(stored.userId);
        set({ ready: true, ...stored });
        return;
      }
    } catch (error) {
      console.warn(error);
    }
    set({ ready: true, token: null, userId: null, email: null, displayName: null });
  },
  async signIn(session) {
    await writeStored(session);
    await ensureOwner(session.userId);
    set({ ready: true, ...session });
  },
  async signOut() {
    await clearStored();
    set({ token: null, userId: null, email: null, displayName: null });
  },
}));
