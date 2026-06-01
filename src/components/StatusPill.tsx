export function StatusPill({ active, label }: { active: boolean; label?: string }) {
  return <span className={`pill ${active ? "good" : "muted"}`}>{label ?? (active ? "Active" : "Inactive")}</span>;
}
