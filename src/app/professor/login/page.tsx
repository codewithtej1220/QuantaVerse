import type { Metadata } from "next";

import { AuthPanel } from "@/components/auth/auth-panel";

export const metadata: Metadata = {
  title: "Professor sign in",
  description:
    "Sign in to your QuantaVerse teaching account: answer class requests, see your top students on each module, and upload notes.",
};

export default function ProfessorLoginPage() {
  return <AuthPanel mode="login" audience="professor" />;
}
