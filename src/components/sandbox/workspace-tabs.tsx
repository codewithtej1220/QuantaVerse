"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The circuits currently open, as tabs.
 *
 * The sandbox held exactly one circuit, so comparing two approaches to the same
 * problem meant rebuilding one of them from memory — and trying an idea meant
 * destroying whatever was already on the board. Tabs are the cheapest fix for
 * both: every workspace keeps its own register width, its own placements, its
 * own code and its own last run, and switching between them costs nothing.
 *
 * A tab is renamed by double-clicking it, which is the convention every editor
 * that has ever had tabs already taught people. The underline is a shared
 * layout animation rather than a border that jumps, so the eye follows the
 * selection instead of re-finding it.
 *
 * The last tab cannot be closed. A sandbox with no circuit in it is not a state
 * worth being able to reach, and a close button that sometimes empties the page
 * is worse than one that is simply absent.
 */

export interface WorkspaceTab {
  id: number;
  name: string;
  /** Gates placed, so a tab can show whether it holds anything yet. */
  gates: number;
}

export function WorkspaceTabs({
  tabs,
  active,
  onSelect,
  onCreate,
  onClose,
  onRename,
}: {
  tabs: WorkspaceTab[];
  active: number;
  onSelect: (index: number) => void;
  onCreate: () => void;
  onClose: (index: number) => void;
  onRename: (index: number, name: string) => void;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const field = useRef<HTMLInputElement>(null);

  const commit = (index: number, value: string) => {
    const cleaned = value.trim().slice(0, 28);
    if (cleaned) onRename(index, cleaned);
    setEditing(null);
  };

  return (
    <div className="flex items-end gap-1 overflow-x-auto border-b border-edge">
      <AnimatePresence initial={false}>
        {tabs.map((tab, index) => {
          const current = index === active;
          return (
            <motion.div
              key={tab.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className={cn(
                "group relative flex shrink-0 items-center gap-2 rounded-t-lg px-3 py-2 transition-colors",
                current ? "bg-nebula" : "hover:bg-strata",
              )}
            >
              {editing === index ? (
                <input
                  ref={field}
                  defaultValue={tab.name}
                  autoFocus
                  onBlur={(event) => commit(index, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") commit(index, event.currentTarget.value);
                    if (event.key === "Escape") setEditing(null);
                  }}
                  className="w-28 bg-transparent font-mono text-[12px] text-paper outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => onSelect(index)}
                  onDoubleClick={() => setEditing(index)}
                  aria-current={current ? "true" : undefined}
                  title="Double-click to rename"
                  className={cn(
                    "font-mono text-[12px] whitespace-nowrap transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon",
                    current ? "text-paper" : "text-frost hover:text-paper",
                  )}
                >
                  {tab.name}
                  <span className="ml-2 text-[10.5px] text-dim tabular-nums">
                    {tab.gates}
                  </span>
                </button>
              )}

              {/* Only when there is somewhere to fall back to. */}
              {tabs.length > 1 && (
                <button
                  type="button"
                  onClick={() => onClose(index)}
                  aria-label={`Close ${tab.name}`}
                  className={cn(
                    "grid size-4 shrink-0 place-items-center rounded transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon",
                    current
                      ? "text-frost hover:bg-strata hover:text-paper"
                      : "text-dim opacity-0 group-hover:opacity-100 hover:text-paper",
                  )}
                >
                  <X className="size-3" aria-hidden />
                </button>
              )}

              {/* One element that slides between tabs, rather than a border
                  appearing and disappearing on each. */}
              {current && (
                <motion.span
                  layoutId="workspace-underline"
                  className="absolute inset-x-0 -bottom-px h-0.5 bg-photon"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>

      <button
        type="button"
        onClick={onCreate}
        aria-label="New circuit"
        title="New circuit"
        className="mb-1 ml-1 grid size-7 shrink-0 place-items-center rounded-md text-frost transition-colors hover:bg-strata hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photon"
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}
