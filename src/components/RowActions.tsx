import { ReactNode, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import { IconButton } from "./IconButton";

type Action = { label: string; icon: ReactNode; onSelect: () => void; danger?: boolean };

export function RowActions({ label, items }: { label: string; items: Action[] }) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const anchorRect = useRef<DOMRect | null>(null);
  const id = useId();

  function close(restoreFocus = false) {
    setPosition(null);
    if (restoreFocus) trigger.current?.focus({ preventScroll: true });
  }

  function open() {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    anchorRect.current = rect;
    const columns = Math.min(4, items.length);
    const size = window.matchMedia("(pointer: coarse)").matches ? 44 : 36;
    const width = columns * size + 10;
    const height = Math.ceil(items.length / columns) * size + 10;
    setPosition({
      left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
      top: rect.bottom + height + 8 > window.innerHeight ? Math.max(8, rect.top - height - 4) : rect.bottom + 4,
    });
  }

  useEffect(() => {
    if (!position) return;
    menu.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    function outside(event: PointerEvent) {
      if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) close();
    }
    function dismiss() { close(); }
    function onScroll() {
      const rect = trigger.current?.getBoundingClientRect();
      const previous = anchorRect.current;
      // Focusing a pinned cell can scroll its table without moving the anchor.
      if (!rect || !previous || Math.abs(rect.top - previous.top) > 1 || Math.abs(rect.left - previous.left) > 1) close();
    }
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [position]);

  return (
    <>
      <button ref={trigger} className="row-actions-trigger" type="button" aria-label={label} data-tooltip={label} aria-haspopup="menu" aria-expanded={Boolean(position)} aria-controls={position ? id : undefined}
        onClick={() => position ? close() : open()}
        onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); open(); } }}>
        <MoreHorizontal size={18} />
      </button>
      {position ? createPortal(
        <div ref={menu} id={id} role="menu" aria-label={label} className="row-actions-menu" style={{ ...position, gridTemplateColumns: `repeat(${Math.min(4, items.length)}, max-content)` }}
          onKeyDown={(event) => {
            if (event.key === "Escape") { event.preventDefault(); close(true); }
            if (event.key === "Tab") { event.preventDefault(); close(true); }
            const buttons = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
            const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
            if (["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
              event.preventDefault();
              const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (current + (["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : -1) + buttons.length) % buttons.length;
              buttons[next]?.focus({ preventScroll: true });
            }
          }}>
          {items.map((item) => <IconButton key={item.label} label={item.label} role="menuitem" type="button" className={item.danger ? "icon-button danger" : "icon-button"} onClick={() => { close(true); item.onSelect(); }}>{item.icon}</IconButton>)}
        </div>, document.body,
      ) : null}
    </>
  );
}
