export type CreateReportState = {
  success: boolean;
  message: string;
  errors?: {
    title?: string;
    description?: string;
    category?: string;
    address?: string;
    latitude?: string;
    longitude?: string;
    image?: string;
  };
};
