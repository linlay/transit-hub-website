import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "./api";
import { useI18n } from "./i18n";
import type { ProviderConnectivityTestRequest, ProviderConnectivityTestResult } from "./types";

export type ConnectivityTarget = ProviderConnectivityTestRequest & {
  resultKey: string;
  label?: string;
};

export type ConnectivityToastState = {
  label: string;
  result: ProviderConnectivityTestResult;
};

export function useProviderConnectivityTest() {
  const { t } = useI18n();
  const hideTimer = useRef<number>();
  const [pendingKey, setPendingKey] = useState("");
  const [toast, setToast] = useState<ConnectivityToastState | null>(null);

  useEffect(() => {
    return () => {
      if (hideTimer.current) {
        window.clearTimeout(hideTimer.current);
      }
    };
  }, []);

  function showToast(result: ProviderConnectivityTestResult, label?: string) {
    if (hideTimer.current) {
      window.clearTimeout(hideTimer.current);
    }
    setToast({ result, label: label ?? t("Connectivity test") });
    hideTimer.current = window.setTimeout(() => setToast(null), 2_000);
  }

  function dismissToast() {
    if (hideTimer.current) {
      window.clearTimeout(hideTimer.current);
    }
    setToast(null);
  }

  const mutation = useMutation({
    mutationFn: (target: ConnectivityTarget) => api.testProviderConnectivity(connectivityRequest(target)),
    onMutate: (target) => {
      setPendingKey(target.resultKey);
    },
    onSuccess: (data, target) => {
      showToast(data, target.label);
    },
    onError: (error, target) => {
      showToast(failedConnectivityResult(target, error instanceof Error ? error.message : t("Test failed")), target.label);
    },
    onSettled: () => {
      setPendingKey("");
    },
  });

  return {
    dismissToast,
    isPending: mutation.isPending,
    pendingKey,
    run: mutation.mutate,
    toast,
  };
}

function connectivityRequest(target: ConnectivityTarget): ProviderConnectivityTestRequest {
  const { resultKey: _resultKey, label: _label, ...request } = target;
  return request;
}

function failedConnectivityResult(target: ConnectivityTarget, message: string): ProviderConnectivityTestResult {
  return {
    ok: false,
    provider: target.provider,
    protocol: "",
    public_model: target.public_model ?? "",
    upstream_model: "",
    pool: target.pool ?? "",
    account: target.account ?? "",
    endpoint: "",
    status_code: 0,
    latency_ms: 0,
    error: message,
    tested_at: new Date().toISOString(),
  };
}
