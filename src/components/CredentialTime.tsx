import { useI18n } from "../lib/i18n";
import { dateTime } from "../lib/format";

export function CredentialTime({ value }: { value?: string }) {
  const { locale } = useI18n();
  if (!value) return <span className="muted-cell">{dateTime(value)}</span>;
  const date = new Date(value);
  return (
    <time dateTime={value} title={date.toLocaleString(locale)}>
      <span>{date.toLocaleDateString(locale, { month: "2-digit", day: "2-digit" })}</span>
      <small>{date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</small>
    </time>
  );
}
