"use client";

import { usePathname } from "next/navigation";

import { FieldMount } from "./stage-mount";

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

  // The two pages with a circuit deck on them get the quiet field: the deck is
  // already answering the cursor, and it should stay the thing that does.
  const working = path.startsWith("/sandbox") || path.startsWith("/lab");

  return <FieldMount intensity={working ? "quiet" : "ambient"} />;
}
