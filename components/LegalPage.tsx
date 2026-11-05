import { brand } from "@/content/site";
import Logo from "./Logo";
import { Footer } from "./Chrome";

/** The shell for /privacy and /terms: plain header, readable column, footer. */
export default function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="top">
        <a href="/" className="top__logo" aria-label={`${brand.name} — home`}>
          <Logo variant="colour" />
        </a>
        <nav className="top__nav">
          <a href="/book" className="btn btn--sm top__cta">
            Book a call
          </a>
        </nav>
      </header>
      <main id="main" className="section section--paper legal">
        <article className="wrap legal__wrap">
          <p className="label legal__label">Legal</p>
          <h1 className="h2 legal__title">{title}</h1>
          <p className="legal__updated">Last updated {updated}</p>
          <div className="legal__body">{children}</div>
        </article>
      </main>
      <Footer bookHref="/book" bookLabel="Book a call" plain />
    </>
  );
}
