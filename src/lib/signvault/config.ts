/** Where Control Center sends envelopes: the SignVault API (its sandbox, from
 *  this browser) or a simulated SignVault that runs in the browser for builds
 *  with no SignVault server within reach (the Vercel site, the desktop app).
 *  Production envelopes need an API key, which a static build can't keep
 *  secret, so they wait for a backend. */

import { useStoredState } from "@/lib/prefs";
import { BASE_URLS, type Env } from "./reference";

export type Mode = "api" | "simulated";

export interface SignVaultConfig {
  mode: Mode;
  env: Env;
  /** The sandbox API root, e.g. http://localhost:4000/api/v1. */
  sandboxUrl: string;
  tenantId: string;
}

/** Placeholder tenant until SignVault provisions the Owner's. */
export const TENANT_ID = "7c1e2a90-4b3d-4f6e-9a21-5d8c0b7e3f14";

export const DEFAULT_CONFIG: SignVaultConfig = { mode: "api", env: "sandbox", sandboxUrl: BASE_URLS.sandbox.url, tenantId: TENANT_ID };

export const CONFIG_KEY = "cc.signvault.v1";

export function useSignVaultConfig() {
  const [cfg, setCfg] = useStoredState<SignVaultConfig>(CONFIG_KEY, DEFAULT_CONFIG);
  return [{ ...DEFAULT_CONFIG, ...cfg }, setCfg] as const;
}

/** Where a new envelope goes, and whether this browser may send it there. */
export function target(cfg: SignVaultConfig): { mode: Mode; baseUrl: string; tenantId: string; blocked: string | null } {
  if (cfg.mode === "simulated") return { mode: "simulated", baseUrl: "simulated", tenantId: cfg.tenantId, blocked: null };
  if (cfg.env === "production")
    return {
      mode: "api",
      baseUrl: BASE_URLS.production.url,
      tenantId: cfg.tenantId,
      blocked: "Production envelopes need SignVault's API key, which this static build can't keep secret. They'll go through the Control Center backend once there is one. Use the sandbox or the simulated SignVault until then.",
    };
  return { mode: "api", baseUrl: cfg.sandboxUrl.replace(/\/+$/, ""), tenantId: cfg.tenantId, blocked: null };
}
