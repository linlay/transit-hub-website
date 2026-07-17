import { runtimeAPIBaseURL } from "./env";
import type { AdminModel } from "./types";

export function modelGatewayURL(model: AdminModel): string {
  if (!model.gateway_path) return "";
  return `${runtimeAPIBaseURL()}${model.gateway_path}`;
}

export function modelCurlExample(model: AdminModel): string {
  const url = modelGatewayURL(model);
  if (!url) return "";

  let body: Record<string, unknown>;
  let authHeader: string;
  if (model.protocol === "anthropic" && model.type === "chat") {
    authHeader = "x-api-key: $CLIENT_API_KEY";
    body = {
      model: model.public_model,
      max_tokens: 256,
      messages: [{ role: "user", content: "hello" }],
    };
  } else if (model.protocol === "openai" && model.type === "chat") {
    authHeader = "Authorization: Bearer $CLIENT_API_KEY";
    body = {
      model: model.public_model,
      messages: [{ role: "user", content: "hello" }],
    };
  } else if (model.protocol === "openai" && model.type === "embedding") {
    authHeader = "Authorization: Bearer $CLIENT_API_KEY";
    body = { model: model.public_model, input: "hello" };
  } else if (model.protocol === "openai" && model.type === "image-generation") {
    authHeader = "Authorization: Bearer $CLIENT_API_KEY";
    body = {
      model: model.public_model,
      prompt: "a clean transit hub at sunrise",
      size: "1024x1024",
      response_format: "b64_json",
    };
  } else {
    return "";
  }

  return [
    `curl -sS ${shellQuote(url)} \\`,
    `  -H "${authHeader}" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d ${shellQuote(JSON.stringify(body, null, 2))}`,
  ].join("\n");
}

export function modelYAMLExample(model: AdminModel): string {
  const pool = model.configured_pool || model.default_pool || "primary";
  const baseURL = model.provider_base_url || "https://provider.example.com";
  const envName = providerAPIKeyEnv(model);
  const lines = [
    `name: ${yamlQuote(model.provider)}`,
    `protocol: ${yamlQuote(model.protocol)}`,
    `base_url: ${yamlQuote(baseURL)}`,
    `default_pool: ${yamlQuote(pool)}`,
    "headers: {}",
  ];

  if (model.endpoint_key && model.upstream_path) {
    lines.push("endpoints:", `  ${model.endpoint_key}: ${yamlQuote(model.upstream_path)}`);
  }
  lines.push(
    "models:",
    `  - public: ${yamlQuote(model.public_model)}`,
    `    upstream: ${yamlQuote(model.upstream_model)}`,
    `    type: ${yamlQuote(model.type)}`,
    `    pool: ${yamlQuote(pool)}`,
    `    owned_by: ${yamlQuote(model.owned_by)}`,
    `    display_name: ${yamlQuote(model.display_name)}`,
    `    created_at: ${yamlQuote(model.created_at)}`,
    "pools:",
    `  - name: ${yamlQuote(pool)}`,
    "    accounts:",
    `      - name: ${yamlQuote(`${model.provider}-main`)}`,
    `        api_key_env: ${envName}`,
    "        weight: 1",
  );
  return lines.join("\n");
}

export function providerConfigFilename(model: AdminModel): string {
  const name = model.provider.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "provider";
  return `CONFIG_DIR/providers/${name}.yaml`;
}

export function providerAPIKeyEnv(model: AdminModel): string {
  return `${model.provider.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "PROVIDER"}_API_KEY`;
}

export function modelReloadCurl(): string {
  return [
    `curl -sS -X POST ${shellQuote(`${runtimeAPIBaseURL()}/admin/providers/reload`)} \\`,
    `  -H "Authorization: Bearer $ADMIN_TOKEN"`,
  ].join("\n");
}

function yamlQuote(value: string): string {
  return JSON.stringify(value ?? "");
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
