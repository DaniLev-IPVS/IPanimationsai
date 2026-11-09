import Link from "next/link";
import { requireUser } from "@/lib/studio/auth";
import { logout } from "../actions";
import { NavLinks } from "../ui";

export const dynamic = "force-dynamic";

export default async function StudioApp({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <>
      <header className="st-top">
        <div className="st-wrap st-top-in">
          <Link href="/studio" className="st-brand">Studio</Link>
          <NavLinks />
          <form action={logout} className="st-who">
            <span className="st-muted">
              {user.name}
              <span className="st-role">{user.role === "admin" ? "Admin" : "Producer"}</span>
            </span>
            <button type="submit" className="st-link">Sign out</button>
          </form>
        </div>
      </header>
      <main className="st-wrap st-main">{children}</main>
    </>
  );
}
