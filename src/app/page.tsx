import { Film } from "@/components/landing/film";
import { Hero } from "@/components/landing/hero";
import { OpenSource } from "@/components/landing/open-source";
import { Surfaces } from "@/components/landing/surfaces";
import { Workflow } from "@/components/landing/workflow";
import { YourModules } from "@/components/landing/your-modules";
import { BootScreen } from "@/components/site/boot-screen";
import { StageMount } from "@/components/three/stage-mount";

/**
 * The landing page.
 *
 * One continuous field of points runs behind the whole document, and the page
 * is arranged around it: the hero puts a qubit in it, the film hands it four
 * screens of scroll to re-form through, and the sections below let it settle
 * into a haze so the reading is not fighting the motion.
 */
export default function Home() {
  return (
    /* The landing page keeps the instrument dressing — the machined panels,
       the ivory ink and the capitals. Every other route is a working page and
       is set crisper; see the surface tokens in globals.css. */
    <div className="surface-home">
      <BootScreen />

      {/* One field, one stage, behind everything on this route. */}
      <StageMount />

      <Hero />
      <Film />
      <Workflow />
      <Surfaces />
      <YourModules />
      <OpenSource />
    </div>
  );
}
