import type { Metadata } from "next";

import { StartingPoint } from "@/components/auth/starting-point";

export const metadata: Metadata = {
  title: "Where to start",
  description:
    "Two questions about your background, asked once, so the track opens at the right place instead of at lesson one.",
};

export default function WelcomePage() {
  return (
    <div className="min-h-screen overflow-x-clip pt-32 pb-24">
      <div className="mx-auto max-w-[1440px] px-5 lg:px-10">
        <StartingPoint />
      </div>
    </div>
  );
}
