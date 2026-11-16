import { useControlPopover } from "./ThemedControls";
import { IconButton } from "./IconButton";
import { ListX } from "lucide-react";
import { useState, useId } from "react";
import { useI18n } from "../lib/i18n";
import type { TrafficOption } from "../lib/types";

export function TrafficFilterSelect({ label, options, values, onChange }: { label: string; options: TrafficOption[]; values: string[]; onChange: (values: string[]) => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const id = useId();
  const { anchor, popup } = useControlPopover(open, () => setOpen(false));
  const [search, setSearch] = useState("");
  const known = new Set(options.map((option) => option.id));
  const all: TrafficOption[] = [...options, ...values.filter((id) => !known.has(id)).map((id) => ({ id, name: id }))];
  const matches = all.filter((option) => `${option.name} ${option.key_prefix ?? ""} ${option.id}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="traffic-filter-select">
    <button ref={node => { anchor.current = node; }} type="button" className="traffic-filter-trigger" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(!open)}>{t(label)} · {values.length ? `${values.length} ${t("selected")}` : t("All")}</button>
    {open && <div ref={popup} id={id} {...{popover:"auto"}} role="dialog" aria-label={t(label)} className="control-popover traffic-multiselect-popover" onKeyDown={event => { if(event.key === "Escape") {event.preventDefault();event.stopPropagation();setOpen(false);anchor.current?.focus({preventScroll:true});} }}>
      <div className="traffic-filter-search"><input aria-label={`${t("Search")} ${t(label)}`} placeholder={t("Search")} value={search} onChange={(event) => setSearch(event.target.value)} />
      <IconButton label={t("Clear selection")} className="icon-text" type="button" onClick={() => onChange([])}><ListX size={16} /></IconButton></div>
      <div className="traffic-filter-options">
        {matches.map((option) => <label className="mini-check" key={option.id}>
          <input type="checkbox" checked={values.includes(option.id)} disabled={!values.includes(option.id) && values.length >= 100} onChange={(event) => onChange(event.target.checked ? [...values, option.id] : values.filter((id) => id !== option.id))} />
          <span>{option.name || option.id || t("Unknown")}<small>{option.key_prefix ? option.key_prefix : label === "API keys" ? "" : option.name && option.name !== option.id ? option.id : ""}</small></span>
        </label>)}
        {!matches.length ? <span>{t("No matching options")}</span> : null}
      </div>
    </div>}
  </div>;
}
