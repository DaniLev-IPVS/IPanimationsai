import { requireUser } from "@/lib/studio/auth";
import { getTimezone, one, q } from "@/lib/studio/db";
import {
  addApiKey,
  addUser,
  createSetupLink,
  deleteRate,
  saveRate,
  saveTimezone,
  setApiKeyActive,
  setUserActive,
} from "../../actions";
import { RevealAction, SubmitButton } from "../../ui";

const fmt = (v: string | null, tz: string) =>
  v ? new Date(v).toLocaleString("en-US", { timeZone: tz, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Never";

// The tracker says hello every 5 minutes while ComfyUI is open.
const isOnline = (lastSeen: string | null | undefined) => Boolean(lastSeen) && Date.now() - Date.parse(String(lastSeen)) < 12 * 60000;

function Comfy({ online, lastSeen, names }: { online: boolean; lastSeen: string; names: { label: string; project: string }[] }) {
  return (
    <section className="st-card st-panel">
      <div className="st-panel-head">
        <h2>Connect ComfyUI</h2>
        {online ? <span className="st-chip st-chip-active">Connected</span> : <span className="st-chip">Not connected</span>}
      </div>
      <p>You only do this once, and it takes about two minutes. There&apos;s no code and nothing to install.</p>
      <ol className="st-steps">
        <li>
          Click this button. Your browser saves a file called <b>ipa_studio_tracker.py</b>.
          <form method="post" action="/api/studio/comfy/tracker" className="st-step-action">
            <button className="st-btn st-btn-primary" type="submit">Download my tracker</button>
          </form>
        </li>
        <li>
          Find ComfyUI&apos;s <b>custom_nodes</b> folder.
          <ul className="st-sublist">
            <li>ComfyUI desktop app: open the <b>Help</b> menu and choose to open the custom nodes folder.</li>
            <li>Any other install: open your <b>ComfyUI</b> folder. <b>custom_nodes</b> is inside it.</li>
          </ul>
        </li>
        <li>Drag <b>ipa_studio_tracker.py</b> from your Downloads into that folder. Put it directly in the folder, not inside another folder.</li>
        <li>Quit ComfyUI completely and open it again.</li>
        <li>Wait a few seconds, then refresh this page. The label at the top should say <b>Connected</b>.</li>
      </ol>

      <h3 className="st-subhead">Naming your videos</h3>
      <p>
        Name videos the way you normally do, and include the project&apos;s name anywhere in it. For example, <code>Wooshi_ep3_shot</code> goes to the Wooshi project. Type it once in the save node&apos;s <b>filename_prefix</b> box. ComfyUI remembers it with that workflow, so you won&apos;t need to type it again.
      </p>
      {names.length ? (
        <p className="st-small">
          <b>Names the dashboard recognizes:</b>{" "}
          {names.map((n, i) => (
            <span key={n.label}>
              {i ? ", " : ""}<code>{n.label}</code>{n.label.toLowerCase() === n.project.toLowerCase() ? "" : ` (${n.project})`}
            </span>
          ))}
        </p>
      ) : null}
      <p className="st-muted st-small">
        If a name isn&apos;t recognized, nothing is lost. The render waits under Unassigned until it&apos;s filed.
      </p>
      <p className="st-muted st-small">
        Last connected: {lastSeen}. This file is personal, so please don&apos;t share it. If you download it again, the old one stops working, so replace it in the folder.
      </p>
    </section>
  );
}

export default async function Settings({ searchParams }: { searchParams: { e?: string } }) {
  const user = await requireUser();
  const tz = await getTimezone();
  const me = await one<{ comfy_last_seen: string | null }>(`select comfy_last_seen from studio.users where id = $1`, [user.id]);
  const names = await q<{ label: string; project: string }>(
    `select n.match_text as label, p.name as project from studio.name_rules n join studio.projects p on p.id = n.project_id
     union
     select name, name from studio.projects where status = 'active'
     order by 1`,
  );
  const comfy = <Comfy online={isOnline(me?.comfy_last_seen)} lastSeen={fmt(me?.comfy_last_seen ?? null, tz)} names={names} />;

  if (user.role !== "admin") {
    return (
      <>
        <div className="st-head"><h1>Settings</h1></div>
        {comfy}
      </>
    );
  }

  const [users, keys, rates, unpriced] = await Promise.all([
    q<{ id: string; name: string; email: string; role: string; active: boolean; has_password: boolean; comfy_last_seen: string | null }>(
      `select id, name, email, role, active, password_hash is not null as has_password, comfy_last_seen from studio.users order by created_at`,
    ),
    q<{ id: string; label: string; last4: string; active: boolean; last_sync_at: string | null; last_sync_error: string | null; person: string }>(
      `select k.id, k.label, k.last4, k.active, k.last_sync_at, k.last_sync_error, u.name as person
         from studio.api_keys k join studio.users u on u.id = k.user_id order by k.created_at`,
    ),
    q<{ model: string; resolution: string; usd_per_million: string }>(`select model, resolution, usd_per_million from studio.rates order by model, resolution`),
    q<{ model: string; resolution: string | null; n: number }>(
      `select model, resolution, count(*)::int as n from studio.renders where status = 'succeeded' and cost_usd is null group by 1, 2 order by 3 desc`,
    ),
  ]);

  return (
    <>
      <div className="st-head"><h1>Settings</h1></div>
      {searchParams.e ? <p className="st-error" role="alert">{searchParams.e}</p> : null}

      <section className="st-card st-panel">
        <h2>Team</h2>
        <div className="st-table-wrap">
          <table className="st-table">
            <thead><tr><th>Person</th><th>Role</th><th>Status</th><th>Sign-in link</th><th /></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={u.active ? "" : "is-off"}>
                  <td>{u.name}<small className="st-muted">{u.email}</small></td>
                  <td>{u.role === "admin" ? "Admin" : "Producer"}</td>
                  <td>
                    {!u.active ? "Turned off" : u.has_password ? "Active" : "Waiting for password"}
                    <small className="st-muted">
                      ComfyUI: {isOnline(u.comfy_last_seen) ? "connected" : u.comfy_last_seen ? `last seen ${fmt(u.comfy_last_seen, tz)}` : "not set up"}
                    </small>
                  </td>
                  <td>
                    <RevealAction
                      action={createSetupLink.bind(null, u.id)}
                      label={u.has_password ? "Reset password link" : "Make invite link"}
                      note="Send this to them. It works once, for 72 hours."
                    />
                  </td>
                  <td className="num">
                    {u.id !== user.id ? (
                      <form action={setUserActive}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="active" value={String(!u.active)} />
                        <button className="st-link" type="submit">{u.active ? "Turn off" : "Turn on"}</button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form action={addUser} className="st-form-row st-form-top">
          <label>Name <input name="name" required /></label>
          <label>Email <input name="email" type="email" required /></label>
          <label>
            Role
            <select name="role" defaultValue="producer">
              <option value="producer">Producer</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <SubmitButton pendingLabel="Adding…">Add person</SubmitButton>
        </form>
      </section>

      <section className="st-card st-panel">
        <h2>BytePlus keys</h2>
        {keys.length ? (
          <div className="st-table-wrap">
            <table className="st-table">
              <thead><tr><th>Key</th><th>Used by</th><th>Last update</th><th /></tr></thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className={k.active ? "" : "is-off"}>
                    <td>{k.label}<small className="st-muted">ends in {k.last4}</small></td>
                    <td>{k.person}</td>
                    <td>
                      {fmt(k.last_sync_at, tz)}
                      {k.last_sync_error ? <small className="st-error-text">{k.last_sync_error}</small> : null}
                    </td>
                    <td className="num">
                      <form action={setApiKeyActive}>
                        <input type="hidden" name="id" value={k.id} />
                        <input type="hidden" name="active" value={String(!k.active)} />
                        <button className="st-link" type="submit">{k.active ? "Stop tracking" : "Track again"}</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="st-empty">No keys yet. Paste the key you gave your producer.</p>
        )}
        <form action={addApiKey} className="st-form-row st-form-top" autoComplete="off">
          <label>Label <input name="label" placeholder="Producer key" required /></label>
          <label>BytePlus API key <input name="secret" type="password" autoComplete="off" required /></label>
          <label>
            Used by
            <select name="person" required defaultValue="">
              <option value="" disabled>Choose</option>
              {users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>
          <SubmitButton className="st-btn st-btn-primary" pendingLabel="Checking…">Add key</SubmitButton>
        </form>
        <p className="st-muted st-small">Stored encrypted and never shown again. Stopping tracking doesn&apos;t disable the key on BytePlus.</p>
      </section>

      <section className="st-card st-panel">
        <h2>Price list</h2>
        <p className="st-muted st-small">USD per million tokens. A render keeps the price it got when it finished.</p>
        {unpriced.length ? (
          <p className="st-note">
            Missing a price: {unpriced.map((u) => `${u.model}${u.resolution ? ` at ${u.resolution}` : ""} (${u.n})`).join(", ")}
          </p>
        ) : null}
        <div className="st-table-wrap">
          <table className="st-table">
            <thead><tr><th>Model</th><th>Resolution</th><th className="num">Price</th><th /></tr></thead>
            <tbody>
              {rates.map((r) => (
                <tr key={`${r.model}${r.resolution}`}>
                  <td>{r.model}</td>
                  <td>{r.resolution === "*" ? "Any" : r.resolution}</td>
                  <td className="num">${Number(r.usd_per_million).toFixed(2)}</td>
                  <td className="num">
                    <form action={deleteRate}>
                      <input type="hidden" name="model" value={r.model} />
                      <input type="hidden" name="resolution" value={r.resolution} />
                      <button className="st-link" type="submit">Remove</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form action={saveRate} className="st-form-row st-form-top">
          <label>Model or endpoint id <input name="model" required /></label>
          <label>Resolution <input name="resolution" placeholder="720p, or blank for any" /></label>
          <label>Price <input name="rate" type="number" min="0" step="0.0001" required /></label>
          <SubmitButton pendingLabel="Saving…">Save price</SubmitButton>
        </form>
      </section>

      <section className="st-card st-panel">
        <h2>Time zone</h2>
        <form action={saveTimezone} className="st-form-row">
          <label>Days start and end in <input name="timezone" defaultValue={tz} required /></label>
          <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
        </form>
      </section>

      {comfy}
    </>
  );
}
