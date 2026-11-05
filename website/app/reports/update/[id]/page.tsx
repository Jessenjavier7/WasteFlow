import { Suspense } from "react";
import UpdateReportContent from "@/app/components/update-report-content";

export default function UpdateReportPage() {
  return (
    <Suspense fallback={<div>Loading report...</div>}>
      <UpdateReportContent />
    </Suspense>
  );
}
