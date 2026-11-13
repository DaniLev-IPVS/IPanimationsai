"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createSetupToken,
  encryptSecret,
  endSession,
  hashPassword,
  requireAdmin,
  requireUser,
  sha256,
  startSession,
  verifyPassword,
} from "@/lib/studio/auth";
import { getTimezone, isUuid, one, q } from "@/lib/studio/db";
import { parseFilters, whereOf } from "@/lib/studio/filters";
import { LANG_COOKIE, langOf } from "@/lib/studio/i18n";
import { addIdea, submitEstimate, type Estimate, type Submitted } from "@/lib/studio/proposals";
import { fetchTaskPage, matchComfy, repriceUnpriced, syncAll } from "@/lib/studio/sync";
import { importKeyUsage, priceKeyUsage } from "@/lib/studio/usage";

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const fail = (path: string, message: string): never => redirect(`${path}?e=${encodeURIComponent(message)}`);
const done = () => revalidatePath("/studio", "layout");

// ── Signing in ─────────────────────────────────────────────────────────────

export async function login(fd: FormData) {
  const email = text(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  const lock = await one<{ n: number }>(
    `select count(*)::int as n from studio.login_failures where email = $1 and at > now() - interval '15 minutes'`,
    [email],
  );
  if ((lock?.n ?? 0) >= 8) fail("/studio/login", "Too many tries. Wait 15 minutes.");

  const user = await one<{ id: string; password_hash: string | null; active: boolean }>(
    `select id, password_hash, active from studio.users where email = $1`,
    [email],
  );
  const ok = await verifyPassword(password, user?.password_hash ?? null);
  if (!user || !ok || !user.active) {
    await q(`insert into studio.login_failures (email) values ($1)`, [email]);
    fail("/studio/login", "That email and password don't match.");
  }
  await q(`delete from studio.login_failures where email = $1`, [email]);
  await startSession(user!.id);
  redirect("/studio");
}

export async function setPassword(fd: FormData) {
  const token = text(fd, "token");
  const password = String(fd.get("password") ?? "");
  const again = `/studio/setup?t=${encodeURIComponent(token)}&e=`;
  if (password.length < 6) redirect(`${again}${encodeURIComponent("Use at least 6 characters.")}`);
  if (password !== String(fd.get("confirm") ?? "")) redirect(`${again}${encodeURIComponent("The two passwords don't match.")}`);

  const row = await one<{ user_id: string }>(
    `update studio.setup_tokens set used_at = now()
      where token_hash = $1 and used_at is null and expires_at > now()
      returning user_id`,
    [sha256(token)],
  );
  if (!row) fail("/studio/login", "That link has expired or was already used. Ask for a new one.");
  await q(`update studio.users set password_hash = $2 where id = $1`, [row!.user_id, await hashPassword(password)]);
  await q(`delete from studio.sessions where user_id = $1`, [row!.user_id]);
  await startSession(row!.user_id);
  redirect("/studio");
}

export async function logout() {
  await endSession();
  redirect("/studio/login");
}

// ── Renders ────────────────────────────────────────────────────────────────

export async function syncNow() {
  await requireUser();
  await syncAll();
  done();
}

/** "projectId|videoId" from the assign menu, checked against the database. */
async function resolveTarget(value: string) {
  if (!value) return { project: null as string | null, video: null as string | null };
  const [project, video] = value.split("|");
  if (!isUuid(project)) return null;
  if (video) {
    if (!isUuid(video)) return null;
    const row = await one(`select 1 from studio.videos where id = $1 and project_id = $2`, [video, project]);
    return row ? { project, video } : null;
  }
  const row = await one(`select 1 from studio.projects where id = $1`, [project]);
  return row ? { project, video: null as string | null } : null;
}

export async function assignRender(fd: FormData) {
  const user = await requireUser();
  const target = await resolveTarget(text(fd, "target"));
  if (!target) return;
  await q(
    `update studio.renders set project_id = $2, video_id = $3, assigned_via = 'manual'
      where id = $1 and ($4::uuid is null or user_id = $4::uuid)`,
    [text(fd, "id"), target.project, target.video, user.role === "admin" ? null : user.id],
  );
  done();
}

export async function setRenderPerson(fd: FormData) {
  await requireAdmin();
  const person = text(fd, "person");
  if (!isUuid(person)) return;
  await q(`update studio.renders set user_id = $2 where id = $1`, [text(fd, "id"), person]);
  done();
}

/** Assign every unassigned render matching the current filters. */
export async function bulkAssign(fd: FormData) {
  const user = await requireUser();
  const target = await resolveTarget(text(fd, "target"));
  if (!target || !target.project) return;
  const sp: Record<string, string> = {};
  new URLSearchParams(text(fd, "qs")).forEach((v, k) => (sp[k] = v));
  const filters = parseFilters(sp, await getTimezone(), user);
  const { where, params } = whereOf({ ...filters, unassigned: false }, user);
  await q(
    `update studio.renders r
        set project_id = $${params.length + 1}::uuid, video_id = $${params.length + 2}::uuid, assigned_via = 'manual'
      where ${where} and r.project_id is null and r.status = 'succeeded'`,
    [...params, target.project, target.video],
  );
  done();
}

// ── Projects and videos ────────────────────────────────────────────────────

export async function createProject(fd: FormData) {
  await requireUser();
  const name = text(fd, "name");
  if (!name) fail("/studio/projects", "Give the project a name.");
  const client = text(fd, "client") || null;
  const budget = text(fd, "budget");
  const row = await one(
    `insert into studio.projects (name, client, budget_usd) values ($1, $2, $3)
     on conflict (lower(name)) do nothing returning id`,
    [name, client, budget ? Number(budget) : null],
  );
  if (!row) fail("/studio/projects", "There is already a project with that name.");
  await matchComfy();
  done();
}

export async function updateProject(fd: FormData) {
  await requireAdmin();
  const id = text(fd, "id");
  if (!isUuid(id)) return;
  const status = text(fd, "status");
  if (["active", "done", "archived"].indexOf(status) < 0) return;
  const budget = text(fd, "budget");
  await q(`update studio.projects set name = $2, client = $3, status = $4, budget_usd = $5 where id = $1`, [
    id,
    text(fd, "name"),
    text(fd, "client") || null,
    status,
    budget ? Number(budget) : null,
  ]);
  done();
}

export async function createVideo(fd: FormData) {
  await requireUser();
  const project = text(fd, "project");
  const name = text(fd, "name");
  if (!isUuid(project) || !name) return;
  await q(`insert into studio.videos (project_id, name) values ($1, $2) on conflict do nothing`, [project, name]);
  await matchComfy();
  done();
}

export async function setVideoStatus(fd: FormData) {
  await requireUser();
  const id = text(fd, "id");
  const status = text(fd, "status");
  if (!isUuid(id) || ["in_production", "delivered"].indexOf(status) < 0) return;
  await q(`update studio.videos set status = $2 where id = $1`, [id, status]);
  done();
}

// ── Language ───────────────────────────────────────────────────────────────

/** Remembers the language this person reads the studio in, on this browser. */
export async function setStudioLang(lang: string) {
  await requireUser();
  cookies().set(LANG_COOKIE, langOf(lang), {
    path: "/studio",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  done();
}

// ── Potential clients: the team's estimates go back to Notion ──────────────

const CLIENTS = "/studio/clients";

/** Back to the project that was being worked on, with its dropdown still open. */
const clientsError = (project: string, message: string): never =>
  redirect(`${CLIENTS}?${new URLSearchParams({ ...(isUuid(project) && { open: project }), e: message })}`);

/** The cost range and the days from a form, or the reason they can't be used. */
function estimateOf(fd: FormData): Estimate | string {
  const num = (k: string) => (text(fd, k) === "" ? NaN : Number(text(fd, k)));
  const [low, high, days] = [num("low"), num("high"), num("days")];
  if (![low, high, days].every(Number.isFinite)) return "Fill in both ends of the cost range and the days.";
  if (low < 0 || high > 10_000_000 || high < low) return "The cost range has to go from the lower number to the higher one.";
  if (days <= 0 || days > 3650) return "The days have to be more than zero.";
  const cents = (n: number) => Math.round(n * 100) / 100;
  return { low: cents(low), high: cents(high), days: Math.round(days * 2) / 2 };
}

function clientsDone(project: string, result: Submitted): never {
  done();
  const query = new URLSearchParams(
    result.complete ? { sent: result.project } : { open: project, saved: result.idea },
  );
  return redirect(`${CLIENTS}?${query}`);
}

export async function submitIdeaEstimate(fd: FormData) {
  const user = await requireUser();
  const project = text(fd, "project");
  const idea = text(fd, "idea");
  if (!isUuid(project) || !isUuid(idea)) fail(CLIENTS, "That idea wasn't found.");
  const estimate = estimateOf(fd);
  if (typeof estimate === "string") return clientsError(project, estimate);

  let result: Submitted;
  try {
    result = await submitEstimate(user, project, idea, estimate);
  } catch (err) {
    console.error("[studio/clients] estimate not saved:", err);
    return clientsError(project, err instanceof Error ? err.message : "Notion didn't accept the estimate. Try again.");
  }
  clientsDone(project, result);
}

export async function addTeamIdea(fd: FormData) {
  const user = await requireUser();
  const project = text(fd, "project");
  if (!isUuid(project)) fail(CLIENTS, "That project wasn't found.");
  const title = text(fd, "title").slice(0, 120);
  const what = text(fd, "what").slice(0, 6000);
  if (!title || !what) return clientsError(project, "An idea needs a short name and a description.");

  const rawSeconds = text(fd, "seconds");
  const seconds = rawSeconds === "" ? null : Number(rawSeconds);
  if (seconds !== null && (!Number.isFinite(seconds) || seconds <= 0 || seconds > 36000)) {
    return clientsError(project, "The length in seconds isn't a number.");
  }
  const estimate = estimateOf(fd);
  if (typeof estimate === "string") return clientsError(project, estimate);

  let result: Submitted;
  try {
    result = await addIdea(user, project, { title, what, seconds, estimate });
  } catch (err) {
    console.error("[studio/clients] idea not added:", err);
    return clientsError(project, err instanceof Error ? err.message : "Notion didn't accept the idea. Try again.");
  }
  clientsDone(project, result);
}

// ── Usage by API key (admin) ───────────────────────────────────────────────

export async function saveUsageAccess(fd: FormData) {
  await requireAdmin();
  const id = text(fd, "access_id");
  const secret = text(fd, "access_secret");
  if (!id || !secret) fail("/studio/settings", "Paste both the Access Key ID and the Secret Access Key.");
  let problem = "";
  try {
    // Proves the key works and does the first import in one go.
    await importKeyUsage({ id, secret });
  } catch (e) {
    problem = e instanceof Error ? e.message : "BytePlus rejected the access key.";
  }
  if (problem) fail("/studio/settings", `That access key didn't work. ${problem}`);
  await q(
    `insert into studio.settings (key, value) values ('byteplus_access', $1)
     on conflict (key) do update set value = excluded.value`,
    [encryptSecret(JSON.stringify({ id, secret }))],
  );
  await q(`delete from studio.settings where key = 'usage_error'`);
  done();
}

export async function removeUsageAccess() {
  await requireAdmin();
  await q(`delete from studio.settings where key in ('byteplus_access', 'usage_error')`);
  done();
}

export async function setKeyOwner(fd: FormData) {
  await requireAdmin();
  const id = Number(text(fd, "id"));
  const owner = text(fd, "owner");
  if (!Number.isFinite(id) || (owner && !isUuid(owner))) return;
  await q(`update studio.bp_keys set owner_id = $2 where id = $1`, [id, owner || null]);
  done();
}

// ── Naming rules (admin): "if the file name contains X, it's this project" ─

export async function addNameRule(fd: FormData) {
  await requireAdmin();
  const matchText = text(fd, "text");
  const target = await resolveTarget(text(fd, "target"));
  if (matchText.replace(/[^a-z0-9]/gi, "").length < 2) fail("/studio/projects", "Enter at least two letters or numbers to look for.");
  if (!target || !target.project) fail("/studio/projects", "Choose a project for that name.");
  await q(
    `insert into studio.name_rules (match_text, project_id, video_id) values ($1, $2, $3)
     on conflict (lower(match_text)) do update set project_id = excluded.project_id, video_id = excluded.video_id`,
    [matchText, target!.project, target!.video],
  );
  await matchComfy();
  done();
}

export async function deleteNameRule(fd: FormData) {
  await requireAdmin();
  const id = text(fd, "id");
  if (!isUuid(id)) return;
  await q(`delete from studio.name_rules where id = $1`, [id]);
  done();
}

// ── Settings (admin) ───────────────────────────────────────────────────────

export async function addUser(fd: FormData) {
  await requireAdmin();
  const email = text(fd, "email").toLowerCase();
  const name = text(fd, "name");
  const role = text(fd, "role");
  if (!/^\S+@\S+\.\S+$/.test(email) || !name || ["admin", "producer"].indexOf(role) < 0) {
    fail("/studio/settings", "Enter a name, a valid email and a role.");
  }
  const row = await one(
    `insert into studio.users (email, name, role) values ($1, $2, $3) on conflict (email) do nothing returning id`,
    [email, name, role],
  );
  if (!row) fail("/studio/settings", "That email already has an account.");
  done();
}

export async function setUserActive(fd: FormData) {
  const me = await requireAdmin();
  const id = text(fd, "id");
  if (!isUuid(id) || id === me.id) return;
  const active = text(fd, "active") === "true";
  await q(`update studio.users set active = $2 where id = $1`, [id, active]);
  if (!active) await q(`delete from studio.sessions where user_id = $1`, [id]);
  done();
}

/** Returns the link to hand over. Also how a forgotten password gets reset. */
export async function createSetupLink(userId: string): Promise<string> {
  await requireAdmin();
  if (!isUuid(userId)) return "";
  const token = await createSetupToken(userId);
  const base = process.env.NODE_ENV === "production" ? "https://ipanimations.ai" : "http://localhost:3100";
  return `${base}/studio/setup?t=${token}`;
}

export async function addApiKey(fd: FormData) {
  const admin = await requireAdmin();
  const label = text(fd, "label");
  const secret = text(fd, "secret");
  if (!label || !secret) fail("/studio/settings", "Enter a label and the key.");
  let problem = "";
  try {
    await fetchTaskPage(secret, 1, 1);
  } catch (e) {
    problem = e instanceof Error ? e.message : "BytePlus rejected the key.";
  }
  if (problem) fail("/studio/settings", `That key didn't work. ${problem}`);
  await q(`insert into studio.api_keys (label, user_id, secret_enc, last4) values ($1, $2, $3, $4)`, [
    label,
    admin.id,
    encryptSecret(secret),
    secret.slice(-4),
  ]);
  await syncAll();
  done();
}

export async function setApiKeyActive(fd: FormData) {
  await requireAdmin();
  const id = text(fd, "id");
  if (!isUuid(id)) return;
  await q(`update studio.api_keys set active = $2 where id = $1`, [id, text(fd, "active") === "true"]);
  done();
}

export async function saveRate(fd: FormData) {
  await requireAdmin();
  const model = text(fd, "model");
  const resolution = text(fd, "resolution").toLowerCase() || "*";
  const value = Number(text(fd, "rate"));
  const withVideo = text(fd, "with_video") ? Number(text(fd, "with_video")) : null;
  if (!model || !(value >= 0) || (withVideo !== null && !(withVideo >= 0))) fail("/studio/settings", "Enter a model and a price.");
  await q(
    `insert into studio.rates (model, resolution, usd_per_million, with_video_usd) values ($1, $2, $3, $4)
     on conflict (model, resolution) do update set usd_per_million = excluded.usd_per_million, with_video_usd = excluded.with_video_usd`,
    [model, resolution, value, withVideo],
  );
  await repriceUnpriced();
  await priceKeyUsage();
  done();
}

export async function deleteRate(fd: FormData) {
  await requireAdmin();
  await q(`delete from studio.rates where model = $1 and resolution = $2`, [text(fd, "model"), text(fd, "resolution")]);
  done();
}

export async function saveTimezone(fd: FormData) {
  await requireAdmin();
  const tz = text(fd, "timezone");
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
  } catch {
    fail("/studio/settings", "That isn't a time zone name. Try America/Toronto.");
  }
  await q(
    `insert into studio.settings (key, value) values ('timezone', $1)
     on conflict (key) do update set value = excluded.value`,
    [tz],
  );
  done();
}
