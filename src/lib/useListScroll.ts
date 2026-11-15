import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

type Position = { x: number; y: number; tables: { x: number; y: number }[] };
const positions = new Map<string, Position>();

/** Restore list position after cached or freshly fetched rows are mounted. */
export function useListScroll(ready: boolean) {
  const { pathname } = useLocation();
  const restored = useRef(false);
  useLayoutEffect(() => {
    if (!ready || restored.current) return;
    restored.current = true;
    const position = positions.get(pathname);
    if (!position) return;
    document.querySelector<HTMLElement>(".main-content")?.scrollTo(position.x, position.y);
    document.querySelectorAll<HTMLElement>(".page .table-wrap").forEach((table, index) => {
      const saved = position.tables[index];
      if (saved) table.scrollTo(saved.x, saved.y);
    });
  }, [ready, pathname]);
  useEffect(() => {
    function save() {
      if (!restored.current) return;
      const content = document.querySelector<HTMLElement>(".main-content");
      positions.set(pathname, { x: content?.scrollLeft ?? 0, y: content?.scrollTop ?? 0, tables: Array.from(document.querySelectorAll<HTMLElement>(".page .table-wrap"), table => ({ x: table.scrollLeft, y: table.scrollTop })) });
    }
    window.addEventListener("scroll", save, true);
    return () => window.removeEventListener("scroll", save, true);
  }, [pathname]);
}
