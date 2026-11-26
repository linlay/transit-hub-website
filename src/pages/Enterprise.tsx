import { SortHeader, useTableSort } from "../components/TableSort";
import { Select, DateInput } from "../components/ThemedControls";
import { useI18n } from "../lib/i18n";
import { enterpriseColumnLabels, enterpriseValueLabel, enterpriseCellValue } from "../lib/enterprise-labels";
import { FormEvent, ReactNode, ReactElement, cloneElement, isValidElement, useId, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { enterpriseRequest as request, credits, microcredits, type Organization, type ProviderDocument, type Row } from "../lib/enterprise";
import { API_BASE_URL } from "../lib/env";
import { ProviderDocumentForm } from "../components/ProviderDocumentForm";
import { parse as parseYAML, stringify as stringifyYAML } from "yaml";
import { QueryFeedback } from "../components/QueryFeedback";
import { ManagementDialog } from "../components/ManagementDialog";
import { usePageActions } from "../components/Layout";
import { RefreshButton } from "../components/RefreshButton";

function ErrorText({ error }: { error: unknown }) { const {t}=useI18n(); return error ? <p className="error-text" role="alert">{t(error instanceof Error ? error.message : String(error))}</p> : null; }
function Field({ label, children }: { label: string; children: ReactNode }) {
  const id=useId();
  return <label className="enterprise-field"><span id={id}>{label}</span>{isValidElement(children) ? cloneElement(children as ReactElement<Record<string, unknown>>, { "aria-labelledby": id }) : children}</label>;
}
function DataTable({ items, columns, renderHeader }: { items: Row[]; columns: string[]; renderHeader?: (column: string) => ReactNode }) {
  const { t } = useI18n();

  return <div className="table-wrap"><table><thead><tr>{columns.map(k => renderHeader?.(k) ?? <th key={k}>{t(enterpriseColumnLabels[k] ?? k)}</th>)}</tr></thead><tbody>{items.map((row, i) => <tr key={String(row.id ?? i)}>{columns.map(k => <td key={k}>{k.endsWith("_microcredits") ? credits(row[k]) : enterpriseCellValue(k, row[k], t)}</td>)}</tr>)}{!items.length && <tr><td colSpan={columns.length} className="muted-cell">{t("No records yet")}</td></tr>}</tbody></table></div>;
}
function useRole() { const me = useQuery({ queryKey: ["me"], queryFn: api.me }); return me.data?.role ?? "super_admin"; }
function useWrite() {
  const client = useQueryClient();
  return useMutation({ mutationFn: (v: { path: string; method?: string; body: Row }) => request<Row>(v.path, v.method ?? "POST", v.body), onSuccess: (_, v) => { if (v.body.dry_run === false) void client.invalidateQueries(); } });
}
function MutationResult({ mutation }: { mutation: ReturnType<typeof useWrite> }) {
  const { t } = useI18n();

  return <><ErrorText error={mutation.error} />{mutation.data && <div className="enterprise-result" role="status">{mutation.data.applied === false ? t("Preview ready. Review the changes, then apply.") : t("Operation completed.")}<details><summary>{t("View result")}</summary><pre>{JSON.stringify(mutation.data, null, 2)}</pre></details></div>}</>;
}
function WriteButtons({ pending, preview, apply, enabled = true }: { pending: boolean; preview: () => void; apply: () => void; enabled?: boolean }) {
  const { t } = useI18n();

  return <div className="enterprise-actions"><button type="button" disabled={pending || !enabled} onClick={preview}>{t("Preview changes")}</button><button type="button" className="primary" disabled={pending || !enabled} onClick={apply}>{pending ? t("Processing...") : t("Apply changes")}</button></div>;
}

export function Organizations() {
  const { t } = useI18n();
  const [dialog, setDialog] = useState<"create" | "members" | null>(null);

  const role = useRole(); const orgs = useQuery({ queryKey: ["organizations"], queryFn: () => request<{ items: Organization[] }>("/admin/virtual-orgs") });
  const [department,setDepartment]=useState("");const [includeSubdepartments,setIncludeSubdepartments]=useState(false); const departments=useQuery({queryKey:["departments"],queryFn:()=>request<{items:Row[]}>("/admin/departments"),enabled:role==="super_admin"});
  const [code, setCode] = useState(""); const [name, setName] = useState(""); const [quota, setQuota] = useState("1000"); const [reason, setReason] = useState(""); const change = useWrite();
  useEffect(() => { if (change.data?.applied === true) setDialog(null); }, [change.data]);
  function save(dry_run: boolean) { try { change.mutate({ path: "/admin/virtual-orgs", body: { code, name, weekly_quota_microcredits: microcredits(quota), org_type: department?"department":"project", source_department_id:department,include_subdepartments:includeSubdepartments, reason, dry_run } }); } catch (error) { window.alert(String(error)); } }
  usePageActions(<><RefreshButton isRefreshing={orgs.isFetching} onClick={() => orgs.refetch()} />{role === "super_admin" && <><button onClick={() => setDialog("members")}>{t("Bulk member assignment")}</button><button className="primary" onClick={() => { change.reset(); setCode(""); setName(""); setReason(""); setDepartment(""); setQuota("1000"); setDialog("create"); }}>{t("Create virtual organization")}</button></>}</>, [t, role, orgs.isFetching, orgs.refetch, change.reset]);
  return <section className="page list-page enterprise-page"><section className="panel"><QueryFeedback query={orgs} /><div className="table-wrap"><table><thead><tr><th>{t("Organization")}</th><th>{t("Type")}</th><th className="status-cell">{t("Status")}</th><th>{t("Weekly budget")}</th></tr></thead><tbody>{orgs.data?.items.map(org => <tr key={org.id}><td><Link to={`/organizations/${org.id}`}>{org.name}</Link>{org.admin_vacant && <small>{t("Unassigned owners")}</small>}<div className="muted-cell">{org.code}</div></td><td>{org.org_type === "project" ? t("Project group") : t("Department-based")}</td><td>{t(enterpriseValueLabel(org.status))}</td><td>{org.weekly_quota_microcredits === "0" ? t("Unlimited") : `${credits(org.weekly_quota_microcredits)} Credits`}</td></tr>)}</tbody></table></div></section>
    {role === "super_admin" && dialog === "members" && <MemberCSVImport onComplete={() => setDialog(null)} />}
    {role === "super_admin" && dialog === "create" && <ManagementDialog title={t("Create virtual organization")} onClose={() => setDialog(null)} busy={change.isPending}><div className="enterprise-grid"><Field label={t("Source department (leave empty for a project group)")}><Select value={department} onChange={e=>setDepartment(e.target.value)}><option value="">{t("Independent project group")}</option>{departments.data?.items.map(item=><option key={String(item.id)} value={String(item.id)}>{String(item.path)}</option>)}</Select></Field>{department && <label><input type="checkbox" checked={includeSubdepartments} onChange={e=>setIncludeSubdepartments(e.target.checked)} />{t("Include employees in subdepartments")}</label>}<Field label={t("Code")}><input value={code} onChange={e => setCode(e.target.value)} /></Field><Field label={t("Name")}><input value={name} onChange={e => setName(e.target.value)} /></Field><Field label={t("Weekly Credits (0 means unlimited)")}><input inputMode="decimal" value={quota} onChange={e => setQuota(e.target.value)} /></Field><Field label={t("Change reason")}><input minLength={4} value={reason} onChange={e => setReason(e.target.value)} /></Field></div><WriteButtons pending={change.isPending} enabled={Boolean(code && name)} preview={() => save(true)} apply={() => save(false)} /><MutationResult mutation={change} /></ManagementDialog>}</section>;
}

export function OrganizationDetail() {
  const { t } = useI18n();

  const { id = "" } = useParams(); const role = useRole(); const org = useQuery({ queryKey: ["organization", id], queryFn: () => request<Organization>(`/admin/virtual-orgs/${id}`) });
  const members = useQuery({ queryKey: ["members", id], queryFn: () => request<{ items: Row[] }>(`/admin/virtual-orgs/${id}/members`) });
  const admins = useQuery({ queryKey: ["organization-admins", id], queryFn: () => request<{ items: Row[] }>(`/admin/virtual-orgs/${id}/admins`) });
  const report = useQuery({ queryKey: ["org-report", id], queryFn: () => request<{ items: Row[] }>(`/admin/ledger/summary?org_id=${encodeURIComponent(id)}&group_by=day`) });
  const [editing, setEditing] = useState<"settings"|"members"|"owners"|"bonus"|"department"|null>(null);
  const [draft, setDraft] = useState<Organization>(); const [reason, setReason] = useState(""); const [principalIDs, setPrincipalIDs] = useState(""); const [bonus, setBonus] = useState("100"); const [adminJSON, setAdminJSON] = useState("[]"); const [capEdits, setCapEdits] = useState<Record<string, string>>({}); const [fiveCapEdits,setFiveCapEdits]=useState<Record<string,string>>({});const [transfer,setTransfer]=useState(false); const change = useWrite();
  useEffect(() => { if (org.data) setDraft(org.data); }, [org.data]);
 useEffect(()=>{if(admins.data)setAdminJSON(JSON.stringify(admins.data.items.filter(row=>!row.ended_at).map(row=>({issuer:row.issuer,claim:row.subject_claim,subject:row.subject})),null,2));},[admins.data]);
  const submit = (path: string, body: Row, dry_run: boolean, method = "POST") => change.mutate({ path, method, body: { ...body, reason, dry_run } });
  function save(dry_run: boolean) {
    if (!draft) return;
    const body: Row = role === "super_admin" ? { ...draft } : { revision: draft.revision, default_member_weekly_cap_microcredits: draft.default_member_weekly_cap_microcredits, default_member_five_hour_cap_microcredits: draft.default_member_five_hour_cap_microcredits };
    if (role === "user") { body.alert_thresholds = draft.alert_thresholds; body.webhook_url = draft.webhook_url; }
    submit(`/admin/virtual-orgs/${id}`, body, dry_run, "PATCH");
  }
  function money(field: keyof Organization, label: string) { return <Field label={label}><input defaultValue={draft ? credits(draft[field]) : "0"} key={`${id}:${field}:${org.dataUpdatedAt}`} onBlur={e => { try { const amount = microcredits(e.target.value); setDraft(old => old ? { ...old, [field]: amount } : old); } catch { e.target.setCustomValidity(t("Supports up to 6 decimal places")); } }} /></Field>; }
  useEffect(() => { if (change.data?.applied === true) setEditing(null); }, [change.data]);
  function open(which: NonNullable<typeof editing>) { change.reset(); setReason(""); setDraft(org.data); setEditing(which); }
  usePageActions(<><RefreshButton isRefreshing={org.isFetching || members.isFetching || admins.isFetching || report.isFetching} onClick={() => Promise.all([org.refetch(),members.refetch(),admins.refetch(),report.refetch()])} /><button disabled={!org.data} onClick={() => open("settings")}>{t("Edit organization")}</button><button disabled={!org.data} onClick={() => open("members")}>{t("Manage members")}</button>{role === "super_admin" && <><button disabled={!org.data} onClick={() => open("owners")}>{t("Edit owners")}</button><button disabled={!org.data} onClick={() => open("bonus")}>{t("This week's bonus")}</button>{org.data?.org_type === "department" && <button onClick={() => open("department")}>{t("Compare with department")}</button>}</>}</>, [t, role, org.data, org.isFetching, members.isFetching, admins.isFetching, report.isFetching, org.refetch, members.refetch, admins.refetch, report.refetch, change.reset]);
  const reasonField = <Field label={t("Change reason")}><input value={reason} onChange={e => setReason(e.target.value)} /></Field>;
  return <section className="page enterprise-page">
    <QueryFeedback query={org} />
    {org.data && <><section className="panel"><div className="panel-heading"><h2>{org.data.name}</h2><span>{t(enterpriseValueLabel(org.data.status))}</span></div><dl className="finance-details">
      <div><dt>{t("Code")}</dt><dd>{org.data.code}</dd></div><div><dt>{t("Type")}</dt><dd>{t(org.data.org_type === "project" ? "Project group" : "Department-based")}</dd></div>
      <div><dt>{t("Weekly budget")}</dt><dd>{org.data.weekly_quota_microcredits === "0" ? t("Unlimited") : `${credits(org.data.weekly_quota_microcredits)} Credits`}</dd></div><div><dt>{t("Default member weekly cap / Credits (0 means unlimited)")}</dt><dd>{org.data.default_member_weekly_cap_microcredits === "0" ? t("Unlimited") : `${credits(org.data.default_member_weekly_cap_microcredits)} Credits`}</dd></div>
      <div><dt>{t("Organization description")}</dt><dd>{org.data.description || "—"}</dd></div><div><dt>{t("Model permissions")}</dt><dd>{t(org.data.models_mode === "member" ? "Use member model permissions" : "Use organization model list")}</dd></div>
    </dl></section>
    <section className="panel"><h2>{t("Members and individual caps")}</h2><QueryFeedback query={members} /><MemberCapSummary members={members.data?.items ?? []} org={org.data} /><div className="table-wrap"><table><thead><tr><th>{t("Member")}</th><th>{t("Weekly cap / Credits")}</th><th>{t("5-hour cap / Credits")}</th></tr></thead><tbody>{members.data?.items.map(member => <tr key={String(member.principal_id)}><td>{String(member.name)}</td><td>{member.weekly_cap_microcredits == null ? t("Follow organization default") : String(member.weekly_cap_microcredits) === "0" ? t("Unlimited") : credits(member.weekly_cap_microcredits)}</td><td>{member.five_hour_cap_microcredits == null ? t("Follow organization default") : String(member.five_hour_cap_microcredits) === "0" ? t("Disabled") : credits(member.five_hour_cap_microcredits)}</td></tr>)}</tbody></table></div></section>
    <section className="panel"><h2>{t("Owners")}</h2><QueryFeedback query={admins} /><DataTable items={admins.data?.items ?? []} columns={["name", "subject", "appointed_at", "ended_at"]} /></section>
    <section className="panel"><h2>{t("Spending trend")}</h2><QueryFeedback query={report} /><DataTable items={report.data?.items ?? []} columns={["day", "requests", "charged_microcredits", "upstream_currency", "upstream_cost_micros"]} /></section></>}
    {editing && draft && <ManagementDialog title={t(editing === "settings" ? "Edit organization" : editing === "members" ? "Manage members" : editing === "owners" ? "Edit owners" : editing === "bonus" ? "This week's bonus" : "Compare with department")} onClose={() => setEditing(null)} busy={change.isPending}>
      {editing !== "settings" && reasonField}
      {editing === "settings" && <section className="panel"><div className="panel-heading"><h2>{draft.name}</h2><span>{t(enterpriseValueLabel(draft.status))}</span></div><div className="enterprise-grid">{role === "super_admin" && <><Field label={t("Organization name")}><input value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} /></Field><Field label={t("Organization description")}><input value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})} /></Field><Field label={t("Model permissions")}><Select value={draft.models_mode} onChange={e=>setDraft({...draft,models_mode:e.target.value as Organization["models_mode"]})}><option value="member">{t("Use member model permissions")}</option><option value="org">{t("Use organization model list")}</option></Select></Field>{draft.models_mode==="org"&&<Field label={t("Organization models, comma-separated")}><input value={draft.allowed_models.join(", ")} onChange={e=>setDraft({...draft,allowed_models:e.target.value.split(",").map(v=>v.trim()).filter(Boolean)})} /></Field>}{money("weekly_quota_microcredits", t("Weekly budget / Credits"))}{money("five_hour_quota_microcredits", t("Organization 5-hour budget / Credits (0 disables)"))}</>}{money("default_member_weekly_cap_microcredits", t("Default member weekly cap / Credits (0 means unlimited)"))}{money("default_member_five_hour_cap_microcredits", t("Default member 5-hour cap / Credits (0 disables)"))}
      {role !== "platform_admin" && <><Field label={t("Alert thresholds, comma-separated percentages")}><input value={draft.alert_thresholds.join(", ")} onChange={e=>setDraft({...draft,alert_thresholds:e.target.value.split(",").filter(v=>v.trim()).map(Number)})} /></Field><Field label={t("Notification webhook")}><input value={draft.webhook_url} onChange={e => setDraft({ ...draft, webhook_url: e.target.value })} /></Field></>}<Field label={t("Change reason")}><input minLength={4} value={reason} onChange={e => setReason(e.target.value)} /></Field></div><WriteButtons pending={change.isPending} preview={() => save(true)} apply={() => save(false)} />
      {role === "super_admin" && <div className="enterprise-actions"><button onClick={() => submit(`/admin/virtual-orgs/${id}/${draft.status === "suspended" ? "resume" : "suspend"}`, {}, true)}>{t(draft.status === "suspended" ? "Preview resume" : "Preview suspension")}</button><button onClick={() => submit(`/admin/virtual-orgs/${id}/${draft.status === "suspended" ? "resume" : "suspend"}`, {}, false)}>{t(draft.status === "suspended" ? "Confirm resume" : "Confirm suspension")}</button><button onClick={() => submit(`/admin/virtual-orgs/${id}/archive`, {}, true)}>{t("Preview archive")}</button><button className="danger" onClick={() => submit(`/admin/virtual-orgs/${id}/archive`, {}, false)}>{t("Confirm archive")}</button></div>}<MutationResult mutation={change} /></section>}
      {editing === "members" && <><section className="panel"><h2>{t("Members and individual caps")}</h2><p className="muted-cell">{t("Save an empty cap to follow the default; 0 means unlimited. Total caps may exceed the organization budget; no budget is reserved.")}</p><MemberCapSummary members={members.data?.items??[]} org={draft} /><QueryFeedback query={members} /><div className="table-wrap"><table><thead><tr><th>{t("Member")}</th><th>{t("Weekly cap / Credits")}</th><th>{t("5-hour cap / Credits")}</th><th className="actions-cell">{t("Actions")}</th></tr></thead><tbody>{members.data?.items.map(member => { const principal = String(member.principal_id); return <tr key={principal}><td>{String(member.name)}<div className="muted-cell">{String(member.source)}</div></td><td><input aria-label={t("{name} weekly cap", {name:String(member.name)})} placeholder={member.weekly_cap_microcredits === null ? t("Follow organization default") : credits(member.weekly_cap_microcredits)} value={capEdits[principal] ?? ""} onChange={e => setCapEdits({ ...capEdits, [principal]: e.target.value })} /></td><td><input aria-label={t("{name} 5-hour cap", {name:String(member.name)})} placeholder={member.five_hour_cap_microcredits===null?t("Follow organization default"):credits(member.five_hour_cap_microcredits)} value={fiveCapEdits[principal]??""} onChange={e=>setFiveCapEdits({...fiveCapEdits,[principal]:e.target.value})} /></td><td><button disabled={change.isPending || !(principal in capEdits) && !(principal in fiveCapEdits)} onClick={() => { try { submit(`/admin/virtual-orgs/${id}/members/${principal}`, { ...(principal in capEdits?{weekly_cap_microcredits: capEdits[principal] ? microcredits(capEdits[principal]) : null}:{}),...(principal in fiveCapEdits?{five_hour_cap_microcredits:fiveCapEdits[principal]?microcredits(fiveCapEdits[principal]):null}:{}) }, false, "PATCH"); } catch (e) { window.alert(String(e)); } }}>{t("Save cap")}</button>{role === "super_admin" && <button onClick={() => submit(`/admin/virtual-orgs/${id}/members/${principal}`, {}, false, "DELETE")}>{t("Remove member")}</button>}</td></tr>; })}</tbody></table></div>
      {role === "super_admin" && <><EmployeePicker onPick={row=>setPrincipalIDs(old=>[...new Set([...old.split(/[\s,]+/).filter(Boolean),String(row.principal_id)])].join(", "))} /><label><input type="checkbox" checked={transfer} onChange={e=>setTransfer(e.target.checked)} />{t("Allow transfers from other organizations (skipped by default)")}</label><Field label={t("Principal IDs to add, comma-separated")}><textarea value={principalIDs} onChange={e => setPrincipalIDs(e.target.value)} /></Field><WriteButtons pending={change.isPending} preview={() => submit(`/admin/virtual-orgs/${id}/members`, { principal_ids: principalIDs.split(/[\s,]+/).filter(Boolean), transfer }, true)} apply={() => submit(`/admin/virtual-orgs/${id}/members`, { principal_ids: principalIDs.split(/[\s,]+/).filter(Boolean), transfer }, false)} /></>}</section><MutationResult mutation={change} /></>}
      {editing === "owners" && <><section className="panel"><h2>{t("Owners")}</h2><QueryFeedback query={admins} /><DataTable items={admins.data?.items ?? []} columns={["name", "subject", "appointed_at", "ended_at"]} />{role === "super_admin" && <><EmployeePicker onPick={row=>{try{const identities=JSON.parse(adminJSON) as Row[];const identity={issuer:row.issuer,claim:row.subject_claim,subject:row.subject};setAdminJSON(JSON.stringify([...identities.filter(item=>item.subject!==row.subject),identity],null,2));}catch(e){window.alert(String(e));}}} /><Field label={t("Owner identities (issuer, claim, subject)")}><textarea value={adminJSON} onChange={e => setAdminJSON(e.target.value)} /></Field><WriteButtons pending={change.isPending} preview={() => { try { submit(`/admin/virtual-orgs/${id}/admins`, { identities: JSON.parse(adminJSON) }, true, "PUT"); } catch (e) { window.alert(String(e)); } }} apply={() => { try { submit(`/admin/virtual-orgs/${id}/admins`, { identities: JSON.parse(adminJSON) }, false, "PUT"); } catch (e) { window.alert(String(e)); } }} /></>}</section><MutationResult mutation={change} /></>}
      {editing === "bonus" && <><section className="panel"><h2>{t("This week's bonus")}</h2><Field label="Credits"><input value={bonus} onChange={e => setBonus(e.target.value)} /></Field><WriteButtons pending={change.isPending} preview={() => submit(`/admin/virtual-orgs/${id}/week-adjustments`, { delta_microcredits: microcredits(bonus) }, true)} apply={() => submit(`/admin/virtual-orgs/${id}/week-adjustments`, { delta_microcredits: microcredits(bonus) }, false)} /></section><MutationResult mutation={change} /></>}
      {editing === "department" && <DepartmentComparison id={id} reason={reason} />}
    </ManagementDialog>}
  </section>;
}

export function ProviderConfiguration() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const selectedChannel = params.get("channel") ?? "";

  const docs = useQuery({ queryKey: ["provider-documents"], queryFn: () => request<{ items: ProviderDocument[]; version: number; read_only?:boolean; source?:string; yaml_changed?:boolean; secrets?:Row[] }>("/admin/provider-configs") }); const versions = useQuery({ queryKey: ["config-versions"], queryFn: () => request<{ items: Row[] }>("/admin/config-versions") });
  const [importYAML,setImportYAML] = useState(""); const [versionID,setVersionID] = useState(""); const snapshot = useQuery({queryKey:["config-snapshot",versionID],queryFn:()=>request<Row>(`/admin/config-versions/${versionID}`),enabled:Boolean(versionID)});
  const [view, setView] = useState("form"); const [name, setName] = useState(""); const [yaml, setYAML] = useState(""); const [revision, setRevision] = useState(0); const [reason, setReason] = useState(""); const [secretName, setSecretName] = useState(""); const [secret, setSecret] = useState(""); const change = useWrite();
  useEffect(() => {
    const doc = docs.data?.items.find(item => item.name === selectedChannel);
    setName(doc?.name ?? ""); setYAML(doc?.yaml ?? ""); setRevision(doc?.revision ?? 0); setSecret("");
  }, [docs.data, selectedChannel]);
  const choose = (doc?: ProviderDocument) => {
    const next = new URLSearchParams(params);
    if (doc) next.set("channel", doc.name); else next.delete("channel");
    setParams(next);
    setName(doc?.name ?? ""); setYAML(doc?.yaml ?? ""); setRevision(doc?.revision ?? 0); setSecret("");
  };
  function save(dry_run: boolean) { change.mutate({ path: `/admin/provider-configs/${encodeURIComponent(name)}`, method: "PUT", body: { yaml, revision, reason, dry_run } }); }
  return <div className="enterprise-page channel-configuration"><section className="panel">{docs.data?.yaml_changed && <div role="alert"><p>{t("The YAML directory changed during rollback. Compare the current version with the documents to import first.")}</p><button onClick={()=>change.mutate({path:"/admin/provider-configs/acknowledge-yaml",body:{reason,dry_run:false}})}>{t("Acknowledge directory changes")}</button></div>}{docs.data?.read_only && <p role="status">{t("YAML mode is read-only. Edit the configuration files and reload.")}</p>}<div className="panel-heading"><h2>{t("Channel configuration")}</h2><button onClick={() => choose()}>{t("New channel")}</button></div><QueryFeedback query={docs} /><div className="enterprise-actions">{docs.data?.items.map(doc => <button key={doc.name} onClick={() => choose(doc)}>{doc.name} · r{doc.revision}</button>)}</div><div className="enterprise-grid">{view === "yaml" && <Field label={t("Channel name")}><input value={name} disabled={revision > 0} onChange={e => {setName(e.target.value);try{setYAML(stringifyYAML({...parseYAML(yaml),name:e.target.value}));}catch{}}} /></Field>}<Field label={t("Change reason")}><input value={reason} onChange={e => setReason(e.target.value)} /></Field></div><div className="enterprise-actions"><button onClick={() => setView("form")}>{t("Form")}</button><button onClick={() => setView("yaml")}>YAML</button></div>{view === "yaml" ? <Field label={t("Channel YAML")}><textarea className="enterprise-code" rows={20} spellCheck={false} value={yaml} onChange={e => setYAML(e.target.value)} /></Field> : <ProviderDocumentForm value={yaml} lockedName={revision>0} onChange={value=>{setYAML(value);if(revision===0){try{setName(String(parseYAML(value)?.name??""));}catch{}}}} />}<p className="muted-cell">{t("Use ${secret:name} references for account keys and sensitive fields. Accounts within one provider must share an upstream organization or project to preserve Responses sessions.")}</p><WriteButtons pending={change.isPending} enabled={Boolean(name && yaml)&&!docs.data?.read_only} preview={() => save(true)} apply={() => save(false)} /><MutationResult mutation={change} /></section>
    <section className="panel"><h2>{t("Replace channel credential")}</h2><DataTable items={(docs.data?.secrets??[]).filter(item=>item.provider===name)} columns={["name","last4","key_id"]} /><div className="enterprise-grid"><Field label={t("Credential name, e.g. account/primary/main")}><input value={secretName} onChange={e => setSecretName(e.target.value)} /></Field><Field label={t("New credential")}><input type="password" autoComplete="new-password" value={secret} onChange={e => setSecret(e.target.value)} /></Field></div><button disabled={!name || !secret || !secretName || change.isPending || docs.data?.read_only} onClick={() => { change.mutate({ path: `/admin/provider-secrets/${encodeURIComponent(name)}/${secretName.split("/").map(encodeURIComponent).join("/")}`, method: "PUT", body: { value: secret, reason, dry_run: false } }); setSecret(""); }}>{t("Replace credential")}</button></section>
    <section className="panel"><h2>{t("Import and export")}</h2><p className="muted-cell">{t("Exports contain only credential references. Imports may include multiple YAML documents; preview before publishing.")}</p><a href={`${API_BASE_URL}/admin/provider-configs/export`} download>{t("Export redacted configuration")}</a><Field label={t("Choose YAML files")}><input type="file" accept=".yaml,.yml" onChange={e => { const file=e.target.files?.[0]; if(file) void file.text().then(setImportYAML); }} /></Field><Field label={t("Import content")}><textarea className="enterprise-code" rows={8} value={importYAML} onChange={e=>setImportYAML(e.target.value)} /></Field><WriteButtons pending={change.isPending} enabled={Boolean(importYAML)&&!docs.data?.read_only} preview={()=>change.mutate({path:"/admin/provider-configs/import",body:{documents:[importYAML],expected_version:docs.data?.version??0,reason,dry_run:true}})} apply={()=>change.mutate({path:"/admin/provider-configs/import",body:{documents:[importYAML],expected_version:docs.data?.version??0,reason,dry_run:false}})} /></section>
    <section className="panel"><h2>{t("Configuration versions")}</h2><QueryFeedback query={versions} /><div className="table-wrap"><table><thead><tr><th>{t("Version")}</th><th>{t("Created at")}</th><th>{t("Reason")}</th><th className="actions-cell">{t("Actions")}</th></tr></thead><tbody>{versions.data?.items.map(version => <tr key={String(version.id)}><td>{String(version.id)}</td><td>{String(version.created_at)}</td><td>{String(version.reason)}</td><td><button onClick={()=>setVersionID(String(version.id))}>{t("View snapshot")}</button><button onClick={() => change.mutate({ path: `/admin/config-versions/${version.id}/rollback`, body: { expected_head_version: docs.data?.version ?? 0, reason, dry_run: true } })}>{t("Preview rollback")}</button><button onClick={() => change.mutate({ path: `/admin/config-versions/${version.id}/rollback`, body: { expected_head_version: docs.data?.version ?? 0, reason, dry_run: false } })}>{t("Apply rollback")}</button></td></tr>)}</tbody></table></div>{versionID && <><h3>{t("Version")}{versionID} {t("and current configuration")}</h3><QueryFeedback query={snapshot} /><div className="enterprise-grid"><pre className="enterprise-result">{JSON.stringify(snapshot.data,null,2)}</pre><pre className="enterprise-result">{JSON.stringify(docs.data?.items,null,2)}</pre></div></>}</section></div>;
}

export function LoginTicket() {
  const { t } = useI18n();

  const [ticket] = useState(() => new URLSearchParams(window.location.search).get("t") ?? ""); const redemption = useRef<Promise<unknown> | null>(null); const navigate = useNavigate(); const client = useQueryClient(); const [error, setError] = useState("");
  useEffect(() => { window.history.replaceState({}, "", window.location.pathname); if (!ticket) { setError(t("Login ticket is missing")); return; } let active = true; (redemption.current ??= request("/admin/auth/ticket", "POST", { ticket })).then(() => { if (active) { void client.invalidateQueries({ queryKey: ["me"] }); navigate("/organizations", { replace: true }); } }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [ticket, client, navigate]);
  return <div className="boot">{error || t("Signing in...")}</div>;
}

export function Routing() {
  const { protocol = "", modelId = "" } = useParams();
  return <ModelRouting key={`${protocol}/${modelId}`} protocol={protocol} model={modelId} />;
}

function ModelRouting({ protocol, model }: { protocol: string; model: string }) {
  const { t } = useI18n();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/models";
  const [editing, setEditing] = useState<"candidates"|"pin"|"catalog"|null>(null);
  const selected = `${protocol}/${model}`;
  const currentModel = useQuery({ queryKey: ["model", protocol, model], queryFn: () => api.model(protocol, model), enabled: Boolean(protocol && model) });
  const [provider, setProvider] = useState(""); const [pool, setPool] = useState(""); const [reason, setReason] = useState(""); const [expiry, setExpiry] = useState(""); const change = useWrite();
  const route = currentModel.data; const candidates = route?.candidates ?? [];
  const catalog = useQuery({ queryKey: ["route-catalog", selected], queryFn: () => request<Row>(`/admin/catalog?${new URLSearchParams({ protocol, model })}`), enabled: Boolean(route) });
  const [description,setDescription]=useState(""); const [contextWindow,setContextWindow]=useState(0); const [maxOutput,setMaxOutput]=useState(0); const [sortOrder,setSortOrder]=useState(0); const [capabilities,setCapabilities]=useState<Record<string,boolean>>({});
  const [displayName, setDisplayName] = useState(""); const [regions, setRegions] = useState(""); const [attempts, setAttempts] = useState(3); const [firstByte, setFirstByte] = useState("30s"); const [elapsed, setElapsed] = useState("90s");
  useEffect(() => { if (!catalog.data) return; setDisplayName(String(catalog.data.display_name ?? "")); setDescription(String(catalog.data.description??""));setContextWindow(Number(catalog.data.context_window??0));setMaxOutput(Number(catalog.data.max_output_tokens??0));setSortOrder(Number(catalog.data.sort_order??0));setCapabilities((catalog.data.capabilities as Record<string,boolean>)??{}); setRegions(((catalog.data.allowed_regions as string[]) ?? []).join(", ")); const policy = (catalog.data.retry_policy as Row) ?? {}; setAttempts(Number(policy.max_attempts ?? 3)); setFirstByte(String(policy.first_byte_timeout ?? "30s")); setElapsed(String(policy.max_elapsed ?? "90s")); }, [catalog.data, editing]);
  function pin(dry_run: boolean) { change.mutate({ path: "/admin/routes/pin", method: "PUT", body: { protocol, public_model: model, provider, pool, expires_at: expiry ? new Date(expiry).toISOString() : null, reason, dry_run } }); }
  function saveCatalog(dry_run: boolean) { change.mutate({ path: "/admin/catalog", method: "PATCH", body: { ...catalog.data, protocol, public_model: model, display_name: displayName,description,context_window:contextWindow,max_output_tokens:maxOutput,sort_order:sortOrder,capabilities, allowed_regions: regions.split(",").map(v => v.trim()).filter(Boolean), retry_policy: { max_attempts: attempts, first_byte_timeout: firstByte, max_elapsed: elapsed }, reason, dry_run } }); }
  useEffect(() => { if (change.data?.applied === true) setEditing(null); }, [change.data]);
  function open(which: NonNullable<typeof editing>) { change.reset(); setReason(""); setEditing(which); }
  usePageActions(<><RefreshButton isRefreshing={currentModel.isFetching || catalog.isFetching} onClick={() => Promise.all([currentModel.refetch(),catalog.refetch()])} /><button disabled={!route} onClick={() => open("candidates")}>{t("Candidate channels")}</button><button disabled={!route} onClick={() => open("pin")}>{t("Pinned route")}</button><button disabled={!catalog.data} onClick={() => open("catalog")}>{t("Model catalog and retry policy")}</button></>, [t, route, currentModel.isFetching, catalog.isFetching, currentModel.refetch, catalog.refetch, catalog.data, change.reset]);
  return <section className="page list-page enterprise-page">
    <section className="panel"><h2>{t("Model routing")} · {route?.display_name ?? model}</h2>
    <p><Link to={`/models/${encodeURIComponent(protocol)}/${encodeURIComponent(model)}`} state={{ from }}>{model}</Link> · {protocol}</p>
    <QueryFeedback query={currentModel} />
    {route && <><h3>{t("Current route")}</h3><div className="route-current"><code>{model}</code><span aria-hidden="true">→</span><Link to={`/providers?${new URLSearchParams({ tab: "configuration", channel: route.provider })}`}>{route.provider}</Link><span aria-hidden="true">→</span><span>{t("Effective pool")}: {route.effective_pool || t("Unavailable")}</span><span aria-hidden="true">→</span><code>{route.upstream_model}</code></div>
    {route.pin && <p>{t("Pinned route")}: {route.pin.provider} / {route.pin.pool} {route.pin.expires_at ? `· ${t("Expires at")}: ${route.pin.expires_at}` : ""}</p>}
    {route.override_valid === false && <p className="error-text">{t("The route override references unavailable pool {pool}. Requests will fail until the override is fixed or cleared.", { pool: route.override_pool ?? "" })}</p>}
    <h3>{t("Candidate channels")}</h3><DataTable items={candidates} columns={["provider", "pool", "upstream_model", "priority", "weight", "data_region", "enabled_accounts", "enabled"]} />
    <h3>{t("Model catalog and retry policy")}</h3><QueryFeedback query={catalog} /><dl className="finance-details"><div><dt>{t("Maximum attempts")}</dt><dd>{attempts}</dd></div><div><dt>{t("First-event timeout")}</dt><dd>{firstByte}</dd></div><div><dt>{t("Deadline for starting new attempts")}</dt><dd>{elapsed}</dd></div><div><dt>{t("Data region")}</dt><dd>{regions || "—"}</dd></div></dl></>}
    </section>
    {editing && <ManagementDialog title={t(editing === "candidates" ? "Candidate channels" : editing === "pin" ? "Pinned route" : "Model catalog and retry policy")} onClose={() => setEditing(null)} busy={change.isPending}><Field label={t("Change reason")}><input value={reason} onChange={e => setReason(e.target.value)} /></Field>
    {editing === "candidates" && <><div className="enterprise-actions">{candidates.map(candidate => <span key={String(candidate.provider)}>{String(candidate.provider)} <button onClick={() => change.mutate({ path: "/admin/routes/candidates", method: "PATCH", body: { protocol, model, provider: candidate.provider, enabled: false, reason, dry_run: true } })}>{t("Preview disable")}</button><button onClick={() => change.mutate({ path: "/admin/routes/candidates", method: "PATCH", body: { protocol, model, provider: candidate.provider, enabled: false, reason, dry_run: false } })}>{t("Disable")}</button><button onClick={() => change.mutate({ path: "/admin/routes/candidates", method: "PATCH", body: { protocol, model, provider: candidate.provider, enabled: true, reason, dry_run: false } })}>{t("Enable")}</button></span>)}</div></>}
    {editing === "pin" && <><h3>{t("Pinned route")}</h3><p className="muted-cell">{t("Pinned routes use only the selected candidate. Stateful Responses sessions still follow their provider affinity.")}</p><div className="enterprise-grid"><Field label={t("Candidate")}><Select value={provider} onChange={e => { setProvider(e.target.value); setPool(String(candidates.find(c => c.provider === e.target.value)?.pool ?? "")); }}><option value="">{t("Select candidate")}</option>{candidates.map(c => <option key={String(c.provider)} value={String(c.provider)}>{String(c.provider)}</option>)}</Select></Field><Field label={t("Account pools")}><input value={pool} onChange={e => setPool(e.target.value)} /></Field><Field label={t("Expiry (optional)")}><DateInput type="datetime-local" value={expiry} onChange={e => setExpiry(e.target.value)} /></Field></div><WriteButtons pending={change.isPending} enabled={Boolean(provider)} preview={() => pin(true)} apply={() => pin(false)} /><button onClick={() => change.mutate({ path: `/admin/routes/pin?${new URLSearchParams({ protocol, model, reason })}`, method: "DELETE", body: { dry_run: false } })}>{t("Clear pinned route")}</button></>}
    {editing === "catalog" && <><h3>{t("Model catalog and retry policy")}</h3><QueryFeedback query={catalog} /><div className="enterprise-grid"><Field label={t("Display name")}><input value={displayName} onChange={e => setDisplayName(e.target.value)} /></Field><Field label={t("Model description")}><input value={description} onChange={e=>setDescription(e.target.value)} /></Field><Field label={t("Context limit")}><input type="number" min={0} value={contextWindow} onChange={e=>setContextWindow(Number(e.target.value))} /></Field><Field label={t("Output limit")}><input type="number" min={0} value={maxOutput} onChange={e=>setMaxOutput(Number(e.target.value))} /></Field><Field label={t("Sort order")}><input type="number" value={sortOrder} onChange={e=>setSortOrder(Number(e.target.value))} /></Field><Field label={t("Allowed regions, comma-separated (empty requires matching candidate regions)")}><input value={regions} onChange={e => setRegions(e.target.value)} /></Field><Field label={t("Maximum attempts")}><input type="number" min={1} max={10} value={attempts} onChange={e => setAttempts(Number(e.target.value))} /></Field><Field label={t("First-event timeout")}><input value={firstByte} onChange={e => setFirstByte(e.target.value)} /></Field><Field label={t("Deadline for starting new attempts")}><input value={elapsed} onChange={e => setElapsed(e.target.value)} /></Field></div><div className="enterprise-actions">{["tools","vision","reasoning","json_schema","streaming"].map(key=><label key={key}><input type="checkbox" checked={Boolean(capabilities[key])} onChange={e=>setCapabilities({...capabilities,[key]:e.target.checked})} />{t(enterpriseValueLabel(key))}</label>)}</div><WriteButtons pending={change.isPending} enabled={Boolean(catalog.data) && !catalog.isFetching && !catalog.isError} preview={() => saveCatalog(true)} apply={() => saveCatalog(false)} /></>}
    <MutationResult mutation={change} /></ManagementDialog>}
    </section>;
}

const alertPageSize = 100;

export function BudgetAlerts() {
  const { t } = useI18n();
  const [sort, toggleSort] = useTableSort<"fired_at">();
  const [offset, setOffset] = useState(0);
  const me = useQuery({ queryKey: ["me"], queryFn: api.me });
  const [org, setOrg] = useState("");
  const role = me.data?.role ?? "super_admin";
  const organizations = useQuery({ queryKey: ["organizations"], queryFn: () => request<{ items: Organization[] }>("/admin/virtual-orgs") });
  useEffect(() => { if (role === "user" && !org && organizations.data?.items.length) setOrg(organizations.data.items[0].id); }, [role, org, organizations.data]);
  const params = new URLSearchParams({ org_id: org, limit: String(alertPageSize), offset: String(offset) });
  if (sort) params.set("dir", sort.dir);
  const alerts = useQuery({
    queryKey: ["budget-alerts", org, sort, offset],
    queryFn: () => request<{ items: Row[]; has_more?: boolean }>(`/admin/budget-alerts?${params}`),
    enabled: role !== "user" || Boolean(org),
  });
  usePageActions(<RefreshButton disabled={role === "user" && !org} isRefreshing={alerts.isFetching} onClick={() => alerts.refetch()} />, [role, org, alerts.isFetching, alerts.refetch]);
  return <section className="page list-page enterprise-page"><section className="panel">
    <Field label={t("Organization")}><Select value={org} onChange={e => { setOrg(e.target.value); setOffset(0); }}>{role !== "user" && <option value="">{t("All visible organizations")}</option>}{organizations.data?.items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
    <QueryFeedback query={organizations} /><QueryFeedback query={alerts} />
    <DataTable
      items={alerts.data?.items ?? []}
      columns={["fired_at", "scope_type", "scope_id", "threshold", "notified_at", "notify_error"]}
      renderHeader={column => column === "fired_at" ? <SortHeader key={column} sort={sort} sortKey="fired_at" onSort={key => { toggleSort(key); setOffset(0); }}>{t(enterpriseColumnLabels[column])}</SortHeader> : undefined}
    />
    {(offset > 0 || alerts.data?.has_more) && <div className="finance-pagination">
      <span>{t("Page {page}", { page: offset / alertPageSize + 1 })}</span>
      <div className="table-actions">
        <button disabled={!offset || alerts.isFetching} onClick={() => setOffset(Math.max(0, offset - alertPageSize))}>{t("Previous")}</button>
        <button disabled={!alerts.data?.has_more || alerts.isFetching} onClick={() => setOffset(offset + alertPageSize)}>{t("Next")}</button>
      </div>
    </div>}
  </section></section>;
}

function MemberCSVImport({ onComplete }: { onComplete: () => void }) {
  const { t } = useI18n();

 const [csv,setCSV]=useState(""); const [reason,setReason]=useState(""); const [transfer,setTransfer]=useState(false); const change=useWrite();
 useEffect(() => { if (change.data?.applied === true) onComplete(); }, [change.data, onComplete]);
 const send=(dry_run:boolean)=>change.mutate({path:"/admin/virtual-orgs/members/import",body:{csv,reason,transfer,dry_run}});
 return <ManagementDialog title={t("Bulk member assignment")} onClose={onComplete} busy={change.isPending}><p>{t("Bulk member assignment via CSV")}</p><p className="muted-cell">{t("Columns: principal_id or subject, org_code, optional weekly_cap_credits. Members of other organizations are skipped by default.")}</p><Field label={t("CSV file")}><input type="file" accept=".csv" onChange={e=>{const file=e.target.files?.[0];if(file)void file.text().then(setCSV);}} /></Field><Field label={t("CSV content")}><textarea rows={5} value={csv} onChange={e=>setCSV(e.target.value)} /></Field><label><input type="checkbox" checked={transfer} onChange={e=>setTransfer(e.target.checked)} />{t("Allow transfers from other organizations")}</label><Field label={t("Change reason")}><input value={reason} onChange={e=>setReason(e.target.value)} /></Field><WriteButtons pending={change.isPending} enabled={Boolean(csv)} preview={()=>send(true)} apply={()=>send(false)} /><MutationResult mutation={change} /></ManagementDialog>;
}

function EmployeePicker({onPick}:{onPick:(row:Row)=>void}) {
  const { t } = useI18n();

 const [query,setQuery]=useState("");const [debounced,setDebounced]=useState("");
 useEffect(()=>{const id=setTimeout(()=>setDebounced(query.trim()),250);return()=>clearTimeout(id);},[query]);
 const employees=useQuery({queryKey:["employee-picker",debounced],queryFn:()=>request<{items:Row[]}>(`/admin/employees?${new URLSearchParams({query:debounced})}`),enabled:debounced.length>0});
 return <div><Field label={t("Search employee name or ID")}><input value={query} onChange={e=>setQuery(e.target.value)} /></Field>{debounced && <><QueryFeedback query={employees} /><div className="enterprise-actions">{employees.data?.items.filter(row=>row.status==="active"&&row.principal_id).slice(0,20).map(row=><button key={String(row.principal_id)} onClick={()=>onPick(row)}>{String(row.name)} · {String(row.subject)} · {String(row.department_path??"")} ＋</button>)}</div></>}</div>;
}
function MemberCapSummary({members,org}:{members:Row[];org:Organization}) {
  const { t } = useI18n();

 try {const sum=members.reduce((n,row)=>n+BigInt(String(row.weekly_cap_microcredits??org.default_member_weekly_cap_microcredits)),0n);const quota=BigInt(org.weekly_quota_microcredits);return <p className={quota>0n&&sum>quota?"error-text":"muted-cell"}>{t("Configured member caps: {sum} Credits / {quota}", {sum:credits(sum.toString()),quota:quota===0n?t("Organization unlimited"):credits(org.weekly_quota_microcredits)+" Credits"})} {quota>0n&&sum>quota?t("Total caps exceed the organization budget; saving is allowed."):""}</p>;}catch{return null;}
}

function DepartmentComparison({id,reason}:{id:string;reason:string}) {
  const { t } = useI18n();

 const [open,setOpen]=useState(false);const [transfer,setTransfer]=useState(false);const [remove,setRemove]=useState(false);const change=useWrite();
 const diff=useQuery({queryKey:["department-diff",id],queryFn:()=>request<{missing_members:Row[];outside_department:Row[]}>(`/admin/virtual-orgs/${id}/department-diff`),enabled:open});
 const send=(dry_run:boolean)=>change.mutate({path:`/admin/virtual-orgs/${id}/department-diff`,body:{transfer,remove_outside:remove,reason,dry_run}});
 return <section className="panel"><h2>{t("Compare with department")}</h2><button onClick={()=>setOpen(!open)}>{open?t("Hide differences"):t("View current differences")}</button>{open&&<><QueryFeedback query={diff} /><h3>{t("Department employees not yet in the organization")}</h3><DataTable items={diff.data?.missing_members??[]} columns={["name","subject","path"]} /><h3>{t("Members no longer in this department")}</h3><DataTable items={diff.data?.outside_department??[]} columns={["name","principal_id"]} /><label><input type="checkbox" checked={transfer} onChange={e=>setTransfer(e.target.checked)} />{t("Allow transfers from other organizations")}</label><label><input type="checkbox" checked={remove} onChange={e=>setRemove(e.target.checked)} />{t("Return members outside the department to personal mode")}</label><WriteButtons pending={change.isPending} preview={()=>send(true)} apply={()=>send(false)} /><MutationResult mutation={change} /></>}</section>;
}
