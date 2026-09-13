"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Framer Motion, told to respect the same preference everything else does.
 *
 * The rest of the site already honours `prefers-reduced-motion` twice over:
 * `globals.css` collapses every CSS animation and transition to nothing, and
 * the 3D scenes take a `reducedMotion` prop read from the media query, so the
 * cat stops bobbing and the badges stop falling. Framer's animations were the
 * hole in that. They are driven in JavaScript, so a stylesheet cannot reach
 * them, and without this the workspace tabs, the watching toggle, the tutor
 * sidebar and the algorithm narration all kept moving for a reader who had
 * asked the operating system for exactly the opposite.
 *
 * `"user"` rather than `"always"`: it defers to the preference rather than
 * overriding it, and what it disables is transform and layout animation while
 * leaving opacity and colour alone — which is the right line. A thing fading in
 * where it already is does not cause the problem reduced motion exists to
 * prevent; a thing sliding across the screen does.
 */
export function MotionPreferences({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
