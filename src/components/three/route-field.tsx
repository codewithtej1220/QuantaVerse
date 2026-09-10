"use client";

import { usePathname } from "next/navigation";

import { StardustMount } from "./stage-mount";

/**
 * The ambient field, everywhere except the page that owns it.
 *
 * Mounted once in the root layout rather than eight times in eight pages, for
 * two reasons. Every page wrapper on this site clips its own horizontal
 * overflow, and a fixed layer is safer outside those than inside them. And the
 * field is a property of the route, not of the page's content — a new page
 * added later gets a background without anyone remembering to ask for one.
 *
 * The landing page is skipped because it mounts the field itself, together
 * with the stage that renders into its zones, and arranges its whole scroll
 * around both.
 */
export function RouteField() {
  const path = usePathname();

  if (path === "/") return null;

  /* Every route gets the same stardust. The old field's three intensity tiers
     existed to stop its bursts and its re-forming shapes going off behind body
     copy and behind a circuit a student is building; the dust has neither, so
     there is nothing left to tier. It ducks behind the fold on its own. */
  return <StardustMount />;
}
