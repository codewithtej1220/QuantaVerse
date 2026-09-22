import type { Metadata } from "next";

import { OwnLabPage } from "@/components/sandbox/own-lab-page";

/** The graded lab of a professor's own module. */

export const metadata: Metadata = {
  title: "Circuit lab from your professor",
};

export default async function OwnLabRoute({
  params,
}: PageProps<"/sandbox/own/[slug]">) {
  const { slug } = await params;
  return <OwnLabPage slug={slug} />;
}
