import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** One tooltip layer for all icon actions, including actions inside modal dialogs. */
export function TooltipProvider({ children }: { children: ReactNode }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const tooltip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function hide() { clearTimeout(timer); setAnchor(null); }
    function target(event: Event) { return event.target instanceof Element ? event.target.closest<HTMLElement>("[data-tooltip]") : null; }
    function hover(event: PointerEvent) { if (event.pointerType === "touch") return; const next = target(event); clearTimeout(timer); if (next) timer = setTimeout(() => setAnchor(next), 350); else hide(); }
    function focus(event: FocusEvent) { clearTimeout(timer); setAnchor(target(event)); }
    function key(event: KeyboardEvent) { if (event.key === "Escape") hide(); }
    document.addEventListener("pointerover", hover);
    document.addEventListener("pointerout", hide);
    document.addEventListener("focusin", focus);
    document.addEventListener("focusout", hide);
    document.addEventListener("pointerdown", hide);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerover", hover); document.removeEventListener("pointerout", hide);
      document.removeEventListener("focusin", focus); document.removeEventListener("focusout", hide);
      document.removeEventListener("pointerdown", hide); document.removeEventListener("keydown", key);
      window.removeEventListener("scroll", hide, true); window.removeEventListener("resize", hide);
    };
  }, []);
  useLayoutEffect(() => {
    const node = tooltip.current;
    if (!node || !anchor?.isConnected) return;
    // Top-layer popovers remain visible over native modal dialogs and clipped tables.
    node.setAttribute("popover", "manual");
    node.showPopover?.();
    const rect = anchor.getBoundingClientRect();
    const size = node.getBoundingClientRect();
    node.style.left = `${Math.max(8, Math.min(rect.left + (rect.width - size.width) / 2, innerWidth - size.width - 8))}px`;
    node.style.top = `${rect.top >= size.height + 12 ? rect.top - size.height - 8 : rect.bottom + 8}px`;
    const observer = new MutationObserver(() => { if (!anchor.isConnected) setAnchor(null); });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { observer.disconnect(); if (node.matches(":popover-open")) node.hidePopover(); };
  }, [anchor]);
  return <>{children}{anchor?.isConnected ? createPortal(<div ref={tooltip} className="ui-tooltip" role="tooltip">{anchor.dataset.tooltip}</div>, document.body) : null}</>;
}
