import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

export interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  value: string;
  options: DropdownOption[];
  onChange: (next: string) => void;
  ariaLabel: string;
  disabled?: boolean;
  /** Optional map of option value → tooltip text. */
  tooltips?: Record<string, string>;
}

export function Dropdown({ value, options, onChange, ariaLabel, disabled = false, tooltips }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? options[0],
    [options, value]
  );

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  // Compute fixed position for the menu based on trigger's viewport rect
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const menuEstimatedHeight = options.length * 32 + 2; // rough estimate
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom - 4;
    const openUpward = spaceBelow < menuEstimatedHeight && rect.top > spaceBelow;

    setMenuStyle({
      position: "fixed",
      zIndex: 50,
      right: `${window.innerWidth - rect.right}px`,
      minWidth: `${rect.width}px`,
      ...(openUpward
        ? { bottom: `${viewportHeight - rect.top + 4}px` }
        : { top: `${rect.bottom + 4}px` })
    });
  }, [open, options.length]);

  const triggerTooltip = tooltips?.[value] ?? undefined;
  const hasTooltips = !!tooltips;

  return (
    <div className={`dropdown ${open ? "is-open" : ""}`} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="dropdown-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        data-tooltip={!open ? triggerTooltip : undefined}
        data-tooltip-position={!open && hasTooltips ? "left" : undefined}
      >
        <span>{selected?.label ?? ""}</span>
        <span className="dropdown-caret" aria-hidden>
          v
        </span>
      </button>

      {open ? (
        <ul className="dropdown-menu" role="listbox" style={menuStyle}>
          {options.map((option) => {
            const isActive = option.value === value;
            const optionTooltip = tooltips?.[option.value] ?? undefined;
            return (
              <li key={option.value} role="option" aria-selected={isActive}>
                <button
                  type="button"
                  className={`dropdown-item ${isActive ? "is-active" : ""}`}
                  data-tooltip={optionTooltip}
                  data-tooltip-position={optionTooltip ? "left" : undefined}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
