import { IconButton } from "../components/IconButton";
import { Eye, EyeOff, LogIn, RadioTower } from "lucide-react";
import { FormEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useI18n } from "../lib/i18n";

export function Login() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
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
        <p>{t("Sign in with your internal admin account.")}</p>
        <label>
          {t("Username")}
          <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
        </label>
        <div className="login-password">
          <label htmlFor="login-password">{t("Password")}</label>
          <div className="login-password-control">
            <input
              id="login-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type={passwordVisible ? "text" : "password"}
              autoComplete="current-password"
            />
            <IconButton label={t(passwordVisible ? "Hide password" : "Show password")} className="password-toggle" aria-controls="login-password" onClick={() => setPasswordVisible((visible) => !visible)}>
              {passwordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
            </IconButton>
          </div>
        </div>
        {login.error ? <div className="form-error">{login.error.message}</div> : null}
        <IconButton label={login.isPending ? t("Signing in...") : t("Sign in")} className="primary" disabled={login.isPending} type="submit"><LogIn size={16} /></IconButton>
      </form>
    </main>
  );
}
