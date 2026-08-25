import type { Metadata } from "next";

import { AuthPanel } from "@/components/auth/auth-panel";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Start a QuantaVerse student record that tracks lessons, scores and badges.",
};

export default function RegisterPage() {
  return <AuthPanel mode="register" />;
}
