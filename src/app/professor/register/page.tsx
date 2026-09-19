import type { Metadata } from "next";

import { AuthPanel } from "@/components/auth/auth-panel";

export const metadata: Metadata = {
  title: "Professor registration",
  description:
    "Create a QuantaVerse teaching account, then choose the modules you teach from your dashboard.",
};

export default function ProfessorRegisterPage() {
  return <AuthPanel mode="register" audience="professor" />;
}
