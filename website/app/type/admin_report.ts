import type { MyReport } from "./report";

export type AdminReport = MyReport & {
  user: {
    id: string;
    name: string | null;
    email: string;
  };

  statusHistories: {
    id: string;
    changedBy: string;
    oldStatus: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "REJECTED" | null;
    newStatus: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "REJECTED";
    note: string | null;
    createdAt: string;
    user: {
      id: string;
      name: string | null;
      email: string;
    };
  }[];
};
