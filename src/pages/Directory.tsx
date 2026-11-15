import { useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Folder, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { enterpriseRequest as request, type Organization, type Row } from "../lib/enterprise";
import { enterpriseValueLabel } from "../lib/enterprise-labels";
import { useI18n } from "../lib/i18n";
import { ManagementDialog, ManagementField as Field } from "../components/ManagementDialog";
import { QueryFeedback } from "../components/QueryFeedback";
import { usePageActions } from "../components/Layout";
import { RefreshButton } from "../components/RefreshButton";

type Department = { id: string; parent_id: string; name: string; path: string; employee_count: number };
type Employee = { issuer: string; subject_claim: string; subject: string; name: string; department_id: string; department_path: string; principal_id?: string; status: string; virtual_org_id?: string; virtual_org_name?: string; policy_mode?: string };
type EmployeePage = { items: Employee[]; has_more?: boolean };

function useDirectoryWrite(onComplete: () => void) {
  const client = useQueryClient();
  return useMutation({ mutationFn: (v: { path: string; body: Row; method?: string }) => request<Row>(v.path, v.method ?? "POST", v.body), onSuccess: (data) => { if (data.applied === true) { void client.invalidateQueries(); onComplete(); } } });
}
type Write = ReturnType<typeof useDirectoryWrite>;
function WriteResult({ mutation }: { mutation: Write }) {
  const { t } = useI18n();
  return <>{mutation.error && <p role="alert" className="error-text">{mutation.error.message}</p>}{mutation.data && <div role="status" className="enterprise-result">{t("Preview ready. Review the changes, then apply.")}<details><summary>{t("View result")}</summary><pre>{JSON.stringify(mutation.data.preview ?? mutation.data, null, 2)}</pre></details></div>}</>;
}
function WriteActions({ mutation, enabled, send }: { mutation: Write; enabled: boolean; send: (preview: boolean) => void }) {
  const { t } = useI18n();
  return <div className="enterprise-actions"><button disabled={!enabled || mutation.isPending} onClick={() => send(true)}>{t("Preview changes")}</button><button className="primary" disabled={!enabled || mutation.isPending} onClick={() => send(false)}>{t(mutation.isPending ? "Processing..." : "Apply changes")}</button></div>;
}

export function Directory() {
  const { t } = useI18n();
  const me = useQuery({ queryKey: ["me"], queryFn: api.me });
  const canEdit = me.data?.role === "super_admin";
  const departments = useQuery({ queryKey: ["departments"], queryFn: () => request<{ items: Department[] }>("/admin/departments") });
  const [department, setDepartment] = useState<Department | null>(null);
  const [search, setSearch] = useState("");
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [selected, setSelected] = useState<Employee[]>([]);
  const [dialog, setDialog] = useState<"import" | "assign" | "create" | "edit" | null>(null);
  const employees = useInfiniteQuery({ queryKey: ["directory-employees", department?.id ?? "", search], initialPageParam: 0,
    queryFn: ({ pageParam }) => request<EmployeePage>(`/admin/employees?${new URLSearchParams({ department_id: department?.id ?? "", query: search, limit: "100", offset: String(pageParam) })}`),
    getNextPageParam: (last, pages) => last.has_more ? pages.length * 100 : undefined });
  const rows = employees.data?.pages.flatMap(page => page.items) ?? [];
  const all = departments.data?.items ?? [];
  const selectDepartment = (next: Department | null) => { setDepartment(next); setSelected([]); };
  usePageActions(<><RefreshButton isRefreshing={departments.isFetching || employees.isFetching} onClick={() => Promise.all([departments.refetch(), employees.refetch()])} />{canEdit && <>{selected.length > 0 && <button onClick={() => setDialog("assign")}>{t("Assign selected members")} ({selected.length})</button>}{department && <button onClick={() => setDialog("edit")}>{t("Edit department")}</button>}<button onClick={() => setDialog("create")}>{t("Add department")}</button><button className="primary" onClick={() => setDialog("import")}>{t("Import directory")}</button></>}</>, [t, canEdit, selected.length, department, departments.isFetching, employees.isFetching, departments.refetch, employees.refetch]);
  return <section className="page list-page enterprise-page">
    <div className="directory-layout">
      <section className="panel directory-sidebar"><h2>{t("Departments")}</h2><QueryFeedback query={departments} />
        <button type="button" aria-pressed={!department} onClick={() => selectDepartment(null)}>{t("All departments")}</button>
        <ul className="organization-tree" aria-label={t("Organization directory")}>
          {all.filter(row => !row.parent_id || !all.some(parent => parent.id === row.parent_id)).map(row => <DepartmentNode key={row.id} department={row} departments={all} selected={department?.id} onSelect={selectDepartment} onEmployee={setEmployee} ancestors={[]} />)}
        </ul>{!departments.isFetching && !all.length && <p>{t("No departments yet. Import a directory or add a department.")}</p>}
      </section>
      <section className="panel directory-employees"><div className="panel-heading"><div><h2>{department?.name ?? t("Employee directory")}</h2>{department && <span>{department.path}</span>}</div></div>
        <div className="toolbar"><Field label={t("Search employee name or ID")}><input value={search} onChange={e => setSearch(e.target.value)} /></Field></div>
        <QueryFeedback query={employees} />
        <div className="table-wrap"><table><thead><tr>{canEdit && <th>{t("Select")}</th>}<th>{t("Name")}</th><th>{t("Employee ID")}</th><th>{t("Departments")}</th><th>{t("Budget organization")}</th><th>{t("Status")}</th></tr></thead><tbody>{rows.map(row => <tr key={`${row.issuer}:${row.subject_claim}:${row.subject}`}>
          {canEdit && <td><input type="checkbox" aria-label={t("Select {name}", { name: row.name })} disabled={!row.principal_id || row.status !== "active"} checked={selected.some(item => item.principal_id === row.principal_id)} onChange={e => setSelected(old => e.target.checked ? [...old, row] : old.filter(item => item.principal_id !== row.principal_id))} /></td>}
          <td><button className="table-link" onClick={() => setEmployee(row)}>{row.name}</button></td><td>{row.subject}</td><td>{row.department_path || "—"}</td><td>{row.virtual_org_id ? <Link to={`/organizations/${encodeURIComponent(row.virtual_org_id)}`}>{row.virtual_org_name}</Link> : t("Personal")}</td><td>{t(enterpriseValueLabel(row.status))}</td>
        </tr>)}{!rows.length && !employees.isFetching && <tr><td colSpan={canEdit ? 6 : 5}>{t("No employees found")}</td></tr>}</tbody></table></div>
        {employees.hasNextPage && <button disabled={employees.isFetchingNextPage} onClick={() => employees.fetchNextPage()}>{t("Load more employees")}</button>}
      </section>
    </div>
    {dialog === "import" && <DirectoryImportDialog onClose={() => setDialog(null)} />}
    {(dialog === "create" || dialog === "edit") && <DepartmentDialog departments={all} current={dialog === "edit" ? department : null} parent={dialog === "create" ? department : null} onClose={() => setDialog(null)} onSaved={() => { setDepartment(null); setDialog(null); }} />}
    {dialog === "assign" && <AssignmentDialog employees={selected} onClose={() => setDialog(null)} onComplete={() => { setSelected([]); setDialog(null); }} />}
    {employee && <EmployeeDialog employee={employee} onClose={() => setEmployee(null)} />}
  </section>;
}

function DepartmentNode({ department, departments, selected, onSelect, onEmployee, ancestors }: { department: Department; departments: Department[]; selected?: string; onSelect: (d: Department) => void; onEmployee: (e: Employee) => void; ancestors: string[] }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const leaves = useInfiniteQuery({ queryKey: ["department-leaves", department.id], initialPageParam: 0, enabled: expanded,
    queryFn: ({ pageParam }) => request<EmployeePage>(`/admin/employees?${new URLSearchParams({ department_id: department.id, limit: "100", offset: String(pageParam) })}`),
    getNextPageParam: (last, pages) => last.has_more ? pages.length * 100 : undefined });
  if (ancestors.includes(department.id)) return null;
  const children = departments.filter(row => row.parent_id === department.id);
  return <li><div className="tree-node"><button className="tree-toggle" aria-label={t(expanded ? "Collapse {name}" : "Expand {name}", { name: department.name })} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button><button className="tree-label" aria-pressed={selected === department.id} onClick={() => { onSelect(department); setExpanded(true); }}><Folder size={16} /><span>{department.name}</span><small>{department.employee_count}</small></button></div>
    {expanded && <ul><QueryFeedback query={leaves} />{children.map(child => <DepartmentNode key={child.id} department={child} departments={departments} selected={selected} onSelect={onSelect} onEmployee={onEmployee} ancestors={[...ancestors, department.id]} />)}{leaves.data?.pages.flatMap(page => page.items).filter(row => row.department_id === department.id).map(row => <li className="tree-employee" key={`${row.issuer}:${row.subject_claim}:${row.subject}`}><button onClick={() => onEmployee(row)}><UserRound size={15} /><span>{row.name}</span></button></li>)}{leaves.hasNextPage && <li><button disabled={leaves.isFetchingNextPage} onClick={() => leaves.fetchNextPage()}>{t("Load more employees")}</button></li>}</ul>}
  </li>;
}

function EmployeeDialog({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const { t } = useI18n();
  const detail = useQuery({ queryKey: ["employee-detail", employee.subject], queryFn: () => request<Row>(`/admin/employees/${encodeURIComponent(employee.subject)}`) });
  return <ManagementDialog title={t("Employee details · {subject}", { subject: employee.subject })} onClose={onClose}><QueryFeedback query={detail} /><dl className="model-detail-grid">{[["Name", employee.name], ["Employee ID", employee.subject], ["Departments", employee.department_path], ["Budget organization", employee.virtual_org_name ?? t("Personal")], ["Status", t(enterpriseValueLabel(employee.status))]].map(([label, value]) => <div key={label}><dt>{t(label)}</dt><dd>{value || "—"}</dd></div>)}</dl>{employee.principal_id && <Link to={`/employee-keys/${encodeURIComponent(employee.principal_id)}`}>{t("View personal policy and usage")}</Link>}</ManagementDialog>;
}

function DirectoryImportDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [format, setFormat] = useState("json");
  const [content, setContent] = useState(""); const [departmentsCSV, setDepartmentsCSV] = useState(""); const [employeesCSV, setEmployeesCSV] = useState("");
  const [markMissing, setMarkMissing] = useState(false); const [reason, setReason] = useState(""); const [error, setError] = useState("");
  const change = useDirectoryWrite(onClose);
  function send(dry_run: boolean) { try { const data = format === "json" ? JSON.parse(content) : { departments_csv: departmentsCSV, employees_csv: employeesCSV }; change.mutate({ path: "/admin/directory/imports", body: { ...data, missing_employees: markMissing ? "mark_left" : "keep", reason, dry_run } }); setError(""); } catch (e) { setError(String(e)); } }
  const file = (label: string, accept: string, update: (v: string) => void) => <Field label={t(label)}><input type="file" accept={accept} onChange={e => { const chosen = e.target.files?.[0]; if (chosen) void chosen.text().then(update).catch(e => setError(String(e))); }} /></Field>;
  return <ManagementDialog title={t("Import directory")} onClose={onClose} busy={change.isPending}><p>{t("Preview before importing. Department changes do not automatically change budget ownership.")}</p><Field label={t("Format")}><select value={format} onChange={e => { setFormat(e.target.value); change.reset(); }}><option value="json">JSON</option><option value="csv">CSV</option></select></Field>
    {format === "json" ? file("Directory file", ".json", setContent) : <>{file("Departments CSV", ".csv", setDepartmentsCSV)}{file("Employees CSV", ".csv", setEmployeesCSV)}</>}
    <details><summary>{t("Review import content")}</summary>{format === "json" ? <Field label={t("Directory JSON")}><textarea rows={10} value={content} onChange={e => setContent(e.target.value)} /></Field> : <><Field label={t("Departments CSV")}><textarea rows={5} value={departmentsCSV} onChange={e => setDepartmentsCSV(e.target.value)} /></Field><Field label={t("Employees CSV")}><textarea rows={5} value={employeesCSV} onChange={e => setEmployeesCSV(e.target.value)} /></Field></>}</details>
    <label><input type="checkbox" checked={markMissing} onChange={e => setMarkMissing(e.target.checked)} /> {t("Mark employees missing from this file as departed")}</label><Field label={t("Change reason")}><input value={reason} onChange={e => setReason(e.target.value)} /></Field>{error && <p role="alert">{error}</p>}<WriteActions mutation={change} enabled={Boolean((format === "json" ? content : departmentsCSV || employeesCSV) && reason.trim().length >= 4)} send={send} /><WriteResult mutation={change} /></ManagementDialog>;
}

function DepartmentDialog({ departments, current, parent, onClose, onSaved }: { departments: Department[]; current: Department | null; parent: Department | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const [id, setID] = useState(current?.id ?? ""); const [name, setName] = useState(current?.name ?? ""); const [parentID, setParentID] = useState(current?.parent_id ?? parent?.id ?? ""); const [reason, setReason] = useState("");
  const change = useDirectoryWrite(onSaved);
  const descendants = (item: Department): boolean => item.id === current?.id || Boolean(current?.path && item.path.startsWith(`${current.path}/`));
  return <ManagementDialog title={t(current ? "Edit department" : "Add department")} onClose={onClose} busy={change.isPending}><Field label={t("Department ID")}><input value={id} disabled={Boolean(current)} onChange={e => setID(e.target.value)} /></Field><Field label={t("Name")}><input value={name} onChange={e => setName(e.target.value)} /></Field><Field label={t("Parent department")}><select value={parentID} onChange={e => setParentID(e.target.value)}><option value="">{t("Root department")}</option>{departments.filter(row => !current || !descendants(row)).map(row => <option key={row.id} value={row.id}>{row.path}</option>)}</select></Field><Field label={t("Change reason")}><input value={reason} onChange={e => setReason(e.target.value)} /></Field><WriteActions mutation={change} enabled={Boolean(id && name && reason.trim().length >= 4)} send={dry_run => change.mutate({ path: current ? `/admin/departments/${encodeURIComponent(id)}` : "/admin/departments", method: current ? "PATCH" : "POST", body: { id, name, parent_id: parentID, reason, dry_run } })} /><WriteResult mutation={change} /></ManagementDialog>;
}

function AssignmentDialog({ employees, onClose, onComplete }: { employees: Employee[]; onClose: () => void; onComplete: () => void }) {
  const { t } = useI18n();
  const orgs = useQuery({ queryKey: ["organizations"], queryFn: () => request<{ items: Organization[] }>("/admin/virtual-orgs") });
  const [target, setTarget] = useState(""); const [reason, setReason] = useState(""); const [transfer, setTransfer] = useState(false); const change = useDirectoryWrite(onComplete);
  return <ManagementDialog title={t("Assign selected members")} onClose={onClose} busy={change.isPending}><p>{employees.map(employee => employee.name).join(", ")}</p><QueryFeedback query={orgs} /><Field label={t("Add to virtual organization")}><select value={target} onChange={e => setTarget(e.target.value)}><option value="">{t("Select organization")}</option>{orgs.data?.items.filter(org => org.status !== "archived").map(org => <option key={org.id} value={org.id}>{org.name}</option>)}</select></Field><label><input type="checkbox" checked={transfer} onChange={e => setTransfer(e.target.checked)} />{t("Allow transfers from other organizations")}</label><Field label={t("Directory change reason")}><input value={reason} onChange={e => setReason(e.target.value)} /></Field><WriteActions mutation={change} enabled={Boolean(target && reason.trim().length >= 4)} send={dry_run => change.mutate({ path: `/admin/virtual-orgs/${encodeURIComponent(target)}/members`, body: { principal_ids: employees.map(row => row.principal_id), transfer, reason, dry_run } })} /><WriteResult mutation={change} /></ManagementDialog>;
}
