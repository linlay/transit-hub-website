import { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { StatusPill } from "../components/StatusPill";
import { api } from "../lib/api";
import { dateTime } from "../lib/format";

export function Users() {
  const queryClient = useQueryClient();
  const users = useQuery({ queryKey: ["users"], queryFn: api.users });
  const create = useMutation({
    mutationFn: api.createUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
  const disable = useMutation({
    mutationFn: api.deleteUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    create.mutate({
      username: String(form.get("username") ?? ""),
      password: String(form.get("password") ?? ""),
      status: "active",
    });
    event.currentTarget.reset();
  }

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Internal</span>
          <h1>Users</h1>
        </div>
      </div>
      <section className="panel">
        <form className="inline-form" onSubmit={submit}>
          <input name="username" placeholder="Username" required />
          <input name="password" placeholder="Password" required type="password" />
          <button className="primary" type="submit">
            <Plus size={16} />
            Create
          </button>
        </form>
      </section>
      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Status</th>
                <th>Last login</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(users.data?.items ?? []).map((user) => (
                <tr key={user.id}>
                  <td>{user.username}</td>
                  <td>
                    <StatusPill active={user.status === "active"} label={user.status} />
                  </td>
                  <td>{dateTime(user.last_login_at)}</td>
                  <td>{dateTime(user.created_at)}</td>
                  <td>
                    <button className="icon-button danger" onClick={() => disable.mutate(user.id)} type="button">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
