"use client";

import { useState } from "react";
import type { ReelItem } from "@/content/site";
import { mediaUrl } from "@/lib/media";

/**
 * A click-to-play facade rather than a live iframe.
 *
 * Eleven YouTube embeds would each pull ~1MB of player before anyone pressed
 * anything. This ships a single poster image and only mounts the real iframe
 * once someone actually clicks.
 *
 * Items with an R2 `src` play as a native <video> straight off the bucket's
 * CDN. Items without one still use the YouTube embed, with posters from
 * YouTube's thumbnail CDN. Shorts have a true 1080x1920 frame at
 * `oardefault`, so vertical cards get a real vertical poster instead of a
 * cropped 16:9 one.
 */
export default function ReelCard({
  item,
  orientation,
}: {
  item: ReelItem;
  orientation: "h" | "v";
}) {
  const [playing, setPlaying] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);

  // R2 first; YouTube stays as the fallback until a piece has been uploaded.
  const videoSrc = mediaUrl(item.src);
  const r2Poster = mediaUrl(item.poster);

  const yt = item.youtubeId;
  const poster =
    r2Poster ??
    (yt
      ? posterFailed
        ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`
        : orientation === "v"
          ? `https://i.ytimg.com/vi/${yt}/oardefault.jpg`
          : `https://i.ytimg.com/vi/${yt}/maxresdefault.jpg`
      : undefined);

  // R2-only pieces have no YouTube fallback: if R2 is not configured, show nothing
  // rather than a dead card.
  if (!videoSrc && !yt) return null;

  return (
    <figure className="card">
      <div
        className="card__frame"
        style={{ aspectRatio: orientation === "v" ? "9 / 16" : "16 / 9" }}
      >
        {playing && videoSrc ? (
          <video
            src={videoSrc}
            poster={r2Poster}
            controls
            autoPlay
            playsInline
            preload="metadata"
            aria-label={item.title}
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
            onClick={() => setPlaying(true)}
            aria-label={`Play ${item.title}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={poster}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setPosterFailed(true)}
            />
            <span className="card__playmark" aria-hidden="true">
              <svg viewBox="0 0 48 48" width="34" height="34">
                <path d="M16 10 38 24 16 38z" fill="currentColor" />
              </svg>
            </span>
          </button>
        )}
      </div>

      <figcaption className="card__cap">
        {(item.technique || item.tag) && (
          <span className="label card__tech">
            {item.technique}
            {item.tag && (
              <span className="card__tag">
                {item.technique ? " · " : ""}
                {item.tag}
              </span>
            )}
          </span>
        )}
        <span className="card__blurb">{item.title}</span>
      </figcaption>
    </figure>
  );
}
