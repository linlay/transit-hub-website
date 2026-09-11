import { ReactNode, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";

type Action = { label: string; icon: ReactNode; onSelect: () => void; danger?: boolean };

export function RowActions({ label, items }: { label: string; items: Action[] }) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();

  function close(restoreFocus = false) {
    setPosition(null);
    if (restoreFocus) trigger.current?.focus();
  }

  function open() {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const height = items.length * 36 + 12;
    setPosition({
      left: Math.max(8, Math.min(rect.right - 172, window.innerWidth - 180)),
      top: rect.bottom + height + 8 > window.innerHeight ? Math.max(8, rect.top - height - 4) : rect.bottom + 4,
    });
  }

  useEffect(() => {
    if (!position) return;
    menu.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function outside(event: PointerEvent) {
      if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) close();
    }
    function dismiss() { close(); }
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [position]);

  return (
    <>
      <button ref={trigger} className="row-actions-trigger" type="button" aria-label={label} title={label} aria-haspopup="menu" aria-expanded={Boolean(position)} aria-controls={position ? id : undefined}
        onClick={() => position ? close() : open()}
        onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); open(); } }}>
        <MoreHorizontal size={18} />
      </button>
      {position ? createPortal(
        <div ref={menu} id={id} role="menu" aria-label={label} className="row-actions-menu" style={position}
          onKeyDown={(event) => {
            if (event.key === "Escape") { event.preventDefault(); close(true); }
            if (event.key === "Tab") { event.preventDefault(); close(true); }
            const buttons = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
            const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
            if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
              event.preventDefault();
              const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
              buttons[next]?.focus();
            }
          }}>
          {items.map((item) => <button key={item.label} role="menuitem" type="button" className={item.danger ? "danger" : ""} onClick={() => { close(true); item.onSelect(); }}>{item.icon}{item.label}</button>)}
        </div>, document.body,
      ) : null}
    </>
  );
}
