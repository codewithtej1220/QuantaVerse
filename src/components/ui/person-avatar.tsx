import Image from "next/image";

import { TONE, personTone } from "@/lib/tone";
import { cn } from "@/lib/utils";

/**
 * A person, as a face or as their initials in their own colour.
 *
 * The colour is picked from the handle (or the name), so it is the same on
 * the teaching page, the hub and a module's byline: a list of initials is only
 * scannable if each set of letters is always the same colour.
 */

const SIZE = {
  sm: { box: "size-8 text-[11.5px]", px: 32 },
  md: { box: "size-10 text-[13px]", px: 40 },
  lg: { box: "size-11 text-[14px]", px: 44 },
} as const;

export function initialsFor(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export function PersonAvatar({
  name,
  toneKey,
  src,
  size = "md",
  className,
}: {
  name: string;
  /** What the colour is picked from: a handle, ideally, which never changes. */
  toneKey?: string;
  src?: string | null;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const { box, px } = SIZE[size];
  if (src) {
    return (
      <Image
        src={src}
        alt=""
        width={px}
        height={px}
        className={cn(box, "shrink-0 rounded-full object-cover ring-1 ring-white/15", className)}
      />
    );
  }
  const tone = TONE[personTone(toneKey ?? name)];
  return (
    <span
      aria-hidden
      className={cn(
        box,
        "grid shrink-0 place-items-center rounded-full font-semibold ring-1",
        tone.soft,
        tone.text,
        tone.ring,
        className,
      )}
    >
      {initialsFor(name)}
    </span>
  );
}
