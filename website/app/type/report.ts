export type ReportStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "REJECTED";

export type MyReport = {
  id: string;
  title: string;
  description: string | null;
  address: string | null;

  latitude: number | null;
  longitude: number | null;

  status: ReportStatus;
  createdAt: string;

  confirmedCategory: {
    name: string;
  } | null;

  images: {
    id: string;
    imageUrl: string;
  }[];

  statusHistories: {
    id: string;
    changedBy: string;
    oldStatus: ReportStatus | null;
    newStatus: ReportStatus;
    note: string | null;
    createdAt: string;
    user: {
      id: string;
      name: string | null;
      email: string;
    };
  }[];
};
