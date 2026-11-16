import { CompactAction } from "../components/CompactAction";
import { Select } from "../components/ThemedControls";
import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { AdminUser } from "../lib/types";
import { enterpriseRequest as request, type Organization } from "../lib/enterprise";
import { dateTime } from "../lib/format";
import { useI18n } from "../lib/i18n";
import { QueryFeedback } from "../components/QueryFeedback";
import { ManagementDialog, ManagementField as Field } from "../components/ManagementDialog";
import { StatusPill } from "../components/StatusPill";
import { useConfirm } from "../components/ConfirmProvider";
import { usePageActions } from "../components/Layout";
import { RefreshButton } from "../components/RefreshButton";

type Employee = { issuer: string; subject_claim: string; subject: string; name: string; principal_id?: string; department_path?: string; status: string };
function roleLabel(role?: string) { return role === "super_admin" ? "Super administrator" : role === "platform_admin" ? "Platform administrator" : "Scoped administrator"; }

export function Users() {
  const { t } = useI18n();
  const confirm = useConfirm(); const client = useQueryClient();
  const users = useQuery({ queryKey: ["users"], queryFn: api.users });
  const organizations = useQuery({ queryKey: ["organizations"], queryFn: () => request<{ items: Organization[] }>("/admin/virtual-orgs") });
  const [editing, setEditing] = useState<AdminUser | "new" | null>(null); const [search, setSearch] = useState("");
  const disable = useMutation({ mutationFn: api.deleteUser, onSuccess: () => client.invalidateQueries({ queryKey: ["users"] }) });
  usePageActions(<><RefreshButton isRefreshing={users.isFetching} onClick={() => users.refetch()} /><button className="primary" onClick={() => setEditing("new")}>{t("Add administrator")}</button></>, [t, users.isFetching, users.refetch]);
  return <section className="page list-page enterprise-page"><section className="panel">
    <div className="finance-toolbar"><Field label={t("Search administrators")}><input type="search" value={search} onChange={e => setSearch(e.target.value)} /></Field></div><QueryFeedback query={users} />
    {disable.error && <p role="alert" className="error-text">{disable.error.message}</p>}
    <div className="table-wrap"><table><thead><tr><th>{t("Username")}</th><th>{t("Role")}</th><th>{t("Management scope")}</th><th className="status-cell">{t("Status")}</th><th>{t("Last login")}</th><th className="actions-cell">{t("Actions")}</th></tr></thead><tbody>
      {users.data?.items.filter(user => user.username.toLowerCase().includes(search.toLowerCase())).map(user => <tr key={user.id}><td>{user.username}</td><td>{t(roleLabel(user.role))}</td><td>{user.role === "super_admin" ? t("All organizations and people") : user.role === "platform_admin" ? t("Platform operations") : <><div>{(user.managed_orgs ?? []).map(id => organizations.data?.items.find(org => org.id === id)?.name ?? id).join(", ") || t("No assigned organizations")}</div><small>{user.managed_people?.map(person => person.name).join(", ") || t("{count} assigned people", { count: user.managed_principals?.length ?? 0 })}</small>{user.employee_identity && <small>{t("Employee organization ownership also grants access.")}</small>}</>}</td><td><StatusPill active={user.status === "active"} label={user.status === "active" ? "Active" : "Disabled"} /></td><td>{dateTime(user.last_login_at)}</td><td><div className="table-actions"><CompactAction onClick={() => setEditing(user)} label={t("Edit authorization")} kind="edit" />{user.status === "active" && <button className="danger" disabled={disable.isPending} onClick={() => confirm({ message: t("Disable administrator {name}?", { name: user.username }), label: t("Disable"), action: () => disable.mutateAsync(user.id) })}>{t("Disable")}</button>}</div></td></tr>)}
      {!users.isFetching && !users.data?.items.length && <tr><td colSpan={6}>{t("No administrators configured.")}</td></tr>}
    </tbody></table></div>
  </section>{editing && <AdministratorDialog key={editing === "new" ? "new" : editing.id} user={editing === "new" ? null : editing} organizations={organizations.data?.items ?? []} onClose={() => setEditing(null)} />}</section>;
}

function AdministratorDialog({ user, organizations, onClose }: { user: AdminUser | null; organizations: Organization[]; onClose: () => void }) {
  const { t } = useI18n(); const client = useQueryClient();
  const [username, setUsername] = useState(user?.username ?? ""); const [password, setPassword] = useState(""); const [role, setRole] = useState<NonNullable<AdminUser["role"]>>(user?.role ?? "user");
  const [orgIDs, setOrgIDs] = useState(user?.managed_orgs ?? []); const [principals, setPrincipals] = useState(user?.managed_principals ?? []);
  const [personNames, setPersonNames] = useState<Record<string,string>>(() => Object.fromEntries((user?.managed_people ?? []).map(person => [person.id, person.name])));
  const [identity, setIdentity] = useState(user?.employee_identity); const [search, setSearch] = useState(""); const [status, setStatus] = useState(user?.status ?? "active");
  const employees = useQuery({ queryKey: ["scope-employees", search], queryFn: () => request<{ items: Employee[] }>(`/admin/employees?${new URLSearchParams({ query: search, limit: "100" })}`) });
  useEffect(() => { if (employees.data) setPersonNames(old => ({ ...old, ...Object.fromEntries(employees.data.items.filter(row => row.principal_id).map(row => [row.principal_id!, row.name])) })); }, [employees.data]);
  const save = useMutation({ mutationFn: () => {
    const body = { username, ...(password ? { password } : {}), role, status, employee_identity: identity ?? { issuer: "", claim: "", subject: "" }, managed_orgs: role === "user" ? orgIDs : [], managed_principals: role === "user" ? principals : [] };
    return user ? api.updateUser(user.id, body) : api.createUser({ ...body, password });
  }, onSuccess: () => { void client.invalidateQueries({ queryKey: ["users"] }); void client.invalidateQueries({ queryKey: ["me"] }); onClose(); } });
  const toggle = (values: string[], value: string, checked: boolean) => checked ? [...new Set([...values, value])] : values.filter(item => item !== value);
  const valid = Boolean(username.trim() && (user || password) && (role !== "user" || orgIDs.length || principals.length));
  function submit(event: FormEvent) { event.preventDefault(); if (valid && !save.isPending) save.mutate(); }
  return <ManagementDialog title={t(user ? "Edit administrator" : "Add administrator")} onClose={onClose} busy={save.isPending} showCloseAction={false}><form onSubmit={submit}>
    <div className="enterprise-grid"><Field label={t("Username")}><input value={username} required onChange={e => setUsername(e.target.value)} /></Field><Field label={t(user ? "New password (leave empty to keep)" : "Password")}><input type="password" autoComplete="new-password" required={!user} value={password} onChange={e => setPassword(e.target.value)} /></Field><Field label={t("Role")}><Select value={role} onChange={e => setRole(e.target.value as typeof role)}><option value="user">{t("Scoped administrator")}</option><option value="platform_admin">{t("Platform administrator")}</option><option value="super_admin">{t("Super administrator")}</option></Select></Field>{user && <Field label={t("Status")}><Select value={status} onChange={e => setStatus(e.target.value as typeof status)}><option value="active">{t("Active")}</option><option value="disabled">{t("Disabled")}</option></Select></Field>}</div>
    {role === "user" ? <><h3>{t("Managed organizations")}</h3><div className="scope-options">{organizations.filter(org => org.status !== "archived").map(org => <label key={org.id}><input type="checkbox" checked={orgIDs.includes(org.id)} onChange={e => setOrgIDs(toggle(orgIDs, org.id, e.target.checked))} />{org.name}</label>)}</div><h3>{t("Managed people")}</h3><Field label={t("Search employee name or ID")}><input type="search" value={search} onChange={e => setSearch(e.target.value)} /></Field><QueryFeedback query={employees} /><div className="scope-options">{employees.data?.items.filter(row => row.principal_id && row.status === "active").map(row => <label key={row.principal_id}><input type="checkbox" checked={principals.includes(row.principal_id!)} onChange={e => setPrincipals(toggle(principals, row.principal_id!, e.target.checked))} /><span>{row.name} · {row.subject}<small>{row.department_path}</small></span></label>)}</div><p>{t("{count} assigned people", { count: principals.length })}</p>{principals.filter(id => !employees.data?.items.some(row => row.principal_id === id)).map(id => <button type="button" key={id} onClick={() => setPrincipals(principals.filter(item => item !== id))} aria-label={t("Remove {name}", {name:personNames[id] || id})}>{personNames[id] || t("Assigned person")} ×</button>)}</> : <p>{t(role === "super_admin" ? "All organizations and people" : "Platform operations")}</p>}
    <details><summary>{t("Employee sign-in binding (optional)")}</summary><Field label={t("Bind employee")}><Select value={identity ? `${identity.issuer}|${identity.claim}|${identity.subject}` : ""} onChange={e => { const row = employees.data?.items.find(row => `${row.issuer}|${row.subject_claim}|${row.subject}` === e.target.value); setIdentity(row ? { issuer: row.issuer, claim: row.subject_claim, subject: row.subject } : undefined); }}><option value="">{t("No employee bound")}</option>{identity && !employees.data?.items.some(row => row.subject === identity.subject && row.issuer === identity.issuer && row.subject_claim === identity.claim) && <option value={`${identity.issuer}|${identity.claim}|${identity.subject}`}>{identity.subject}</option>}{employees.data?.items.filter(row => row.status === "active").map(row => <option key={`${row.issuer}|${row.subject_claim}|${row.subject}`} value={`${row.issuer}|${row.subject_claim}|${row.subject}`}>{row.name} · {row.subject}</option>)}</Select></Field></details>
    {save.error && <p role="alert" className="error-text">{save.error.message}</p>}<div className="dialog-actions"><button type="button" disabled={save.isPending} onClick={onClose}>{t("Cancel")}</button><button className="primary" type="submit" disabled={!valid || save.isPending}>{t(save.isPending ? "Processing..." : user ? "Save authorization" : "Add administrator")}</button></div>
  </form></ManagementDialog>;
}
