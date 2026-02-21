import { useEffect, useMemo, useState } from "react";

type TooltipPosition = "bottom" | "left" | "top";

interface TooltipState {
  text: string;
  x: number;
  y: number;
  visible: boolean;
  position: TooltipPosition;
}

const PADDING = 12;

export function TooltipLayer() {
  const [tooltip, setTooltip] = useState<TooltipState>({
    text: "",
    x: 0,
    y: 0,
    visible: false,
    position: "bottom"
  });

  useEffect(() => {
    const showTooltip = (target: HTMLElement) => {
      const text = target.getAttribute("data-tooltip");
      if (!text) return;

      const position =
        (target.getAttribute("data-tooltip-position") as TooltipPosition) ?? "bottom";
      const rect = target.getBoundingClientRect();

      let x: number;
      let y: number;

      if (position === "left") {
        x = rect.left - 12;
        y = rect.top + rect.height / 2;
      } else if (position === "top") {
        x = Math.min(window.innerWidth - PADDING, Math.max(PADDING, rect.left + rect.width / 2));
        y = rect.top - 10;
      } else {
        // Default "bottom" with auto-flip
        const preferredY = rect.bottom + 10;
        const fallbackY = rect.top - 10;
        const viewportHeight = window.innerHeight;
        y = preferredY > viewportHeight - 120 ? fallbackY : preferredY;
        x = Math.min(window.innerWidth - PADDING, Math.max(PADDING, rect.left + rect.width / 2));
      }

      setTooltip({ text, x, y, visible: true, position });
    };

    const hideTooltip = () => {
      setTooltip((prev) => ({ ...prev, visible: false }));
    };

    const onMouseOver = (event: MouseEvent) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-tooltip]");
      if (target) showTooltip(target);
    };

    const onMouseOut = (event: MouseEvent) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-tooltip]");
      if (!target) return;
      const related = event.relatedTarget as Node | null;
      if (related && target.contains(related)) return;
      hideTooltip();
    };

    const onFocusIn = (event: FocusEvent) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-tooltip]");
      if (target) showTooltip(target);
    };

    const onFocusOut = () => {
      hideTooltip();
    };

    window.addEventListener("mouseover", onMouseOver, true);
    window.addEventListener("mouseout", onMouseOut, true);
    window.addEventListener("focusin", onFocusIn, true);
    window.addEventListener("focusout", onFocusOut, true);
    window.addEventListener("scroll", hideTooltip, true);

    return () => {
      window.removeEventListener("mouseover", onMouseOver, true);
      window.removeEventListener("mouseout", onMouseOut, true);
      window.removeEventListener("focusin", onFocusIn, true);
      window.removeEventListener("focusout", onFocusOut, true);
      window.removeEventListener("scroll", hideTooltip, true);
    };
  }, []);

  const isLeft = tooltip.position === "left";
  const isTop = tooltip.position === "top";

  const style = useMemo(
    () => ({
      left: `${tooltip.x}px`,
      top: `${tooltip.y}px`,
      opacity: tooltip.visible ? 1 : 0,
      transform: isLeft
        ? `translate(-100%, -50%) translateX(${tooltip.visible ? "0" : "4px"})`
        : isTop
          ? `translate(-50%, -100%) translateY(${tooltip.visible ? "0" : "-4px"})`
          : `translate(-50%, ${tooltip.visible ? "0" : "4px"})`,
      maxWidth: isLeft ? "380px" : "320px"
    }),
    [tooltip, isLeft, isTop]
  );

  return (
    <div className="floating-tooltip" style={style} aria-hidden={!tooltip.visible}>
      {tooltip.text}
    </div>
  );
}
