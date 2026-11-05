import { z } from "zod";

export const createReportSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Report title is required.")
    .max(100, "Report title must not exceed 100 characters."),

  description: z
    .string()
    .trim()
    .min(1, "Description is required.")
    .max(1000, "Description must not exceed 1000 characters."),

  category: z.string().min(1, "Please select a waste category."),

  address: z.string().trim().min(1, "Address is required."),

  latitude: z
    .string()
    .min(1, "Please select a location on the map.")
    .transform(Number)
    .pipe(
      z
        .number()
        .finite("Invalid latitude.")
        .min(-90, "Latitude must be at least -90.")
        .max(90, "Latitude must not exceed 90."),
    ),

  longitude: z
    .string()
    .min(1, "Please select a location on the map.")
    .transform(Number)
    .pipe(
      z
        .number()
        .finite("Invalid longitude.")
        .min(-180, "Longitude must be at least -180.")
        .max(180, "Longitude must not exceed 180."),
    ),

  image: z
    .instanceof(File, { message: "Please upload a photo." })
    .refine((file) => file.size > 0, {
      message: "Please upload a photo.",
    })
    .refine((file) => file.type.startsWith("image/"), {
      message: "Only image files are allowed.",
    })
    .refine((file) => file.size <= 4 * 1024 * 1024, {
      message: "Image size must not exceed 4 MB.",
    })
    .refine(
      (file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type),
      {
        message: "Only JPEG, PNG, and WebP images are allowed.",
      },
    ),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
