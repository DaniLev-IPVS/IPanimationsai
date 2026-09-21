import { brand } from "@/content/site";

/**
 * The lockup: IP VENTURES big, "animations" small underneath, letterspaced out
 * until it optically spans the width of the word above. That tracking is what
 * makes a two-weight lockup look designed rather than merely stacked.
 */
export function Wordmark({ size = 1, invert = false }: { size?: number; invert?: boolean }) {
  return (
    <span
      className="wordmark"
      style={{ ["--wm" as string]: size, color: invert ? "var(--bone)" : "var(--ink)" }}
    >
      <span className="wordmark__big">{brand.nameBig}</span>
      <span className="wordmark__small">{brand.nameSmall}</span>
    </span>
  );
}

export function Header() {
  return (
    <header className="chrome chrome--top">
      <a href="#hero" aria-label="IP Ventures animations — home">
        <Wordmark size={1} />
      </a>
      <nav className="chrome__nav">
        <a href="#reel" className="label">
          THE WORK
        </a>
        <a href="#start" className="label chrome__cta">
          START
        </a>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="chrome chrome--bottom">
      <Wordmark size={0.78} />
      <div className="chrome__meta">
        <a href={`mailto:${brand.email}`} className="label">
          {brand.email}
        </a>
        <span className="label chrome__dim">
          {brand.domain} · part of IP Ventures
        </span>
      </div>
    </footer>
  );
}
