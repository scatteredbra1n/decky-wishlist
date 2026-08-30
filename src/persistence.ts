import { WishlistItem } from "./types";

export type WishlistPrefs = {
  sortIndex: number;
  onSaleOnly: boolean;
};

export type WishlistSession = {
  items: WishlistItem[];
  count: number;
  error: string | null;
  message: string | null;
  loadedOnce: boolean;
};

const PREFS_KEY = "decky-wishlist.prefs";

const DEFAULT_PREFS: WishlistPrefs = {
  sortIndex: 0,
  onSaleOnly: false,
};

let memoryPrefs: WishlistPrefs = { ...DEFAULT_PREFS };
let memorySession: WishlistSession = {
  items: [],
  count: 0,
  error: null,
  message: null,
  loadedOnce: false,
};

function clampSortIndex(value: unknown): number {
  const index = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(index) || index < 0) return 0;
  return Math.floor(index);
}

export function loadPrefs(maxSortIndex: number): WishlistPrefs {
  let loaded = { ...memoryPrefs };
  try {
    const raw = window.localStorage?.getItem(PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<WishlistPrefs>;
      loaded = {
        sortIndex: clampSortIndex(parsed.sortIndex),
        onSaleOnly: Boolean(parsed.onSaleOnly),
      };
    }
  } catch {
    // Keep memory/defaults if localStorage is unavailable.
  }

  if (loaded.sortIndex > maxSortIndex) {
    loaded.sortIndex = 0;
  }

  memoryPrefs = loaded;
  return { ...loaded };
}

export function savePrefs(prefs: WishlistPrefs): void {
  memoryPrefs = {
    sortIndex: clampSortIndex(prefs.sortIndex),
    onSaleOnly: Boolean(prefs.onSaleOnly),
  };
  try {
    window.localStorage?.setItem(PREFS_KEY, JSON.stringify(memoryPrefs));
  } catch {
    // Memory cache still keeps QAM open/close seamless.
  }
}

export function getSession(): WishlistSession {
  return {
    items: memorySession.items,
    count: memorySession.count,
    error: memorySession.error,
    message: memorySession.message,
    loadedOnce: memorySession.loadedOnce,
  };
}

export function setSession(partial: Partial<WishlistSession>): void {
  memorySession = {
    ...memorySession,
    ...partial,
    items: partial.items ? [...partial.items] : memorySession.items,
  };
}
