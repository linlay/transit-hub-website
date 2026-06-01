import { FormEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RadioTower } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

export function Login() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const login = useMutation({
    mutationFn: api.login,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      navigate("/", { replace: true });
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    login.mutate({ username, password });
  }

  return (
    <main className="login-screen">
      <form className="login-panel" onSubmit={submit}>
        <div className="login-logo">
          <RadioTower size={24} />
        </div>
        <h1>Transit Hub</h1>
        <p>Sign in with your internal admin account.</p>
        <label>
          Username
          <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
        </label>
        <label>
          Password
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="current-password"
          />
        </label>
        {login.error ? <div className="form-error">{login.error.message}</div> : null}
        <button className="primary" disabled={login.isPending} type="submit">
          {login.isPending ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
