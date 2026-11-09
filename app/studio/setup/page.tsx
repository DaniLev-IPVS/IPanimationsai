import Link from "next/link";
import { sha256 } from "@/lib/studio/auth";
import { one } from "@/lib/studio/db";
import { setPassword } from "../actions";

export const dynamic = "force-dynamic";

export default async function Setup({ searchParams }: { searchParams: { t?: string; e?: string } }) {
  const token = searchParams.t || "";
  const row = token
    ? await one<{ name: string; email: string }>(
        `select u.name, u.email from studio.setup_tokens t join studio.users u on u.id = t.user_id
          where t.token_hash = $1 and t.used_at is null and t.expires_at > now()`,
        [sha256(token)],
      )
    : null;

  if (!row) {
    return (
      <main className="st-auth">
        <div className="st-card st-auth-card">
          <h1>This link has expired</h1>
          <p className="st-muted">Links work once, for 72 hours. Ask for a new one.</p>
          <Link className="st-btn" href="/studio/login">Back to sign in</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="st-auth">
      <form action={setPassword} className="st-card st-auth-card">
        <h1>Hi {row.name}</h1>
        <p className="st-muted">Choose a password for {row.email}.</p>
        {searchParams.e ? <p className="st-error" role="alert">{searchParams.e}</p> : null}
        <input type="hidden" name="token" value={token} />
        <input type="email" name="username" value={row.email} autoComplete="username" readOnly hidden />
        <label>
          New password
          <input name="password" type="password" autoComplete="new-password" minLength={10} required autoFocus />
        </label>
        <label>
          Type it again
          <input name="confirm" type="password" autoComplete="new-password" minLength={10} required />
        </label>
        <button className="st-btn st-btn-primary" type="submit">Save and sign in</button>
      </form>
    </main>
  );
}
