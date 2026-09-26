import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => { const timer = setTimeout(() => setDebounced(value), delay); return () => clearTimeout(timer); }, [value, delay]);
  return debounced;
}

export function useListFilters() {
  const [params, setParams] = useSearchParams();
  function setFilters(updates: Record<string, string | null>) {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "" || value === "all") next.delete(key);
        else next.set(key, value);
      }
      return next;
    }, { replace: true });
  }
  return { params, setFilters };
}
