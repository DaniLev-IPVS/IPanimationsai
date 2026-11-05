import type { Metadata } from "next";
import { brand } from "@/content/site";
import { mediaUrl } from "@/lib/media";
import Logo from "@/components/Logo";

const REEL_KEY = "reel/sizzle-wide-v2.mp4";
const POSTER_KEY = "reel/sizzle-wide-v2.jpg";

export const metadata: Metadata = {
  title: `Our reel — ${brand.name}`,
  description: "A 20-second look at the animation we make.",
  alternates: { canonical: "/reel" },
};

export default function ReelPage() {
  const src = mediaUrl(REEL_KEY);
  const poster = mediaUrl(POSTER_KEY);

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
          <p className="label reelpage__label">Our reel</p>
          {src ? (
            <video
              className="reelpage__video"
              src={src}
              poster={poster}
              controls
              playsInline
              preload="metadata"
            />
          ) : (
            <p className="body">The reel is on its way.</p>
          )}
          <div className="reelpage__end">
            <a href="/#work" className="btn btn--lg">
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
