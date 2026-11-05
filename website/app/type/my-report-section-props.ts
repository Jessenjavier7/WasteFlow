import type { MyReport } from "./report";

export interface MyReportsSectionProps {
  reports: MyReport[];
  isLoading: boolean;
  error: string;
  search: string;
  onDeleteSuccess: (reportId: string) => void;
}
