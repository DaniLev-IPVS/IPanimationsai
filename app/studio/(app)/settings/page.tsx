import { requireUser } from "@/lib/studio/auth";
import { getTimezone, one, q } from "@/lib/studio/db";
import {
  addApiKey,
  addUser,
  createComfyToken,
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

function Comfy({ connected, lastSeen }: { connected: boolean; lastSeen: string }) {
  return (
    <section className="st-card st-panel">
      <h2>ComfyUI</h2>
      <p>This tells the dashboard which project each render belongs to. Without it, renders still appear and can be assigned by hand.</p>
      <ol className="st-steps">
        <li>
          Get your token.{" "}
          <RevealAction
            action={createComfyToken}
            label={connected ? "Make a new token" : "Make my token"}
            note="Shown once. A new token replaces the old one."
          />
        </li>
        <li>
          Download <a href="/studio/comfy-tracker.py" download>comfy-tracker.py</a> and leave it running beside ComfyUI:
          <pre><code>python3 comfy-tracker.py --token YOUR_TOKEN</code></pre>
        </li>
        <li>
          In your save node, set <code>filename_prefix</code> to <code>Project Name/Video Name/shot</code>. The project name must match one in Projects.
        </li>
      </ol>
      <p className="st-muted st-small">Tracker last checked in: {lastSeen}</p>
    </section>
  );
}

export default async function Settings({ searchParams }: { searchParams: { e?: string } }) {
  const user = await requireUser();
  const tz = await getTimezone();
  const me = await one<{ comfy_token_hash: string | null; comfy_last_seen: string | null }>(
    `select comfy_token_hash, comfy_last_seen from studio.users where id = $1`,
    [user.id],
  );
  const comfy = <Comfy connected={Boolean(me?.comfy_token_hash)} lastSeen={fmt(me?.comfy_last_seen ?? null, tz)} />;

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
                  <td>{!u.active ? "Turned off" : u.has_password ? "Active" : "Waiting for password"}</td>
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
