import type { Metadata } from "next";

import { ProfessorView } from "@/components/professor/professor-view";

export const metadata: Metadata = {
  title: "Teaching",
  description:
    "Your classes on QuantaVerse: students asking to join, the top students on each module you teach, and your notes.",
};

export default function ProfessorPage() {
  return <ProfessorView />;
}
