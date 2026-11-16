import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type SelectHTMLAttributes } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "../lib/i18n";

/** Top-layer popovers stay above modal dialogs and outside glass clipping contexts. */
export function useControlPopover(open: boolean, onClose: () => void) {
  const anchor = useRef<HTMLElement | null>(null);
  const popup = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open || !popup.current || !anchor.current) return;
    const panel = popup.current;
    const toggle = (event: Event) => { if ((event as ToggleEvent).newState === "closed") onClose(); };
    panel.addEventListener("toggle", toggle);
    panel.showPopover();
    const position = () => {
      if (!anchor.current) return;
      const rect = anchor.current.getBoundingClientRect();
      panel.style.width = `${Math.min(Math.max(rect.width, panel.classList.contains('calendar-popover') ? (matchMedia('(max-width:760px), (pointer:coarse)').matches ? 344 : 280) : panel.classList.contains('traffic-multiselect-popover') ? 320 : 160), innerWidth - 24)}px`;
      const height = panel.getBoundingClientRect().height;
      panel.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - panel.offsetWidth - 12))}px`;
      panel.style.top = `${Math.max(12, rect.bottom + height + 8 > innerHeight ? rect.top - height - 4 : rect.bottom + 4)}px`;
    };
    position();
    window.addEventListener('resize', position);
    // Focus can scroll a dialog; reposition instead of dismissing the user's menu.
    window.addEventListener('scroll', position, true);
    return () => { panel.removeEventListener('toggle', toggle); if (panel.matches(':popover-open')) panel.hidePopover(); window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true); };
  }, [open]);
  return { anchor, popup };
}

/** Preserve native form values, validity, disabled fieldsets and React change events. */
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const id = useId();
  const select = useRef<HTMLSelectElement | null>(null);
  const { anchor, popup } = useControlPopover(open, () => setOpen(false));
  const options = Array.from(select.current?.options ?? []);
  const search = useRef({ text: '', at: 0 });
  function show() {
    if (!select.current || select.current.matches(':disabled')) return;
    setActive(Math.max(0, select.current.selectedIndex)); setOpen(true);
  }
  function choose(index: number) {
    const node = select.current;
    if (!node || !node.options[index] || node.options[index].disabled || node.matches(':disabled')) return;
    node.value = node.options[index].value;
    node.dispatchEvent(new Event('change', { bubbles: true }));
    setOpen(false); node.focus({ preventScroll: true });
  }
  useEffect(() => { if (open) popup.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }); }, [active, open, popup]);
  return <>
    <select {...props} ref={node => { select.current = node; anchor.current = node; }} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id : undefined} aria-activedescendant={open ? `${id}-${active}` : undefined}
      onMouseDown={event => { props.onMouseDown?.(event); if (!event.defaultPrevented && event.button === 0) { event.preventDefault(); event.currentTarget.focus(); } }}
      onClick={event => { props.onClick?.(event); if (!event.defaultPrevented) { event.preventDefault(); open ? setOpen(false) : show(); } }}
      onBlur={event => { props.onBlur?.(event); if (!popup.current?.contains(event.relatedTarget)) setOpen(false); }}
      onKeyDown={event => {
        props.onKeyDown?.(event); if (event.defaultPrevented) return;
        if (event.key === 'Tab') { setOpen(false); return; }
        if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); return; }
        if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) {
          event.preventDefault(); if (!open) { show(); return; }
          if (event.key === 'Enter' || event.key === ' ') { choose(active); return; }
          const enabled = options.map((o, i) => !o.disabled ? i : -1).filter(i => i >= 0);
          const pos = enabled.indexOf(active);
          setActive(event.key === 'Home' ? enabled[0] : event.key === 'End' ? enabled[enabled.length - 1] : enabled[Math.max(0, Math.min(enabled.length - 1, pos + (event.key === 'ArrowDown' ? 1 : -1)))] ?? 0);
        } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
          event.preventDefault(); const now = Date.now(); search.current.text = (now - search.current.at < 700 ? search.current.text : '') + event.key.toLocaleLowerCase(); search.current.at = now;
          const index = options.findIndex(o => !o.disabled && o.text.toLocaleLowerCase().startsWith(search.current.text));
          if (!open) show(); if (index >= 0) setActive(index);
        }
      }} />
    {open && <div ref={popup} {...{ popover: 'auto' }} id={id} role="listbox" aria-label={props['aria-label']} aria-labelledby={props['aria-labelledby']} className="control-popover" onMouseDown={e => e.preventDefault()} onClick={e => { e.preventDefault(); e.stopPropagation(); }}>
      {options.map((option, index) => <div key={index} role="option" id={`${id}-${index}`} aria-selected={option.selected} aria-disabled={option.disabled} data-active={active === index} onMouseMove={() => !option.disabled && setActive(index)} onClick={() => choose(index)}>{option.text}</div>)}
    </div>}
  </>;
}

function dayValue(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function parseDay(value: string) { const [y, m, d] = value.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d, 12); }

/** Dates remain local calendar strings; existing callers own range/time-zone conversion. */
export function DateInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { locale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const value = String(props.value ?? props.defaultValue ?? '');
  const [cursor, setCursor] = useState(() => value && !Number.isNaN(parseDay(value).getTime()) ? parseDay(value) : new Date());
  const input = useRef<HTMLInputElement>(null);
  const { anchor, popup } = useControlPopover(open, () => setOpen(false));
  const id = useId();
  const [invalid, setInvalid] = useState(false);
  const timed = props.type === 'datetime-local';
  const day = value.slice(0, 10);
  const min = String(props.min ?? '').slice(0, 10), max = String(props.max ?? '').slice(0, 10);
  function commit(date: Date) {
    const next = dayValue(date) + (timed ? `T${value.split('T')[1] || '00:00'}` : '');
    const node = input.current!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(node, next);
    node.dispatchEvent(new Event('input', { bubbles: true }));
    setOpen(false); node.focus({ preventScroll: true });
  }
  useEffect(() => {
    const node = input.current; if (!node) return;
    const valid = !value || (timed ? /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/ : /^\d{4}-\d{2}-\d{2}$/).test(value) && !Number.isNaN(parseDay(value).getTime()) && dayValue(parseDay(value)) === day && (!props.min || value >= String(props.min)) && (!props.max || value <= String(props.max));
    setInvalid(!valid);
    node.setCustomValidity(valid ? '' : t('Choose a valid start and end date'));
  }, [value, day, timed, props.min, props.max, t]);
  useEffect(() => { if (open) popup.current?.querySelector<HTMLButtonElement>('[tabindex="0"]')?.focus({ preventScroll: true }); }, [open, cursor, popup]);
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1, 12);
  const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  function move(amount: number) { const next = new Date(cursor); next.setDate(next.getDate() + amount); setCursor(next); }
  return <span className="date-field"><span className="date-control" ref={node => { anchor.current = node; }}>
    <input {...props} ref={input} aria-invalid={invalid || props["aria-invalid"]} aria-describedby={[props["aria-describedby"], invalid ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined} type="text" placeholder={props.placeholder ?? (timed ? 'YYYY-MM-DDTHH:mm' : 'YYYY-MM-DD')} onKeyDown={event => { props.onKeyDown?.(event); if (event.altKey && event.key === 'ArrowDown') { event.preventDefault(); setCursor(value && !Number.isNaN(parseDay(value).getTime()) ? parseDay(value) : new Date()); setOpen(true); } }} />
    <button type="button" className="date-trigger" disabled={props.disabled || props.readOnly} aria-label={t('Calendar')} aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => { setCursor(value && !Number.isNaN(parseDay(value).getTime()) ? parseDay(value) : new Date()); setOpen(!open); }}><CalendarDays size={16}/></button>
    {open && <div id={id} ref={popup} {...{ popover: 'auto' }} className="control-popover calendar-popover" role="dialog" aria-label={t('Calendar')} onKeyDown={event => {
      const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -cursor.getDay(), End: 6 - cursor.getDay() };
      if (event.key in offsets) { event.preventDefault(); move(offsets[event.key]); }
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); input.current?.focus({ preventScroll: true }); }
    }}>
      <div className="calendar-heading"><button type="button" aria-label={t('Previous month')} onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1, 12))}><ChevronLeft size={16}/></button><strong aria-live="polite">{new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(cursor)}</strong><button type="button" aria-label={t('Next month')} onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1, 12))}><ChevronRight size={16}/></button></div>
      <div className="calendar-grid">{Array.from({ length: 7 }, (_, i) => <span key={`w${i}`}>{new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2026, 10, 15 + i))}</span>)}{Array.from({ length: first.getDay() }, (_, i) => <span key={`s${i}`}/>)}{Array.from({ length: days }, (_, i) => { const date = new Date(cursor.getFullYear(), cursor.getMonth(), i + 1, 12), iso = dayValue(date); return <button key={iso} type="button" tabIndex={i + 1 === cursor.getDate() ? 0 : -1} aria-label={new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(date)} aria-pressed={iso === day} aria-current={iso === dayValue(new Date()) ? 'date' : undefined} disabled={!!(min && iso < min || max && iso > max)} onClick={() => commit(date)}>{i + 1}</button>; })}</div>
      <button type="button" className="calendar-today" disabled={!!(min && dayValue(new Date()) < min || max && dayValue(new Date()) > max)} onClick={() => commit(new Date())}>{t('Today')}</button>
    </div>}
  </span>{invalid && <small className="error-text" id={`${id}-error`}>{t("Choose a valid start and end date")}</small>}</span>;
}
