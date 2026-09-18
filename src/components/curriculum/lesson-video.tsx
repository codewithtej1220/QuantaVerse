"use client";

import { useMemo, type ReactNode } from "react";
import { Film } from "lucide-react";

import type { LessonVideo } from "@/lib/lessons";

/**
 * The lesson's recording.
 *
 * Takes whatever address the author pasted and works out how to play it, rather
 * than making them declare a provider alongside it — a second field describing
 * the first is a field that ends up disagreeing with it.
 *
 * The empty state is the part worth caring about. A lesson with no recording
 * yet says so in a framed slot the same size the player will be, so the page
 * does not reflow when one is added and the reader is told plainly that the
 * theory below is the whole lesson for now. The alternative — an embed pointed
 * at a URL that does not resolve — renders as a dead grey rectangle with no
 * explanation, and costs the lesson more credibility than having no video at
 * all ever would.
 */

/** A YouTube or Vimeo id, or null if this is a plain file. */
function embedSrc(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = parsed.pathname.slice(1);
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtube-nocookie.com"
    ) {
      /* An address pasted straight out of YouTube's embed dialog already points
         at /embed/ and carries whatever options were ticked there. Keep the
         query — those options are the author's choice — and move the host, so
         an embed from the share panel gets the same no-cookie treatment as a
         plain watch link instead of quietly opting out of it. */
      if (parsed.pathname.startsWith("/embed/")) {
        const id = parsed.pathname.slice("/embed/".length);
        return id
          ? `https://www.youtube-nocookie.com/embed/${id}${parsed.search}`
          : null;
      }
      const id = parsed.searchParams.get("v");
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === "vimeo.com") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    return null;
  } catch {
    return null;
  }
}

export function LessonPlayer({
  video,
  title,
  emptyAction,
}: {
  video?: LessonVideo;
  title: string;
  /** Offered in the empty slot, when there is something better to do there. */
  emptyAction?: ReactNode;
}) {
  const embed = useMemo(() => (video ? embedSrc(video.url) : null), [video]);

  if (!video) {
    return (
      <div className="mt-5 flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-edge-hi bg-void text-center">
        <Film className="size-6 text-dim" aria-hidden />
        <p className="font-mono text-[11px] tracking-[0.14em] text-dim uppercase">
          Recording not made yet
        </p>
        <p className="max-w-sm px-6 text-[12.5px] leading-snug text-dim">
          The written lesson below is complete on its own. A video goes here
          when it is recorded.
        </p>
        {emptyAction}
      </div>
    );
  }

  return (
    <figure className="mt-5">
      <div className="aspect-video w-full overflow-hidden rounded-xl border border-edge bg-void">
        {embed ? (
          <iframe
            src={embed}
            title={title}
            loading="lazy"
            /* YouTube refuses to play an embed that arrives without a
               referrer (its "error 153"), so this states the policy it relies
               on instead of inheriting whatever the page is later given. */
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            className="size-full"
          />
        ) : (
          // Not a provider we recognise, so treat it as a file and let the
          // browser decide. `controls` rather than autoplay: a lesson page that
          // starts talking at you is a lesson page people close.
          <video
            src={video.url}
            controls
            preload="metadata"
            className="size-full"
          >
            Your browser cannot play this video.
          </video>
        )}
      </div>
      {(video.minutes || video.caption) && (
        <figcaption className="mt-2 flex flex-wrap items-baseline gap-x-2 text-[12.5px] text-dim">
          {video.minutes && (
            <span className="font-mono text-[11px] tracking-[0.12em] uppercase">
              {video.minutes} min
            </span>
          )}
          {video.caption && <span>{video.caption}</span>}
        </figcaption>
      )}
    </figure>
  );
}
