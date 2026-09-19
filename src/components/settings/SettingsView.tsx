"use client";

import { useState } from "react";
import { Bell, Building2, Check, Copy, KeyRound, Plug, RefreshCw, ShieldCheck, Trash2, Users, Webhook } from "lucide-react";
import { Avatar, Badge, type Tone } from "@/components/ui/data";
import { Button, Switch } from "@/components/ui/controls";
import { toast } from "@/components/ui/overlay";
import { PageHeader, Panel } from "@/components/ui/Panel";
import { cx } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";
import { ORG, PEOPLE, ROLES, type Role } from "@/mock/org";
import { SignVaultApi } from "./SignVaultApi";
import { DEFAULT_RBAC, INTEGRATIONS, NOTIFICATION_RULES, PERMISSIONS, RBAC_MODULES, WEBHOOKS, WEBHOOK_EVENTS, type Permission } from "@/mock/workspace";

type Section = "org" | "roles" | "rules" | "integrations";

const SECTIONS: Array<{ id: Section; label: string; icon: React.ReactNode }> = [
  { id: "org", label: "Organization", icon: <Building2 className="size-4" aria-hidden /> },
  { id: "roles", label: "Users & roles", icon: <Users className="size-4" aria-hidden /> },
  { id: "rules", label: "Notification rules", icon: <Bell className="size-4" aria-hidden /> },
  { id: "integrations", label: "Integrations & API", icon: <Plug className="size-4" aria-hidden /> },
];

export function SettingsView() {
  const [section, setSection] = useState<Section>("org");
  return (
    <>
      <PageHeader title="Settings" meta="Organization profile, access control, notifications, and integrations" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="lg:sticky lg:top-0 lg:self-start">
          <ul className="flex gap-1 overflow-x-auto lg:flex-col">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  aria-current={section === s.id ? "page" : undefined}
                  onClick={() => setSection(s.id)}
                  className={cx(
                    "flex h-9 w-full items-center gap-2.5 rounded-md px-3 text-sm font-semibold whitespace-nowrap transition-colors",
                    section === s.id ? "bg-accent-tint text-accent-ink" : "text-ink-2 hover:bg-sunk hover:text-ink",
                  )}
                >
                  {s.icon}
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0">
          {section === "org" && <OrgSection />}
          {section === "roles" && <RolesSection />}
          {section === "rules" && <RulesSection />}
          {section === "integrations" && <IntegrationsSection />}
        </div>
      </div>
    </>
  );
}

function OrgSection() {
  const [form, setForm] = useState({ name: ORG.name, program: ORG.program, address: ORG.address, fy: ORG.fiscalYearStart, currency: ORG.currency, threshold: "2" });
  const [saved, setSaved] = useState(true);
  const set = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  };
  const nameErr = form.name.trim().length < 2;
  return (
    <Panel title="Organization profile">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (nameErr) return;
          setSaved(true);
          toast("Organization profile saved");
        }}
        className="grid max-w-3xl gap-4 sm:grid-cols-2"
      >
        <Field label="Owner organization name" error={nameErr ? "Enter the organization’s legal or operating name." : undefined}>
          <input className="field w-full" value={form.name} onChange={(e) => set("name", e.target.value)} aria-invalid={nameErr} />
        </Field>
        <Field label="Program office">
          <input className="field w-full" value={form.program} onChange={(e) => set("program", e.target.value)} />
        </Field>
        <Field label="Headquarters address" wide>
          <input className="field w-full" value={form.address} onChange={(e) => set("address", e.target.value)} />
        </Field>
        <Field label="Fiscal year starts">
          <select className="field w-full" value={form.fy} onChange={(e) => set("fy", e.target.value)}>
            {["January", "April", "July", "October"].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
        <Field label="Reporting currency">
          <select className="field w-full" value={form.currency} onChange={(e) => set("currency", e.target.value)}>
            <option>USD</option>
            <option>CAD</option>
          </select>
        </Field>
        <Field label="Variance alert threshold (% of approved budget)" hint="Projects whose projected variance (H) falls below this share of C are flagged.">
          <input className="field num w-full" type="number" min={0} max={20} step={0.5} value={form.threshold} onChange={(e) => set("threshold", e.target.value)} />
        </Field>
        <Field label="Logo" hint="Replace the placeholder mark with the Owner’s logo (SVG or PNG).">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-md border border-dashed border-line-strong text-2xs text-ink-3">Logo</span>
            <Button size="sm" disabled title="Upload arrives with the asset service">
              Upload
            </Button>
          </div>
        </Field>
        <div className="flex items-center justify-end gap-3 sm:col-span-2">
          <span className="text-xs text-ink-3" aria-live="polite">
            {saved ? "All changes saved" : "Unsaved changes"}
          </span>
          <Button type="submit" variant="primary" disabled={saved || nameErr}>
            Save profile
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function Field({ label, children, hint, error, wide }: { label: string; children: React.ReactNode; hint?: string; error?: string; wide?: boolean }) {
  return (
    <label className={cx("block", wide && "sm:col-span-2")}>
      <span className="mb-1 block text-xs font-semibold text-ink-2">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs font-medium text-neg-ink">{error}</span> : hint ? <span className="mt-1 block text-xs text-ink-3">{hint}</span> : null}
    </label>
  );
}

function RolesSection() {
  const { prefs } = usePrefs();
  const canAdmin = (DEFAULT_RBAC[prefs.role]?.Settings ?? []).includes("Administer") || prefs.role === "Owner Executive" || prefs.role === "Cost Controller";
  const [rbac, setRbac] = useState(DEFAULT_RBAC);
  const [roleOf, setRoleOf] = useState<Record<string, string>>(() => Object.fromEntries(PEOPLE.map((p) => [p.id, ROLES.includes(p.role as Role) ? p.role : p.role === "Procurement" ? "PM" : "Field Inspector"])));
  const toggle = (role: string, mod: string, perm: Permission) =>
    setRbac((r) => {
      const cur = r[role]![mod] ?? [];
      const next = cur.includes(perm) ? cur.filter((x) => x !== perm) : [...cur, perm];
      return { ...r, [role]: { ...r[role], [mod]: next } };
    });
  return (
    <div className="grid gap-5">
      <Panel title="Role permissions" info="What each role may do in each module. Changes apply to every user holding the role." flush>
        {!canAdmin && <p className="mx-5 mb-3 rounded-md bg-warn-tint px-3 py-2 text-xs text-warn-ink">Viewing as {prefs.role}. Only administrators can change permissions.</p>}
        <div className="scroll-x">
          <table className="dt compact min-w-[56rem]">
            <thead>
              <tr>
                <th className="sticky left-0 z-[2] bg-surface">Module</th>
                {ROLES.map((r) => (
                  <th key={r} className="border-l border-line-soft text-center">
                    {r}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RBAC_MODULES.map((m) => (
                <tr key={m}>
                  <td className="sticky left-0 z-[1] bg-surface font-semibold text-ink">{m}</td>
                  {ROLES.map((r) => (
                    <td key={r} className="border-l border-line-soft">
                      <div className="flex flex-wrap justify-center gap-1">
                        {PERMISSIONS.map((perm) => {
                          const on = (rbac[r]![m] ?? []).includes(perm);
                          return (
                            <button
                              key={perm}
                              type="button"
                              aria-pressed={on}
                              disabled={!canAdmin}
                              aria-label={`${r} — ${m}: ${perm}`}
                              title={perm}
                              onClick={() => toggle(r, m, perm)}
                              className={cx(
                                "inline-flex h-6 min-w-6 items-center justify-center rounded-xs px-1 text-[0.625rem] font-bold transition-colors disabled:cursor-not-allowed",
                                on ? "bg-accent text-white" : "bg-sunk text-ink-3 hover:text-ink",
                              )}
                            >
                              {PERM_SHORT[perm]}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-5 py-3 text-xs text-ink-3">V View · E Edit · Ap Approve · X Export · Ad Administer. Filled cells are granted.</p>
      </Panel>

      <Panel title="Users" flush actions={<Button size="sm" variant="tint" disabled={!canAdmin}>Invite user</Button>}>
        <div className="scroll-x">
          <table className="dt min-w-[44rem]">
            <thead>
              <tr>
                <th>Name</th>
                <th>Title</th>
                <th>Role</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {PEOPLE.map((p) => (
                <tr key={p.id}>
                  <td>
                    <span className="flex items-center gap-2.5">
                      <Avatar name={p.name} tone={p.tone} size="sm" />
                      <span>
                        <span className="block font-semibold text-ink">{p.name}</span>
                        <span className="block text-xs text-ink-3">{p.email}</span>
                      </span>
                    </span>
                  </td>
                  <td className="text-ink-2">{p.title}</td>
                  <td>
                    <select aria-label={`Role for ${p.name}`} className="field h-8" disabled={!canAdmin} value={roleOf[p.id]} onChange={(e) => setRoleOf((r) => ({ ...r, [p.id]: e.target.value }))}>
                      {ROLES.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <Badge tone="pos">Active</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function RulesSection() {
  const [rules, setRules] = useState(NOTIFICATION_RULES);
  return (
    <Panel title="Notification rules" info="Rules evaluate after each Workday sync and on every change." flush>
      <ul className="divide-y divide-line-soft">
        {rules.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-4 px-5 py-3.5">
            <Switch checked={r.enabled} onChange={(v) => setRules((rs) => rs.map((x) => (x.id === r.id ? { ...x, enabled: v } : x)))} label={`${r.enabled ? "Disable" : "Enable"} rule: ${r.when}`} hideLabel />
            <div className={cx("min-w-0 flex-1", !r.enabled && "opacity-60")}>
              <div className="text-sm text-ink">
                <span className="font-semibold">When</span> {r.when}
              </div>
              <div className="text-xs text-ink-2">
                <span className="font-semibold">Then</span> {r.then}
              </div>
            </div>
            <label className="sr-only" htmlFor={`ch-${r.id}`}>
              Channel
            </label>
            <select id={`ch-${r.id}`} className="field h-8" value={r.channel} onChange={(e) => setRules((rs) => rs.map((x) => (x.id === r.id ? { ...x, channel: e.target.value as typeof r.channel } : x)))}>
              {["In-app", "Email", "In-app + Email", "Teams"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

const PERM_SHORT: Record<Permission, string> = { View: "V", Edit: "E", Approve: "Ap", Export: "X", Administer: "Ad" };

const INT_TONE: Record<string, Tone> = { Connected: "pos", Error: "neg", "Not connected": "neutral" };

function IntegrationsSection() {
  const [hooks, setHooks] = useState(WEBHOOKS);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const urlErr = touched && !/^https:\/\/[^\s/$.?#].[^\s]*$/i.test(url) ? "Webhook endpoints must be HTTPS URLs." : touched && !events.length ? "Choose at least one event." : "";
  const key = "cc_live_9f3a7c21e84b4d0b8a55c6f1d2e7a9b3";

  return (
    <div className="grid gap-5">
      <Panel title="Connected systems" flush>
        <ul className="divide-y divide-line-soft">
          {INTEGRATIONS.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-4 px-5 py-3.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-sunk text-ink-2">
                <Plug className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-ink">{i.name}</span>
                  <Badge tone={INT_TONE[i.status]}>{i.status}</Badge>
                </div>
                <div className="text-xs text-ink-2">{i.purpose}</div>
                <div className="text-2xs text-ink-3">
                  {i.feeds}
                  {i.lastSync && ` · last sync ${i.lastSync}`}
                </div>
              </div>
              {i.id === "signvault" && (
                <Button size="sm" variant="ghost" onClick={() => document.getElementById("signvault")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                  API reference
                </Button>
              )}
              {i.status === "Not connected" ? (
                <Button size="sm" variant="tint">
                  Connect
                </Button>
              ) : (
                <Button
                  size="sm"
                  loading={syncing === i.id}
                  icon={<RefreshCw className="size-3.5" aria-hidden />}
                  onClick={() => {
                    setSyncing(i.id);
                    setTimeout(() => {
                      setSyncing(null);
                      toast(i.status === "Error" ? `${i.name}: sync failed again — check the service account credentials` : `${i.name} synced`);
                    }, 900);
                  }}
                >
                  {i.status === "Error" ? "Retry" : "Sync now"}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="API access" actions={<KeyRound className="size-4 text-ink-3" aria-hidden />}>
        <p className="mb-3 text-sm text-ink-2">Server-to-server key for reading budget, commitment, and forecast data. Rotate it when a team member with access leaves.</p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="num flex h-8 min-w-0 flex-1 items-center truncate rounded-md border border-line bg-surface-2 px-3 text-xs text-ink">{revealed ? key : `cc_live_${"•".repeat(24)}${key.slice(-4)}`}</code>
          <Button size="sm" variant="ghost" onClick={() => setRevealed((r) => !r)}>
            {revealed ? "Hide" : "Reveal"}
          </Button>
          <Button
            size="sm"
            icon={<Copy className="size-3.5" aria-hidden />}
            onClick={() => {
              navigator.clipboard?.writeText(key).then(
                () => toast("API key copied"),
                () => toast("Copy failed — select the key and copy it manually"),
              );
            }}
          >
            Copy
          </Button>
          <Button size="sm" variant="danger" onClick={() => toast("Key rotation requested — the old key stays valid for 24 hours")}>
            Rotate
          </Button>
        </div>
      </Panel>

      <Panel title="Webhooks" info="POSTs a signed JSON payload to your endpoint for each selected event." actions={<Webhook className="size-4 text-ink-3" aria-hidden />} flush>
        <ul className="divide-y divide-line-soft">
          {hooks.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <Switch checked={h.active} onChange={(v) => setHooks((hs) => hs.map((x) => (x.id === h.id ? { ...x, active: v } : x)))} label={`Webhook ${h.url} active`} hideLabel />
              <div className="min-w-0 flex-1">
                <code className="block truncate text-xs font-semibold text-ink">{h.url}</code>
                <div className="mt-1 flex flex-wrap gap-1">
                  {h.events.map((e) => (
                    <Badge key={e} tone="neutral" dot={false}>
                      {e}
                    </Badge>
                  ))}
                </div>
              </div>
              <button type="button" aria-label={`Delete webhook ${h.url}`} onClick={() => setHooks((hs) => hs.filter((x) => x.id !== h.id))} className="inline-flex size-8 items-center justify-center rounded-md text-ink-3 hover:bg-neg-tint hover:text-neg-ink">
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <form
          noValidate
          className="border-t border-line bg-surface-2 px-5 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            setTouched(true);
            if (!/^https:\/\/[^\s/$.?#].[^\s]*$/i.test(url) || !events.length) return;
            setHooks((hs) => [...hs, { id: `wh${Date.now()}`, url, events, active: true }]);
            setUrl("");
            setEvents([]);
            setTouched(false);
            toast("Webhook added — a test ping was sent");
          }}
        >
          <h3 className="text-sm font-semibold text-ink">Add webhook</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <label className="min-w-64 flex-1">
              <span className="sr-only">Endpoint URL</span>
              <input className="field w-full" placeholder="https://example.org/hooks/pmis" value={url} onChange={(e) => setUrl(e.target.value)} aria-invalid={!!urlErr && urlErr.includes("HTTPS")} />
            </label>
            <Button type="submit" variant="primary" icon={<Check className="size-3.5" aria-hidden />}>
              Add endpoint
            </Button>
          </div>
          <fieldset className="mt-3">
            <legend className="mb-1.5 text-xs font-semibold text-ink-2">Events</legend>
            <div className="flex flex-wrap gap-1.5">
              {WEBHOOK_EVENTS.map((ev) => {
                const on = events.includes(ev);
                return (
                  <button
                    key={ev}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setEvents((es) => (on ? es.filter((x) => x !== ev) : [...es, ev]))}
                    className={cx("inline-flex h-7 items-center gap-1 rounded-sm border px-2 text-xs font-semibold transition-colors", on ? "border-accent bg-accent-tint text-accent-ink" : "border-line-strong bg-surface text-ink-2 hover:text-ink")}
                  >
                    {on && <Check className="size-3" aria-hidden />}
                    {ev}
                  </button>
                );
              })}
            </div>
          </fieldset>
          {urlErr && (
            <p role="alert" className="mt-2 text-xs font-medium text-neg-ink">
              {urlErr}
            </p>
          )}
          <p className="mt-3 flex items-center gap-1.5 text-2xs text-ink-3">
            <ShieldCheck className="size-3" aria-hidden /> Payloads are signed with HMAC-SHA256; verify the <code>X-CC-Signature</code> header.
          </p>
        </form>
      </Panel>

      <SignVaultApi />
    </div>
  );
}
