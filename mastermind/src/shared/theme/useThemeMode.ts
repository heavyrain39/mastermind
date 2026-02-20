import { useEffect, useState } from "react";
import { THEME_STORAGE_KEY, ThemeMode } from "./theme";

function getInitialMode(): ThemeMode {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === "light" || saved === "dark" || saved === "system") {
    return saved;
  }
  return "system";
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
