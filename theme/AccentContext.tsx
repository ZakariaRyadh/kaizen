import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

import { accentSwatches } from './colors';

const STORAGE_KEY = 'accent';

type AccentCtx = {
  accent: string;
  setAccent: (hex: string) => void;
};

const Ctx = createContext<AccentCtx>({
  accent: accentSwatches[0],
  setAccent: () => {},
});

export function AccentProvider({ children }: { children: React.ReactNode }) {
  const [accent, setAccentState] = useState(accentSwatches[0]);

  // load saved accent once on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v) setAccentState(v);
    });
  }, []);

  const setAccent = (hex: string) => {
    setAccentState(hex);
    AsyncStorage.setItem(STORAGE_KEY, hex);
  };

  return <Ctx.Provider value={{ accent, setAccent }}>{children}</Ctx.Provider>;
}

// hook every screen uses to read/set the live accent
export const useAccent = () => useContext(Ctx);

// --- helpers that mimic the design's color-mix(in srgb, accent X%, transparent)
// Expand 3/6-digit hex, append an alpha byte from a 0-100 percent.
export function withAlpha(hex: string, pct: number): string {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const a = Math.round((pct / 100) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${h}${a}`;
}
