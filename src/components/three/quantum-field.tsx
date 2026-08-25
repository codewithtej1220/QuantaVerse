"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { useGlobalPointer, useReducedMotion } from "@/lib/pointer";
import { SPHERE_ANCHOR_ID } from "./anchor";
import { BlochSphere } from "./bloch-sphere";
import { ParticleLattice } from "./particle-lattice";

/**
 * Anchors the sphere to a DOM box.
 *
 * The hero reserves an empty element (#bloch-anchor) in its layout; the sphere
 * is positioned and scaled to sit inside that box. This keeps the 3D aligned
 * with the type at every breakpoint instead of relying on hand-tuned world
 * offsets that only hold at one window size.
 */
function AnchoredSphere({ reducedMotion }: { reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const canvas = useThree((state) => state.gl.domElement);
  const viewport = useThree((state) => state.viewport);
  const size = useThree((state) => state.size);
  const target = useRef({ x: 0, y: 0, scale: 0.7 });
  const settled = useRef(false);

  useEffect(() => {
    const anchor = document.getElementById(SPHERE_ANCHOR_ID);
    if (!anchor) return;

    const measure = () => {
      const canvasBox = canvas.getBoundingClientRect();
      const anchorBox = anchor.getBoundingClientRect();
      if (!canvasBox.width || !canvasBox.height) return;

      const centreX = anchorBox.left + anchorBox.width / 2 - canvasBox.left;
      const centreY = anchorBox.top + anchorBox.height / 2 - canvasBox.top;

      const diameter = Math.min(anchorBox.width, anchorBox.height) * 0.94;
      const worldRadius = (diameter / 2 / canvasBox.height) * viewport.height;

      target.current = {
        x: (centreX / canvasBox.width - 0.5) * viewport.width,
        y: -(centreY / canvasBox.height - 0.5) * viewport.height,
        scale: Math.max(0.3, worldRadius / 1.55),
      };

      // Jump into place on first measure; animate on later reflows.
      if (!settled.current && group.current) {
        group.current.position.set(target.current.x, target.current.y, 0);
        group.current.scale.setScalar(target.current.scale);
        settled.current = true;
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(anchor);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", measure);
    };
  }, [canvas, viewport.width, viewport.height, size.width, size.height]);

  // Ease toward the anchored position so reflows are not jarring.
  useFrame((_, delta) => {
    const node = group.current;
    if (!node) return;
    const ease = Math.min(1, delta * 7);
    node.position.x += (target.current.x - node.position.x) * ease;
    node.position.y += (target.current.y - node.position.y) * ease;
    node.scale.setScalar(node.scale.x + (target.current.scale - node.scale.x) * ease);
  });

  return (
    <group ref={group}>
      <BlochSphere reducedMotion={reducedMotion} />
    </group>
  );
}

export default function QuantumField({ showSphere = true }: { showSphere?: boolean }) {
  useGlobalPointer();
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Stop rendering while the tab is hidden — no reason to burn a GPU.
    const onVisibility = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return (
    <Canvas
      dpr={[1, 1.75]}
      frameloop={visible ? "always" : "never"}
      camera={{ position: [0, 0, 8], fov: 42 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ pointerEvents: "none" }}
      fallback={null}
    >
      <ParticleLattice reducedMotion={reduced} />
      {showSphere && <AnchoredSphere reducedMotion={reduced} />}
    </Canvas>
  );
}
