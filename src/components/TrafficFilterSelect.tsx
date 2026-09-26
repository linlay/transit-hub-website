import { IconButton } from "./IconButton";
import { ListX } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../lib/i18n";
import type { TrafficOption } from "../lib/types";

export function TrafficFilterSelect({ label, options, values, onChange }: { label: string; options: TrafficOption[]; values: string[]; onChange: (values: string[]) => void }) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const known = new Set(options.map((option) => option.id));
  const all = [...options, ...values.filter((id) => !known.has(id)).map((id) => ({ id, name: id }))];
  const matches = all.filter((option) => `${option.name} ${option.id}`.toLowerCase().includes(search.toLowerCase()));
  return <details className="traffic-filter-select">
    <summary>{t(label)} · {values.length ? `${values.length} ${t("selected")}` : t("All")}</summary>
    <div className="traffic-filter-popover">
      <div className="traffic-filter-search"><input aria-label={`${t("Search")} ${t(label)}`} placeholder={t("Search")} value={search} onChange={(event) => setSearch(event.target.value)} />
      <IconButton label={t("Clear selection")} className="icon-text" type="button" onClick={() => onChange([])}><ListX size={16} /></IconButton></div>
      <div className="traffic-filter-options">
        {matches.map((option) => <label className="mini-check" key={option.id}>
          <input type="checkbox" checked={values.includes(option.id)} disabled={!values.includes(option.id) && values.length >= 100} onChange={(event) => onChange(event.target.checked ? [...values, option.id] : values.filter((id) => id !== option.id))} />
          <span>{option.name || option.id || t("Unknown")}<small>{option.name && option.name !== option.id ? option.id : ""}</small></span>
        </label>)}
        {!matches.length ? <span>{t("No matching options")}</span> : null}
      </div>
    </div>
  </details>;
}
