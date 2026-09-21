"use client";

import { useState } from "react";
import type { ReelItem } from "@/content/site";

/**
 * A click-to-play facade rather than a live iframe.
 *
 * Eleven YouTube embeds would each pull ~1MB of player before anyone pressed
 * anything. This ships a single poster image and only mounts the real iframe
 * once someone actually clicks.
 *
 * Posters come from YouTube's own thumbnail CDN — nothing is downloaded or
 * rehosted. Shorts have a true 1080x1920 frame at `oardefault`, so vertical
 * cards get a real vertical poster instead of a cropped 16:9 one.
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

  const primary =
    orientation === "v"
      ? `https://i.ytimg.com/vi/${item.youtubeId}/oardefault.jpg`
      : `https://i.ytimg.com/vi/${item.youtubeId}/maxresdefault.jpg`;
  const poster = posterFailed
    ? `https://i.ytimg.com/vi/${item.youtubeId}/hqdefault.jpg`
    : primary;

  return (
    <figure className="card">
      <div
        className="card__frame"
        style={{ aspectRatio: orientation === "v" ? "9 / 16" : "16 / 9" }}
      >
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${item.youtubeId}?autoplay=1&rel=0`}
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
        <span className="label card__tech">
          {item.technique}
          {item.tag && <span className="card__tag"> · {item.tag}</span>}
        </span>
        <span className="card__blurb">{item.title}</span>
      </figcaption>
    </figure>
  );
}
