import { ProtectedLayout } from "@/components/layout/ProtectedLayout";

import { CenariosAnaliticosContent } from "./CenariosAnaliticosContent";

export default function CenariosAnaliticosPage() {
  return (
    <ProtectedLayout>
      <CenariosAnaliticosContent />
    </ProtectedLayout>
  );
}
