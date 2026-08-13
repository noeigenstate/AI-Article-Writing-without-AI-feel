import * as http from "node:http";

type GlobalProxySetter = (proxyEnv?: NodeJS.ProcessEnv) => () => void;

type HttpWithRuntimeProxy = typeof http & {
  setGlobalProxyFromEnv?: GlobalProxySetter;
};

export type EnvProxyStatus = "enabled" | "not-configured" | "unsupported";

/**
 * Enable Node's global proxy after dotenv has populated `process.env`.
 *
 * `NODE_USE_ENV_PROXY=1` only reads variables available during process startup;
 * this runtime call also covers proxy values stored in `backend/.env`.
 */
export function configureEnvProxy(
  env: NodeJS.ProcessEnv = process.env,
  setter: GlobalProxySetter | null | undefined = (http as HttpWithRuntimeProxy).setGlobalProxyFromEnv
): EnvProxyStatus {
  const configured = ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"]
    .some((key) => Boolean(env[key]?.trim()));
  if (!configured) return "not-configured";
  if (typeof setter !== "function") return "unsupported";

  setter(env);
  return "enabled";
}
