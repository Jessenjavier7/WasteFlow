import { AdminReport } from "./admin_report";

export type AdminReportsSectionProps = {
  reports: AdminReport[];
  isLoading: boolean;
  error: string;
  search: string;
};
