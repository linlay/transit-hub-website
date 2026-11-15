import { useSearchParams } from "react-router-dom";
import { useCallback } from "react";
import { useI18n } from "../lib/i18n";
import { ManagementDialog } from "../components/ManagementDialog";
import { ProviderConfiguration } from "./Enterprise";
import { Providers } from "./Providers";

export function Channels() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const configuration = params.get("tab") === "configuration";
  const open = useCallback((create: boolean) => {
    const next = new URLSearchParams();
    next.set("tab", "configuration");
    if (create) next.set("new", "1");
    setParams(next);
  }, [setParams]);
  const onCreate = useCallback(() => open(true), [open]);
  const onConfigure = useCallback(() => open(false), [open]);
  return <section className="page enterprise-page channels-page">
    <Providers onCreate={onCreate} onConfigure={onConfigure} />
    {configuration && <ManagementDialog title={t(params.get("new") === "1" ? "New channel" : "Channel configuration")} onClose={() => setParams({})}>
      <ProviderConfiguration />
    </ManagementDialog>}
  </section>;
}
