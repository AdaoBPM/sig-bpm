import { ProtectedLayout } from "@/components/layout/ProtectedLayout";

import { DashboardView } from "./DashboardView";

export default function DashboardPage() {
  return (
    <ProtectedLayout>
      <DashboardView />
    </ProtectedLayout>
  );
}
