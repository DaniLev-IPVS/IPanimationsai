"use client";

import { useRef, useState } from "react";
import type { ReelItem } from "@/content/site";
import { mediaUrl } from "@/lib/media";

/**
 * A click-to-play facade rather than a live player.
 *
 * Ships one poster image; the real <video> or YouTube iframe only mounts
 * when someone presses play. On devices with a real pointer, hovering starts
 * a muted inline preview straight off R2.
 *
 * Items with an R2 `src` play natively from the bucket's CDN. If R2 cannot be
 * reached, pieces that also live on YouTube fall back to the embed.
 */
export default function ReelCard({ item, orientation }: { item: ReelItem; orientation: "h" | "v" }) {
  const [playing, setPlaying] = useState(false);
  const [preview, setPreview] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const [r2Failed, setR2Failed] = useState(false);
  const previewRef = useRef<HTMLVideoElement>(null);

  const yt = item.youtubeId;
  const videoSrc = r2Failed ? undefined : mediaUrl(item.src);
  const r2Poster = r2Failed ? undefined : mediaUrl(item.poster);

  const poster =
    r2Poster ??
    (yt
      ? posterFailed
        ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`
        : orientation === "v"
          ? `https://i.ytimg.com/vi/${yt}/oardefault.jpg`
          : `https://i.ytimg.com/vi/${yt}/maxresdefault.jpg`
      : undefined);

  const unavailable = !videoSrc && !yt;
  if (unavailable && !r2Failed) return null;

  const canHover = typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  return (
    <figure className={`card card--${orientation}`} data-platform id={item.slug}>
      <div
        className="card__frame"
        style={{ aspectRatio: orientation === "v" ? "9 / 16" : "16 / 9" }}
        onMouseEnter={() => canHover && videoSrc && !playing && setPreview(true)}
        onMouseLeave={() => setPreview(false)}
      >
        {unavailable ? (
          <p className="card__fail">This video could not be loaded. Please try again later.</p>
        ) : playing && videoSrc ? (
          <video
            src={videoSrc}
            poster={r2Poster}
            controls
            autoPlay
            playsInline
            preload="metadata"
            aria-label={item.title}
            onError={() => setR2Failed(true)}
          />
        ) : playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0`}
            title={item.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            className="card__play"
            onClick={() => {
              setPreview(false);
              setPlaying(true);
            }}
            aria-label={`Play ${item.title}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={poster}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => (r2Poster ? setR2Failed(true) : setPosterFailed(true))}
            />
            {preview && videoSrc && (
              <video
                ref={previewRef}
                className="card__preview"
                src={videoSrc}
                muted
                loop
                playsInline
                autoPlay
                preload="none"
                aria-hidden="true"
                onError={() => setPreview(false)}
              />
            )}
            <span className="card__playmark" aria-hidden="true">
              <svg viewBox="0 0 48 48" width="28" height="28">
                <path d="M16 10 38 24 16 38z" fill="currentColor" />
              </svg>
            </span>
          </button>
        )}
      </div>

      <figcaption className="card__cap">
        <span className="card__title">{item.title}</span>
        {(item.technique || item.tag) && (
          <span className="label card__tech">
            {item.technique === "HANDMADE" ? "Handmade" : item.technique === "AI" ? "AI" : ""}
            {item.tag && (
              <>
                {item.technique ? " · " : ""}
                {item.tag}
              </>
            )}
          </span>
        )}
      </figcaption>
    </figure>
  );
}
