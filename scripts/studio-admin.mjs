#!/usr/bin/env node
/**
 * Studio tracker admin, run from this machine:
 *
 *   node --env-file=.env.local scripts/studio-admin.mjs migrate
 *   node --env-file=.env.local scripts/studio-admin.mjs user <email> <name> <admin|producer>
 *   node --env-file=.env.local scripts/studio-admin.mjs invite <email>
 *
 * `invite` prints a one-time link where that person chooses their own password.
 * No password ever passes through this script. Emails are arguments, not code,
 * because this repository is public.
 */
import { createHash, randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_API;
if (!url) throw new Error("DATABASE_API is not set");
const sql = neon(url);
const run = (text, params = []) => sql.query(text, params);

const SITE = process.env.STUDIO_URL || "https://ipanimations.ai";

const SCHEMA = [
  `create schema if not exists studio`,
  `create table if not exists studio.users (
    id uuid primary key default gen_random_uuid(),
    email text not null unique,
    name text not null,
    role text not null check (role in ('admin','producer')),
    password_hash text,
    active boolean not null default true,
    comfy_token_hash text,
    comfy_last_seen timestamptz,
    created_at timestamptz not null default now()
  )`,
  `create table if not exists studio.setup_tokens (
    token_hash text primary key,
    user_id uuid not null references studio.users(id) on delete cascade,
    expires_at timestamptz not null,
    used_at timestamptz
  )`,
  `create table if not exists studio.sessions (
    token_hash text primary key,
    user_id uuid not null references studio.users(id) on delete cascade,
    expires_at timestamptz not null
  )`,
  `create table if not exists studio.login_failures (
    email text not null,
    at timestamptz not null default now()
  )`,
  `create index if not exists login_failures_email on studio.login_failures (email, at)`,
  `create table if not exists studio.projects (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    client text,
    status text not null default 'active' check (status in ('active','done','archived')),
    budget_usd numeric(12,2),
    created_at timestamptz not null default now()
  )`,
  `create unique index if not exists projects_name on studio.projects (lower(name))`,
  `create table if not exists studio.videos (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references studio.projects(id) on delete cascade,
    name text not null,
    status text not null default 'in_production' check (status in ('in_production','delivered')),
    created_at timestamptz not null default now()
  )`,
  `create unique index if not exists videos_name on studio.videos (project_id, lower(name))`,
  `create table if not exists studio.name_rules (
    id uuid primary key default gen_random_uuid(),
    match_text text not null,
    project_id uuid not null references studio.projects(id) on delete cascade,
    video_id uuid references studio.videos(id) on delete set null,
    created_at timestamptz not null default now()
  )`,
  `create unique index if not exists name_rules_text on studio.name_rules (lower(match_text))`,
  `create table if not exists studio.bp_keys (
    id bigint primary key,
    name text not null,
    masked_key text,
    last_access text,
    status text,
    owner_id uuid references studio.users(id) on delete set null
  )`,
  `create table if not exists studio.key_usage (
    day date not null,
    auth_token text not null,
    model text not null,
    total_tokens bigint not null default 0,
    requests int not null default 0,
    bp_key_id bigint references studio.bp_keys(id) on delete set null,
    cost_usd numeric(12,4),
    primary key (day, auth_token, model)
  )`,
  `create table if not exists studio.key_usage_hourly (
    at timestamptz not null,
    auth_token text not null,
    model text not null,
    total_tokens bigint not null default 0,
    requests int not null default 0,
    bp_key_id bigint references studio.bp_keys(id) on delete set null,
    cost_usd numeric(12,4),
    primary key (at, auth_token, model)
  )`,
  `create table if not exists studio.api_keys (
    id uuid primary key default gen_random_uuid(),
    label text not null,
    user_id uuid not null references studio.users(id),
    secret_enc text not null,
    last4 text not null,
    active boolean not null default true,
    last_sync_at timestamptz,
    last_sync_error text,
    created_at timestamptz not null default now()
  )`,
  `create table if not exists studio.rates (
    model text not null,
    resolution text not null default '*',
    usd_per_million numeric(10,4) not null,
    primary key (model, resolution)
  )`,
  `create table if not exists studio.renders (
    id text primary key,
    api_key_id uuid references studio.api_keys(id) on delete set null,
    user_id uuid not null references studio.users(id),
    project_id uuid references studio.projects(id) on delete set null,
    video_id uuid references studio.videos(id) on delete set null,
    model text not null,
    status text not null,
    resolution text,
    ratio text,
    duration_s numeric(8,2),
    total_tokens bigint,
    cost_usd numeric(12,4),
    created_at timestamptz not null,
    updated_at timestamptz,
    comfy_prompt_id text,
    comfy_hint text,
    assigned_via text
  )`,
  `create index if not exists renders_created on studio.renders (created_at desc)`,
  `create index if not exists renders_project on studio.renders (project_id)`,
  `create index if not exists renders_user on studio.renders (user_id, created_at desc)`,
  `create table if not exists studio.comfy_runs (
    prompt_id text primary key,
    user_id uuid not null references studio.users(id) on delete cascade,
    workflow text,
    filename_prefix text,
    project_hint text,
    video_hint text,
    started_at timestamptz,
    ended_at timestamptz,
    status text,
    task_ids text[] not null default '{}',
    outputs jsonb,
    received_at timestamptz not null default now()
  )`,
  `create index if not exists comfy_runs_time on studio.comfy_runs (user_id, started_at, ended_at)`,
  `create table if not exists studio.settings (
    key text primary key,
    value text not null
  )`,
];

// BytePlus ModelArk price list, USD per million tokens, online inference
// (docs.byteplus.com/docs/ModelArk/1544106, read 2026-11-09). Editable in Settings.
const RATES = [
  ["dreamina-seedance-2-5-260628", "480p", 10.7],
  ["dreamina-seedance-2-5-260628", "720p", 10.7],
  ["dreamina-seedance-2-5-260628", "1080p", 11.7],
  ["dreamina-seedance-2-0-260128", "480p", 7.0],
  ["dreamina-seedance-2-0-260128", "720p", 7.0],
  ["dreamina-seedance-2-0-260128", "1080p", 7.7],
  ["dreamina-seedance-2-0-260128", "4k", 4.0],
  ["dreamina-seedance-2-0-fast-260128", "480p", 5.6],
  ["dreamina-seedance-2-0-fast-260128", "720p", 5.6],
  ["dreamina-seedance-2-0-mini-260615", "480p", 3.5],
  ["dreamina-seedance-2-0-mini-260615", "720p", 3.5],
  ["seedance-1-0-pro-250528", "*", 2.5],
  ["seedance-1-0-pro-fast-251015", "*", 1.0],
];

async function migrate() {
  for (const stmt of SCHEMA) await run(stmt);
  for (const [m, res, usd] of RATES) {
    await run(
      `insert into studio.rates (model, resolution, usd_per_million) values ($1,$2,$3)
       on conflict (model, resolution) do nothing`,
      [m, res, usd],
    );
  }
  await run(
    `insert into studio.settings (key, value) values ('timezone', 'America/Toronto')
     on conflict (key) do nothing`,
  );
  console.log("Schema ready.");
}

async function user(email, name, role) {
  if (!email || !name || !["admin", "producer"].includes(role)) {
    throw new Error("usage: user <email> <name> <admin|producer>");
  }
  await run(
    `insert into studio.users (email, name, role) values (lower($1), $2, $3)
     on conflict (email) do update set name = excluded.name, role = excluded.role`,
    [email, name, role],
  );
  console.log(`Account ready: ${email} (${role})`);
}

async function invite(email) {
  const rows = await run(`select id from studio.users where email = lower($1)`, [email]);
  if (!rows.length) throw new Error(`No account for ${email}`);
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  await run(
    `insert into studio.setup_tokens (token_hash, user_id, expires_at)
     values ($1, $2, now() + interval '72 hours')`,
    [hash, rows[0].id],
  );
  console.log(`${SITE}/studio/setup?t=${token}`);
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === "migrate") await migrate();
else if (cmd === "user") await user(...args);
else if (cmd === "invite") await invite(...args);
else console.log("commands: migrate | user <email> <name> <role> | invite <email>");
