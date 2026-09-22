import type { Metadata } from "next";

import { OwnModulePage } from "@/components/curriculum/own-module-page";

/**
 * A module a professor wrote, for the students in their class.
 *
 * Nothing about it can be rendered ahead of time: who may read it is decided
 * per account, so the page is a shell and the module arrives once the
 * student's session does.
 */

export const metadata: Metadata = {
  title: "A module from your professor",
};

export default async function OwnModuleRoute({
  params,
}: PageProps<"/curriculum/own/[slug]">) {
  const { slug } = await params;
  return <OwnModulePage slug={slug} />;
}
