import type { Metadata } from "next";
import { brand, reelHighlights } from "@/content/site";
import { mediaUrl } from "@/lib/media";
import Logo from "@/components/Logo";

export const metadata: Metadata = {
  title: `Our reel — ${brand.name}`,
  description: "Our showreel, a product explainer and a product promo, each in its own section.",
  alternates: { canonical: "/reel" },
};

export default function ReelPage() {
  return (
    <>
      <header className="top">
        <a href="/" className="top__logo" aria-label={`${brand.name} — home`}>
          <Logo variant="colour" />
        </a>
        <nav className="top__nav">
          <a href="/#quote" className="btn btn--sm top__cta">
            {brand.book}
          </a>
        </nav>
      </header>
      <main id="main" className="section section--charcoal reelpage">
        <div className="wrap reelpage__wrap">
          <div className="reelpage__intro">
            <p className="label reelpage__label">Our reel</p>
            <h1 className="h2">
              Three pieces, three ways to tell a story<span className="dot" />
            </h1>
            <nav className="reelpage__jump" aria-label="Jump to a video">
              {reelHighlights.map((h, i) => (
                <a key={h.id} href={`#${h.id}`} className="reelpage__chip">
                  <span className="reelpage__chipnum">{String(i + 1).padStart(2, "0")}</span>
                  {h.kind}
                </a>
              ))}
            </nav>
          </div>

          {reelHighlights.map((h, i) => {
            const src = mediaUrl(h.src);
            const square = h.aspect === "1 / 1";
            return (
              <section
                key={h.id}
                id={h.id}
                className={`reelhl${square ? " reelhl--square" : ""}`}
                aria-labelledby={`${h.id}-title`}
              >
                <div className="reelhl__media">
                  {src ? (
                    <video
                      className="reelhl__video"
                      style={{ aspectRatio: h.aspect }}
                      src={src}
                      poster={mediaUrl(h.poster)}
                      controls
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <p className="body">This video is on its way.</p>
                  )}
                </div>
                <div className="reelhl__text">
                  <p className="label reelhl__kind">
                    <span className="reelhl__num">{String(i + 1).padStart(2, "0")}</span>
                    {h.kind}
                  </p>
                  <h2 id={`${h.id}-title`} className="reelhl__title">
                    {h.title}
                  </h2>
                  <p className="body">{h.blurb}</p>
                </div>
              </section>
            );
          })}

          <div className="reelpage__end">
            <a href="/#quote" className="btn btn--lg">
              {brand.book}
            </a>
            <a href="/#work" className="reelpage__more">
              See more of our work
            </a>
            <a href={`mailto:${brand.email}`} className="reelpage__mail">
              {brand.email}
            </a>
          </div>
        </div>
      </main>
    </>
  );
}
