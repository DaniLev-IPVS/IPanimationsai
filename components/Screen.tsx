"use client";

import { useEffect, useRef, useState } from "react";
import { hero, reel } from "@/content/site";
import { mediaUrl } from "@/lib/media";
import { on } from "@/lib/bus";

/**
 * The phone in the hero: a vertical 9:16 screen. Dark until it scrolls into
 * view (or "screen:on" fires), then plays the sizzle. Until the real
 * cut exists it plays a crossfade of the vertical reel posters instead, so the
 * hero already behaves right.
 *
 * If autoplay is refused (Low Power Mode, data saver) it falls back to a
 * poster with tap-to-play.
 */
export default function Screen() {
  const [onAir, setOnAir] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const src = mediaUrl(hero.sizzle.src);
  const poster = mediaUrl(hero.sizzle.poster);
  const hasVideo = Boolean(src);

  // Vertical posters only: the screen is a phone.
  const slides = reel.verticals
    .filter((i) => i.featured && i.poster)
    .map((i) => mediaUrl(i.poster)!)
    .filter(Boolean);

  useEffect(() => on("screen:on", () => setOnAir(true)), []);

  // Switch on when half the phone is in view.
  useEffect(() => {
    const el = document.getElementById("screen");
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setOnAir(true);
          io.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!onAir || !hasVideo) return;
    const v = videoRef.current;
    if (!v) return;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    // React does not reliably emit the `muted` attribute, and an unmuted video
    // is refused autoplay. Set it on the element before asking to play.
    v.muted = true;
    v.defaultMuted = true;
    v.src = src!;
    if (saveData) {
      setBlocked(true);
      return;
    }
    v.play().catch((err: unknown) => {
      console.warn("[screen] autoplay refused:", err instanceof Error ? `${err.name}: ${err.message}` : err);
      setBlocked(true);
    });
  }, [onAir, hasVideo, src]);

  // If autoplay was refused, the first real interaction anywhere on the page
  // counts as user activation: retry quietly, and only keep the tap button if
  // that fails too.
  useEffect(() => {
    if (!blocked) return;
    const v = videoRef.current;
    if (!v) return;
    const retry = () => {
      v.muted = true;
      v.play()
        .then(() => setBlocked(false))
        .catch(() => {});
    };
    const evs: (keyof WindowEventMap)[] = ["pointerdown", "touchend", "keydown", "scroll"];
    evs.forEach((e) => window.addEventListener(e, retry, { once: true, passive: true }));
    const onVis = () => {
      if (document.visibilityState === "visible") retry();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      evs.forEach((e) => window.removeEventListener(e, retry));
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [blocked]);

  return (
    <div className={`screen ${onAir ? "is-on" : ""}`} id="screen" aria-label="Showreel">
      <div className="screen__bezel">
        <span className="screen__notch" aria-hidden="true" />
        <div className="screen__glass">
          {hasVideo ? (
            <>
              <video
                ref={videoRef}
                className="screen__video"
                poster={poster}
                muted
                loop
                playsInline
                preload="none"
                aria-label="Showreel"
              />
              {blocked && (
                <button
                  type="button"
                  className="screen__tap"
                  onClick={() => {
                    setBlocked(false);
                    const el = videoRef.current;
                    if (el) el.muted = true;
                    el?.play().catch(() => setBlocked(true));
                  }}
                >
                  Tap to play
                </button>
              )}
            </>
          ) : (
            <div className="screen__slides" aria-hidden="true">
              {slides.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={src}
                  src={src}
                  alt=""
                  loading={i === 0 ? "eager" : "lazy"}
                  decoding="async"
                  style={{ animationDelay: `${i * 2.2}s`, animationDuration: `${slides.length * 2.2}s` }}
                />
              ))}
            </div>
          )}
          <div className="screen__standby" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
