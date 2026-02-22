import { useMemo } from "react";

export type UiLocale = "ko" | "en" | "pt" | "ja";

export function useUiLocale(): UiLocale {
  return useMemo(() => detectUiLocale(), []);
}

function detectUiLocale(): UiLocale {
  if (typeof navigator === "undefined") {
    return "en";
  }

  const candidates = [...(navigator.languages ?? []), navigator.language].filter(Boolean);

  if (candidates.some((language) => language.toLowerCase().startsWith("ko"))) {
    return "ko";
  }
  if (candidates.some((language) => language.toLowerCase().startsWith("pt"))) {
    return "pt";
  }
  if (candidates.some((language) => language.toLowerCase().startsWith("ja"))) {
    return "ja";
  }

  return "en";
}
