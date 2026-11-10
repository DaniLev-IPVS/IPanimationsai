import type { StudioUser } from "./auth";
import { isUuid } from "./db";

export type Group = "day" | "project" | "video" | "model" | "person" | "key";
export type Range = "24h" | "7d" | "30d" | "month" | "lastmonth" | "all" | "custom";

/** The rolling 24-hour view: this hour and the 23 before it. */
export const LAST_24H = `date_trunc('hour', now()) - interval '23 hours'`;

export type Filters = {
  range: Range;
  from: string;
  to: string;
  group: Group;
  project: string;
  person: string;
  unassigned: boolean;
  page: number;
  tz: string;
};

type Params = Record<string, string | string[] | undefined>;

const GROUPS: Group[] = ["day", "project", "video", "model", "person", "key"];
const RANGES: Range[] = ["24h", "7d", "30d", "month", "lastmonth", "all", "custom"];
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Today as YYYY-MM-DD in the studio's time zone. */
export function today(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** The dates a preset range covers, or null for a custom one. */
function presetDates(range: Range, now: string): [string, string] | null {
  if (range === "24h") return [addDays(now, -1), now];
  if (range === "7d") return [addDays(now, -6), now];
  if (range === "30d") return [addDays(now, -29), now];
  if (range === "month") return [`${now.slice(0, 7)}-01`, now];
  if (range === "lastmonth") {
    const lastDay = addDays(`${now.slice(0, 7)}-01`, -1);
    return [`${lastDay.slice(0, 7)}-01`, lastDay];
  }
  if (range === "all") return ["2020-01-01", now];
  return null;
}

export function parseFilters(sp: Params, tz: string, user: StudioUser): Filters {
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const now = today(tz);
  let from = get("from");
  let to = get("to");
  const datesGiven = isDate(from) && isDate(to);
  let range = (RANGES.indexOf(get("range") as Range) >= 0 ? get("range") : datesGiven ? "custom" : "30d") as Range;
  // The filter form sends the preset along with its dates, so Apply keeps
  // "24 hours" selected unless someone actually changed a date.
  const preset = presetDates(range, now);
  if (preset && datesGiven && (from !== preset[0] || to !== preset[1])) range = "custom";

  const dates = presetDates(range, now);
  if (dates) [from, to] = dates;
  else {
    if (!isDate(from)) from = addDays(now, -29);
    if (!isDate(to)) to = now;
    if (from > to) [from, to] = [to, from];
  }

  let group = (GROUPS.indexOf(get("group") as Group) >= 0 ? get("group") : "day") as Group;
  if (group === "person" && user.role !== "admin") group = "day";

  return {
    range,
    from,
    to,
    group,
    project: isUuid(get("project")) || get("project") === "none" ? get("project") : "",
    // A producer's own id is forced in whereOf; this only applies to admins.
    person: user.role === "admin" && isUuid(get("person")) ? get("person") : "",
    unassigned: get("show") === "unassigned",
    page: Math.max(1, parseInt(get("page"), 10) || 1),
    tz,
  };
}

/** SQL conditions for renders (alias r). A producer can only ever see their own. */
export function whereOf(f: Filters, user: StudioUser, opts: { skipProject?: boolean } = {}) {
  const params: unknown[] = [f.from, f.tz, f.to];
  const c = [
    `r.created_at >= ($1::date::timestamp at time zone $2::text)`,
    `r.created_at < (($3::date + 1)::timestamp at time zone $2::text)`,
  ];
  if (f.range === "24h") c.push(`r.created_at >= ${LAST_24H}`);
  const owner = user.role === "admin" ? f.person : user.id;
  if (owner) {
    params.push(owner);
    c.push(`r.user_id = $${params.length}::uuid`);
  }
  if (!opts.skipProject) {
    if (f.project === "none") c.push(`r.project_id is null`);
    else if (f.project) {
      params.push(f.project);
      c.push(`r.project_id = $${params.length}::uuid`);
    }
  }
  if (f.unassigned) c.push(`r.project_id is null and r.status = 'succeeded'`);
  return { where: c.join(" and "), params };
}

export function toQuery(f: Filters, over: Record<string, string | number | undefined> = {}): string {
  const base: Record<string, string | number | undefined> = {
    range: f.range === "custom" ? undefined : f.range,
    from: f.range === "custom" ? f.from : undefined,
    to: f.range === "custom" ? f.to : undefined,
    group: f.group === "day" ? undefined : f.group,
    project: f.project || undefined,
    person: f.person || undefined,
    show: f.unassigned ? "unassigned" : undefined,
  };
  const merged = { ...base, ...over };
  const out = Object.keys(merged)
    .filter((k) => merged[k] !== undefined && merged[k] !== "")
    .map((k) => `${k}=${encodeURIComponent(String(merged[k]))}`)
    .join("&");
  return out ? `?${out}` : "";
}

export const usd = (v: number | string | null | undefined) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(v || 0));

export const num = (v: number | string | null | undefined) => new Intl.NumberFormat("en-US").format(Number(v || 0));
