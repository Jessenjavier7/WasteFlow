import { Suspense } from "react";
import DashboardContent from "@/app/components/dashboard-role";

export default function DashboardPage() {
  return (
    <Suspense fallback={<p>Loading Dashboard...</p>}>
      <DashboardContent />
    </Suspense>
  );
}
