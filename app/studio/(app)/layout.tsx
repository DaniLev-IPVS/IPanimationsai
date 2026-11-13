import Link from "next/link";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/studio/auth";
import { DICT, LANG_COOKIE, langOf } from "@/lib/studio/i18n";
import { logout } from "../actions";
import { NavLinks } from "../ui";

export const dynamic = "force-dynamic";

export default async function StudioApp({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const L = DICT[langOf(cookies().get(LANG_COOKIE)?.value)];
  return (
    <>
      <header className="st-top">
        <div className="st-wrap st-top-in">
          <Link href="/studio" className="st-brand">Studio</Link>
          <NavLinks labels={{ spend: L.navSpend, projects: L.navProjects, clients: L.navClients, settings: L.navSettings }} />
          <form action={logout} className="st-who">
            <span className="st-muted">
              {user.name}
              <span className="st-role">{user.role === "admin" ? L.admin : L.producer}</span>
            </span>
            <button type="submit" className="st-link">{L.signOut}</button>
          </form>
        </div>
      </header>
      <main className="st-wrap st-main">{children}</main>
    </>
  );
}
