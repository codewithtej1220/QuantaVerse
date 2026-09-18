import type { Metadata } from "next";

import { AuthPanel } from "@/components/auth/auth-panel";

export const metadata: Metadata = {
  title: "Professor registration",
  description:
    "Set up a QuantaVerse teaching account with your site's invite code and choose the modules you teach.",
};

export default function ProfessorRegisterPage() {
  return <AuthPanel mode="register" audience="professor" />;
}
