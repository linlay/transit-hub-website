import { QueryFeedback } from "../components/QueryFeedback";
import { useConfirm } from "../components/ConfirmProvider";
import { IconButton } from "../components/IconButton";
import { FormEvent, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { usePageActions } from "../components/Layout";
import { RefreshButton } from "../components/RefreshButton";
import { StatusPill } from "../components/StatusPill";
import { api } from "../lib/api";
import { dateTime } from "../lib/format";
import { useI18n } from "../lib/i18n";
import { PAGE_REFETCH_INTERVAL_MS } from "../lib/query";

export function Users() {
  const { t } = useI18n();
  const confirm = useConfirm();
  const formRef = useRef<HTMLFormElement>(null);
  const queryClient = useQueryClient();
  const users = useQuery({ queryKey: ["users"], queryFn: api.users, refetchInterval: PAGE_REFETCH_INTERVAL_MS });
  usePageActions(<RefreshButton isRefreshing={users.isFetching} onClick={() => users.refetch()} />, [users.isFetching, users.refetch]);
  const create = useMutation({
    mutationFn: api.createUser,
    onSuccess: () => { formRef.current?.reset(); return queryClient.invalidateQueries({ queryKey: ["users"] }); },
  });
  const disable = useMutation({
    mutationFn: api.deleteUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (create.isPending) return;
    const form = new FormData(event.currentTarget);
    create.mutate({
      username: String(form.get("username") ?? ""),
      password: String(form.get("password") ?? ""),
      status: "active",
    });
  }

  return (
    <section className="page list-page">
      <section className="panel">
        <form ref={formRef} className="inline-form" onChange={() => { if (create.isSuccess) create.reset(); }} onSubmit={submit}>
          <input aria-label={t("Username")} disabled={create.isPending} name="username" placeholder={t("Username")} required />
          <input aria-label={t("Password")} disabled={create.isPending} name="password" placeholder={t("Password")} required type="password" />
          <IconButton label={t(create.isPending ? "Processing..." : "Create")} className="primary" disabled={create.isPending} type="submit">{create.isPending ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}</IconButton>
        </form>
        {create.error ? <div className="error-text" role="alert">{create.error.message}</div> : create.isSuccess ? <span className="saved-text" role="status">{t("User created.")}</span> : null}
      </section>
      <section className="panel">
        <QueryFeedback query={users} />
        <div className="table-wrap data-table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t("Username")}</th>
                <th>{t("Status")}</th>
                <th>{t("Last login")}</th>
                <th>{t("Created")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(users.data?.items ?? []).map((user) => (
                <tr key={user.id}>
                  <td>{user.username}</td>
                  <td>
                    <StatusPill active={user.status === "active"} label={user.status === "active" ? "Active" : "Disabled"} />
                  </td>
                  <td>{dateTime(user.last_login_at)}</td>
                  <td>{dateTime(user.created_at)}</td>
                  <td>
                    <IconButton label={t("Delete")} className="icon-button danger" disabled={disable.isPending} onClick={() => confirm({ message: t("Delete {name}?", { name: user.username }), label: t("Delete"), action: () => disable.mutateAsync(user.id) })} type="button"><Trash2 size={16} /></IconButton>
                  </td>
                </tr>
              ))}
              {!users.data?.items?.length ? (
                <tr>
                  <td colSpan={5} className="muted-cell">
                    {users.isPending ? t("Loading...") : users.isError ? t("Unable to load data.") : t("No users configured.")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
