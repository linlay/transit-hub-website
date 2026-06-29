import type { ReactNode } from "react";

type Props = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
};

export function MetricCard({ label, value, detail }: Props) {
  return (
    <section className="metric">
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      {detail ? <small className="metric-detail">{detail}</small> : null}
    </section>
  );
}
