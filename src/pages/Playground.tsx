import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bot, Loader2, RotateCcw, Send, Square, User } from "lucide-react";
import { api } from "../lib/api";
import type { PlaygroundChatDone, PlaygroundChatMessage, PlaygroundChatMeta, ProviderSnapshot } from "../lib/types";

type ProviderItem = ProviderSnapshot["providers"][number];
type ChatMessage = PlaygroundChatMessage & {
  id: string;
  error?: boolean;
  pending?: boolean;
};

let messageSequence = 0;

export function Playground() {
  const providers = useQuery({ queryKey: ["providers"], queryFn: api.providers, refetchInterval: 30_000 });
  const providerList = providers.data?.providers ?? [];
  const abortRef = useRef<AbortController>();
  const activeRunRef = useRef(0);
  const [providerName, setProviderName] = useState("");
  const [publicModel, setPublicModel] = useState("");
  const [poolName, setPoolName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [meta, setMeta] = useState<PlaygroundChatMeta | null>(null);
  const [done, setDone] = useState<PlaygroundChatDone | null>(null);
  const [error, setError] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    if (providerList.length === 0) return;
    if (providerName && providerList.some((provider) => provider.name === providerName)) return;
    const nextProvider = providerList[0];
    setProviderName(nextProvider.name);
    setPublicModel(nextProvider.models[0]?.public ?? "");
    setPoolName("");
    setAccountName("");
  }, [providerList, providerName]);

  const selectedProvider = useMemo(
    () => providerList.find((provider) => provider.name === providerName),
    [providerList, providerName],
  );
  const selectedModel = useMemo(
    () => selectedProvider?.models.find((model) => model.public === publicModel),
    [selectedProvider, publicModel],
  );
  const inferredPoolName = poolName || effectiveModelPool(selectedModel);
  const selectedPool = useMemo(
    () => selectedProvider?.pools.find((pool) => pool.name === inferredPoolName),
    [selectedProvider, inferredPoolName],
  );

  useEffect(() => {
    if (!selectedProvider) return;
    if (!publicModel || !selectedProvider.models.some((model) => model.public === publicModel)) {
      setPublicModel(selectedProvider.models[0]?.public ?? "");
    }
    if (poolName && !selectedProvider.pools.some((pool) => pool.name === poolName)) {
      setPoolName("");
    }
  }, [selectedProvider, publicModel, poolName]);

  useEffect(() => {
    if (!accountName) return;
    if (!selectedPool?.accounts.some((account) => account.name === accountName)) {
      setAccountName("");
    }
  }, [accountName, selectedPool]);

  function resetConversation() {
    activeRunRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = undefined;
    setDone(null);
    setError("");
    setInput("");
    setIsStreaming(false);
    setMessages([]);
    setMeta(null);
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (!providerName || !publicModel || !content || isStreaming) return;

    const userMessage: ChatMessage = { id: nextMessageID(), role: "user", content };
    const assistantID = nextMessageID();
    const assistantMessage: ChatMessage = { id: assistantID, role: "assistant", content: "", pending: true };
    const nextMessages = [...messages, userMessage];
    const requestMessages: PlaygroundChatMessage[] = [
      ...(systemPrompt.trim() ? [{ role: "system" as const, content: systemPrompt.trim() }] : []),
      ...nextMessages.filter((message) => !message.error && message.content.trim()).map(({ role, content }) => ({ role, content })),
    ];
    const requestPool = poolName || effectiveModelPool(selectedModel);
    const controller = new AbortController();
    const runID = activeRunRef.current + 1;
    activeRunRef.current = runID;
    abortRef.current = controller;
    setMessages([...nextMessages, assistantMessage]);
    setInput("");
    setError("");
    setDone(null);
    setIsStreaming(true);

    try {
      const response = await api.playgroundChat(
        {
          provider: providerName,
          public_model: publicModel,
          pool: requestPool || undefined,
          account: accountName || undefined,
          messages: requestMessages,
          temperature,
          max_tokens: maxTokens,
        },
        controller.signal,
      );
      await readPlaygroundEvents(response, (name, payload) => {
        if (activeRunRef.current !== runID) return;
        if (name === "meta") {
          setMeta(payload as PlaygroundChatMeta);
        } else if (name === "delta") {
          const delta = stringValue(payload, "content");
          if (delta) appendAssistantContent(assistantID, delta);
        } else if (name === "error") {
          const message = stringValue(payload, "error") || "Playground request failed";
          setError(message);
          markAssistantError(assistantID, message);
        } else if (name === "done") {
          setDone(payload as PlaygroundChatDone);
        }
      });
    } catch (caught) {
      if (activeRunRef.current === runID) {
        const message = controller.signal.aborted ? "Stopped." : caught instanceof Error ? caught.message : "Playground request failed";
        setError(controller.signal.aborted ? "" : message);
        markAssistantError(assistantID, message);
      }
    } finally {
      if (activeRunRef.current === runID) {
        abortRef.current = undefined;
        setIsStreaming(false);
        setMessages((current) => current.map((message) => (message.id === assistantID ? { ...message, pending: false } : message)));
      }
    }
  }

  function appendAssistantContent(id: string, content: string) {
    setMessages((current) => current.map((message) => (message.id === id ? { ...message, content: message.content + content, pending: false } : message)));
  }

  function markAssistantError(id: string, message: string) {
    setMessages((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              content: item.content || message,
              error: true,
              pending: false,
            }
          : item,
      ),
    );
  }

  function stopStreaming() {
    abortRef.current?.abort();
  }

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Routing</span>
          <h1>演练场</h1>
        </div>
      </div>
      <section className="panel playground-panel">
        <div className="panel-heading">
          <div>
            <h2>目标配置</h2>
            <span>{targetSummary(meta, providerName, publicModel, inferredPoolName, accountName, done)}</span>
          </div>
          <button className="icon-text" disabled={isStreaming && messages.length === 0} onClick={resetConversation} type="button">
            <RotateCcw size={16} />
            清空
          </button>
        </div>
        {providers.isError ? <div className="error-text">Provider 加载失败。</div> : null}
        <div className="settings-form">
          <div className="settings-grid four">
            <label>
              Provider
              <select
                disabled={providers.isLoading || providerList.length === 0}
                onChange={(event) => {
                  const nextProvider = providerList.find((provider) => provider.name === event.target.value);
                  setProviderName(event.target.value);
                  setPublicModel(nextProvider?.models[0]?.public ?? "");
                  setPoolName("");
                  setAccountName("");
                  resetConversation();
                }}
                value={providerName}
              >
                <option value="">选择 Provider</option>
                {providerList.map((provider) => (
                  <option key={provider.name} value={provider.name}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              模型
              <select
                disabled={!selectedProvider}
                onChange={(event) => {
                  setPublicModel(event.target.value);
                  setAccountName("");
                  resetConversation();
                }}
                value={publicModel}
              >
                <option value="">选择模型</option>
                {selectedProvider?.models.map((model) => (
                  <option key={model.public} value={model.public}>
                    {model.public}
                  </option>
                ))}
              </select>
            </label>
            <label>
              号池
              <select
                disabled={!selectedProvider}
                onChange={(event) => {
                  setPoolName(event.target.value);
                  setAccountName("");
                  resetConversation();
                }}
                value={poolName}
              >
                <option value="">路由号池</option>
                {selectedProvider?.pools.map((pool) => (
                  <option key={pool.name} value={pool.name}>
                    {pool.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              账号
              <select
                disabled={!selectedPool}
                onChange={(event) => {
                  setAccountName(event.target.value);
                  resetConversation();
                }}
                value={accountName}
              >
                <option value="">任意账号</option>
                {selectedPool?.accounts.map((account) => (
                  <option key={account.name} value={account.name}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="settings-grid three">
            <label>
              System
              <textarea rows={3} onChange={(event) => setSystemPrompt(event.target.value)} value={systemPrompt} />
            </label>
            <label>
              Temperature
              <input min={0} max={2} onChange={(event) => setTemperature(Number(event.target.value))} step={0.1} type="number" value={temperature} />
            </label>
            <label>
              Max tokens
              <input min={1} onChange={(event) => setMaxTokens(Number(event.target.value))} step={1} type="number" value={maxTokens} />
            </label>
          </div>
        </div>
      </section>
      <section className="panel playground-chat">
        <div className="playground-messages">
          {messages.length === 0 ? (
            <div className="playground-empty">还没有消息。</div>
          ) : (
            messages.map((message) => <ChatBubble key={message.id} message={message} />)
          )}
        </div>
        {error ? <div className="error-text">{error}</div> : null}
        <form className="playground-composer" onSubmit={sendMessage}>
          <textarea
            disabled={isStreaming}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="输入消息"
            rows={3}
            value={input}
          />
          <div className="dialog-actions">
            {isStreaming ? (
              <button className="icon-text" onClick={stopStreaming} type="button">
                <Square size={16} />
                停止
              </button>
            ) : null}
            <button className="primary" disabled={!providerName || !publicModel || !input.trim() || isStreaming} type="submit">
              {isStreaming ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
              发送
            </button>
          </div>
        </form>
      </section>
    </section>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const assistant = message.role === "assistant";
  return (
    <article className={`playground-message ${assistant ? "assistant" : "user"} ${message.error ? "error" : ""}`}>
      <div className="playground-avatar">{assistant ? <Bot size={17} /> : <User size={17} />}</div>
      <div className="playground-bubble">
        <span>{assistant ? "Assistant" : "You"}</span>
        <p>{message.content || (message.pending ? "..." : "")}</p>
      </div>
    </article>
  );
}

function effectiveModelPool(model: ProviderItem["models"][number] | undefined) {
  if (!model) return "";
  if (model.override_pool && model.override_valid !== false) {
    return model.override_pool;
  }
  return model.pool;
}

function nextMessageID() {
  messageSequence += 1;
  return `message-${Date.now()}-${messageSequence}`;
}

function targetSummary(
  meta: PlaygroundChatMeta | null,
  provider: string,
  model: string,
  pool: string,
  account: string,
  done: PlaygroundChatDone | null,
) {
  const current = meta
    ? `${meta.provider} · ${meta.public_model} · ${meta.pool} · ${meta.account}`
    : `${provider || "none"} · ${model || "none"} · ${pool || "route"} · ${account || "any"}`;
  if (!done?.status_code) return current;
  return `${current} · ${done.status_code} · ${done.latency_ms} ms`;
}

async function readPlaygroundEvents(response: Response, handle: (event: string, payload: unknown) => void) {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Streaming response is unavailable");
  }
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    buffer = drainPlaygroundEvents(buffer, handle);
  }
  buffer += decoder.decode();
  drainPlaygroundEvents(`${buffer}\n\n`, handle);
}

function drainPlaygroundEvents(buffer: string, handle: (event: string, payload: unknown) => void) {
  const normalized = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const parts = normalized.split("\n\n");
  const rest = parts.pop() ?? "";
  for (const part of parts) {
    parsePlaygroundEvent(part, handle);
  }
  return rest;
}

function parsePlaygroundEvent(block: string, handle: (event: string, payload: unknown) => void) {
  let event = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (!line || line.startsWith(":")) continue;
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const field = line.slice(0, separator);
    const value = line.slice(separator + 1).replace(/^ /, "");
    if (field === "event") {
      event = value;
    } else if (field === "data") {
      data.push(value);
    }
  }
  if (data.length === 0) return;
  handle(event, JSON.parse(data.join("\n")));
}

function stringValue(payload: unknown, key: string) {
  if (!payload || typeof payload !== "object") return "";
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}
