import { useEffect, useState } from "react";
import { LEGACY_THEME_STORAGE_KEY, THEME_STORAGE_KEY, ThemeMode } from "./theme";

function readStoredThemeMode(): ThemeMode | null {
  const current = localStorage.getItem(THEME_STORAGE_KEY);
  if (current === "light" || current === "dark" || current === "system") {
    return current;
  }

  const legacy = localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
  if (legacy === "light" || legacy === "dark" || legacy === "system") {
    localStorage.setItem(THEME_STORAGE_KEY, legacy);
    return legacy;
  }

  return null;
}

function getInitialMode(): ThemeMode {
  return readStoredThemeMode() ?? "system";
}

export function useThemeMode() {
  const [mode, setMode] = useState<ThemeMode>(getInitialMode);
  const [effectiveMode, setEffectiveMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    if (mode === "light" || mode === "dark") {
      setEffectiveMode(mode);
      document.documentElement.dataset.themeMode = mode;
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applySystem = () => {
      const next = media.matches ? "dark" : "light";
      setEffectiveMode(next);
      document.documentElement.dataset.themeMode = next;
    };

    applySystem();
    media.addEventListener("change", applySystem);
    return () => media.removeEventListener("change", applySystem);
  }, [mode]);

  return { mode, setMode, effectiveMode };
}
