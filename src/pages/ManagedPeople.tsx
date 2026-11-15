import { usePageActions } from "../components/Layout";
import { RefreshButton } from "../components/RefreshButton";
import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { APIKey } from "../lib/types";
import { creditsInputValue, decimalToMicro, formatCredits } from "../lib/format";
import { useI18n } from "../lib/i18n";
import { RateLimitEditor, rateLimitValue } from "../components/RateLimitEditor";
import { QueryFeedback } from "../components/QueryFeedback";
import { ManagementDialog } from "../components/ManagementDialog";
import { StatusPill } from "../components/StatusPill";

export function ManagedPeople() {
  const { t } = useI18n();
  const people = useQuery({ queryKey: ["managed-people"], queryFn: api.managedPeople });
  const [person, setPerson] = useState<APIKey | null>(null);
  usePageActions(<RefreshButton isRefreshing={people.isFetching} onClick={() => people.refetch()} />, [people.isFetching, people.refetch]);
  return <section className="page list-page enterprise-page"><section className="panel"><QueryFeedback query={people} /><div className="table-wrap"><table><thead><tr><th>{t("Name")}</th><th>{t("Status")}</th><th>{t("Cost")}</th><th>{t("Actions")}</th></tr></thead><tbody>{people.data?.items.map(row => <tr key={row.id}><td>{row.name}</td><td><StatusPill active={row.status === "active"} label={row.status === "active" ? "Active" : "Disabled"} /></td><td>{formatCredits(row.used_microcredits)}</td><td><button onClick={() => setPerson(row)}>{t("Edit personal policy")}</button></td></tr>)}{!people.isFetching && !people.data?.items.length && <tr><td colSpan={4}>{t("No assigned people")}</td></tr>}</tbody></table></div></section>{person && <PersonalPolicyDialog key={person.id} person={person} onClose={() => setPerson(null)} />}</section>;
}
function PersonalPolicyDialog({ person, onClose }: { person: APIKey; onClose: () => void }) {
  const { t } = useI18n(); const client = useQueryClient();
  const [body, setBody] = useState<Partial<APIKey>>({});
  const save = useMutation({ mutationFn: (data: Partial<APIKey>) => api.updateManagedPerson(person.id, data), onSuccess: () => { void client.invalidateQueries({ queryKey: ["managed-people"] }); onClose(); } });
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); save.mutate({ ...body, quota_microcredits: decimalToMicro(form.get("quota"), 1_000_000), rate_limits: rateLimitValue(form, "limits") }); }
  return <ManagementDialog title={`${t("Edit personal policy")} · ${person.name}`} onClose={onClose} busy={save.isPending} showCloseAction={false}><form onSubmit={submit}><label className="enterprise-field"><span>{t("Status")}</span><select defaultValue={person.status} onChange={e => setBody(old => ({ ...old, status: e.target.value as APIKey["status"] }))}><option value="active">{t("Active")}</option><option value="disabled">{t("Disabled")}</option></select></label><label className="enterprise-field"><span>{t("Total Credits (0 means unlimited)")}</span><input name="quota" type="number" min="0" step="0.000001" defaultValue={creditsInputValue(person.quota_microcredits)} /></label><label className="enterprise-field"><span>{t("Allowed models, comma-separated")}</span><input defaultValue={person.allowed_models.join(", ")} onChange={e => setBody(old => ({ ...old, allowed_models: e.target.value.split(",").map(v => v.trim()).filter(Boolean) }))} /></label><div className="table-wrap"><RateLimitEditor name="limits" initialValue={person.rate_limits} /></div>{save.error && <p role="alert" className="error-text">{save.error.message}</p>}<div className="dialog-actions"><button type="button" disabled={save.isPending} onClick={onClose}>{t("Cancel")}</button><button className="primary" disabled={save.isPending} type="submit">{t("Save")}</button></div></form></ManagementDialog>;
}
