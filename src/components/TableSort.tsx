import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { type ReactNode, useState } from "react";

type Direction = "asc" | "desc";
export type TableSort<K extends string> = { key: K; dir: Direction };
type SortValue = number | bigint | string | Date | null | undefined;

export function nextTableSort<K extends string>(sort: TableSort<K> | null, key: K, firstDirection: Direction = "desc"): TableSort<K> | null {
  if (sort?.key !== key) return { key, dir: firstDirection };
  if (sort.dir !== firstDirection) return null;
  return { key, dir: firstDirection === "asc" ? "desc" : "asc" };
}

export function readTableSort<K extends string>(params: URLSearchParams, keys: readonly K[], firstDirection: Direction = "desc"): TableSort<K> | null {
  const key = keys.find(key => key === params.get("sort"));
  const dir = params.get("dir");
  return key === undefined ? null : { key, dir: dir === "asc" || dir === "desc" ? dir : firstDirection };
}

export function useTableSort<K extends string>() {
  const [sort, setSort] = useState<TableSort<K> | null>(null);
  function toggleSort(key: K, firstDirection?: Direction) {
    setSort(previous => nextTableSort(previous, key, firstDirection));
  }
  return [sort, toggleSort] as const;
}

function normalizeSortValue(value: SortValue) {
  const parsed = value instanceof Date ? value.getTime() : value;
  return typeof parsed === "number" && !Number.isFinite(parsed) ? undefined : parsed;
}

export function sortRows<T, K extends string>(rows: readonly T[], sort: TableSort<K> | null, value: (row: T, key: K) => SortValue): readonly T[] {
  if (!sort) return rows;
  return rows.map(row => ({ row, value: normalizeSortValue(value(row, sort.key)) }))
    .sort(({ value: a }, { value: b }) => {
      if (a == null) return b == null ? 0 : 1;
      if (b == null) return -1;
      const comparison = typeof a === "string" && typeof b === "string" ? a.localeCompare(b) : a < b ? -1 : a > b ? 1 : 0;
      return sort.dir === "asc" ? comparison : -comparison;
    })
    .map(item => item.row);
}

export function SortHeader<K extends string>({ sort, sortKey, onSort, firstDirection = "desc", title, className, hint, children }: {
  sort: TableSort<K> | null;
  sortKey: K;
  onSort: (key: K, firstDirection: Direction) => void;
  firstDirection?: Direction;
  title?: string;
  className?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  const direction = sort?.key === sortKey ? sort.dir : undefined;
  const Icon = direction === "asc" ? ArrowUp : direction === "desc" ? ArrowDown : ArrowUpDown;
  return <th scope="col" className={className ? `sortable ${className}` : "sortable"} aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : undefined}>
    <button className="sort-header" type="button" title={title} onClick={() => onSort(sortKey, firstDirection)}>
      {children}<Icon size={14} aria-hidden="true" />
    </button>
    {hint}
  </th>;
}
