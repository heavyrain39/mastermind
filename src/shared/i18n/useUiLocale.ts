import { useMemo } from "react";

export type UiLocale = "ko" | "en";

export function useUiLocale(): UiLocale {
  return useMemo(() => detectUiLocale(), []);
}

function detectUiLocale(): UiLocale {
  if (typeof navigator === "undefined") {
    return "en";
  }

  const candidates = [...(navigator.languages ?? []), navigator.language].filter(Boolean);
  return candidates.some((language) => language.toLowerCase().startsWith("ko")) ? "ko" : "en";
}
