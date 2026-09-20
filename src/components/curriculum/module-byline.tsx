import Image from "next/image";

import { instructorFor } from "@/lib/instructors";
import { cn } from "@/lib/utils";

/**
 * "Module by …", with the instructor's portrait beside it.
 *
 * The small form sits on a row of the curriculum or a card; the large one heads
 * a module's own page, with the instructor's post and institution under it.
 */
export function ModuleByline({
  slug,
  size = "sm",
  className,
}: {
  slug: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const instructor = instructorFor(slug);
  if (!instructor) return null;
  const px = size === "md" ? 44 : 28;

  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <Image
        src={instructor.photo}
        alt=""
        width={px}
        height={px}
        className="shrink-0 rounded-full object-cover ring-1 ring-edge-hi ring-offset-2 ring-offset-nebula"
        style={{ width: px, height: px }}
      />
      <span className="min-w-0 leading-snug">
        <span
          className={cn(
            "block truncate text-paper",
            size === "md" ? "text-[15px] font-medium" : "text-[13px]",
          )}
        >
          <span className="text-frost">Module by </span>
          {instructor.name}
        </span>
        {/* Wraps rather than truncating: on a phone an ellipsis would cut
            the post and the institution short. */}
        {size === "md" && (
          <span className="block text-[12.5px] text-frost">
            {instructor.position} · {instructor.institution}
          </span>
        )}
      </span>
    </span>
  );
}
