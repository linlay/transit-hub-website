import { useId } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { api } from "../lib/api";
import { useI18n } from "../lib/i18n";
import type { ProviderSnapshot } from "../lib/types";

type Props = {
  provider: string;
  pool: string;
  account: string;
  enabled: boolean;
  reason?: string;
  failureCount?: number;
};

export function ProviderAccountStatusControl({ provider, pool, account, enabled, reason, failureCount = 0 }: Props) {
  const { t } = useI18n();
  const client = useQueryClient();
  const descriptionId = useId();
  const update = useMutation({
    mutationFn: () => api.setProviderAccountEnabled(provider, pool, account, !enabled),
    onSuccess: async (result) => {
      client.setQueryData<ProviderSnapshot>(["providers"], (current) => current && ({
        ...current,
        providers: current.providers.map((item) => item.name !== provider ? item : {
          ...item,
          pools: item.pools.map((entry) => entry.name !== pool ? entry : {
            ...entry,
            accounts: entry.accounts.map((entryAccount) => entryAccount.name !== account ? entryAccount : {
              ...entryAccount,
              enabled: result.enabled,
              disabled_reason: result.enabled ? undefined : "manual",
              failure_count: 0,
            }),
          }),
        }),
      }));
      await client.invalidateQueries({ queryKey: ["providers"] });
    },
  });
  const detail = enabled
    ? failureCount > 0 ? t("Account failures: {count}/3", { count: failureCount }) : ""
    : reason === "billing_error" ? t("Auto-disabled: billing issue (3 failures)")
      : reason === "authentication_error" ? t("Auto-disabled: invalid credentials (3 failures)")
        : t("Manually disabled");

  return (
    <div className="provider-account-status">
      <div className="provider-account-status-main">
        <button
          type="button"
          role="switch"
          className="provider-account-switch"
          aria-checked={enabled}
          aria-busy={update.isPending}
          aria-label={`${t("Account availability")}: ${provider} / ${pool} / ${account}`}
          aria-describedby={detail ? descriptionId : undefined}
          title={t(enabled ? "Disable account" : "Enable account")}
          disabled={update.isPending}
          onClick={() => update.mutate()}
        >
          <span>{update.isPending ? <Loader2 size={11} className="spin" aria-hidden /> : null}</span>
        </button>
      </div>
      {detail ? <small id={descriptionId} className="provider-account-status-detail">{detail}</small> : null}
      {update.isError ? <small role="alert" className="error-text">{update.error.message}</small> : null}
    </div>
  );
}
