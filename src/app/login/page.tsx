import type { Metadata } from "next";

import { AuthPanel } from "@/components/auth/auth-panel";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to QuantaVerse to keep your lessons, badges and graded circuits.",
};

export default function LoginPage() {
  return <AuthPanel mode="login" />;
}
