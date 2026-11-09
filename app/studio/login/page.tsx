import { redirect } from "next/navigation";
import { getUser } from "@/lib/studio/auth";
import { login } from "../actions";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: { e?: string } }) {
  if (await getUser()) redirect("/studio");
  return (
    <main className="st-auth">
      <form action={login} className="st-card st-auth-card">
        <h1>Studio</h1>
        <p className="st-muted">Sign in to see renders, spend and projects.</p>
        {searchParams.e ? <p className="st-error" role="alert">{searchParams.e}</p> : null}
        <label>
          Email
          <input name="email" type="email" autoComplete="username" required autoFocus />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button className="st-btn st-btn-primary" type="submit">Sign in</button>
      </form>
    </main>
  );
}
