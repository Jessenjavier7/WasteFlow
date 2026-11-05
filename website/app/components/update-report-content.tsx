"use client";

import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { WasteCategory } from "@/app/type/wasteCategory";
import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { getCategoryIcon } from "@/app/utils/getCategoryIcon";
import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  ImagePlus,
  MapPin,
  Trash2,
  Upload,
  X,
  FileText,
  Leaf,
  Recycle,
} from "lucide-react";

import Swal from "sweetalert2";

import { updateReportAction } from "@/app/actions/update-report";

const LocationPicker = dynamic(
  () => import("@/app/components/location-picker"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[350px] items-center justify-center rounded-2xl bg-gray-50 text-sm text-gray-400">
        Loading map...
      </div>
    ),
  },
);

const initialState = {
  success: false,
  message: "",
  errors: {},
};

export default function CreateReportPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const router = useRouter();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, formAction, isPending] = useActionState(
    updateReportAction,
    initialState,
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categories, setCategories] = useState<WasteCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [categoryError, setCategoryError] = useState("");

  const [category, setCategory] = useState("");
  const [address, setAddress] = useState("");

  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState("");

  const [removeExistingImage, setRemoveExistingImage] = useState(false);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const response = await fetch(`/api/get-report-data-by-id/${id}`);

        const result = await response.json();

        console.log("FETCH REPORT RESULT:", result);

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Failed to fetch report.");
        }

        const report = result.data;

        setTitle(report.title);
        setDescription(report.description ?? "");
        setCategory(report.confirmedCategoryId ?? "");
        setAddress(report.address ?? "");

        setLatitude(report.latitude ?? null);
        setLongitude(report.longitude ?? null);

        // Display existing image
        if (report.reportImage?.[0]?.imageUrl) {
          setPreview(report.reportImage[0].imageUrl);
        }
      } catch (error) {
        console.error("FETCH REPORT ERROR:", error);

        Swal.fire({
          icon: "error",
          title: "Failed to Load Report",
          text:
            error instanceof Error ? error.message : "Something went wrong.",
        }).then(() => {
          router.push("/dashboard");
        });
      }
    };

    if (id) {
      fetchReport();
    }
  }, [id, router]);

  const handleImageChange = (file: File | undefined) => {
    if (!file) return;

    setImageError("");

    if (!file.type.startsWith("image/")) {
      setImageError("Only image files are allowed.");
      fileInputRef.current!.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setImageError("Image size must not exceed 5 MB.");
      fileInputRef.current!.value = "";
      return;
    }

    if (preview?.startsWith("blob:")) {
      URL.revokeObjectURL(preview);
    }

    setPreview(URL.createObjectURL(file));
    setRemoveExistingImage(false);
  };

  const handleLocationChange = (lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
  };

  const handleAddressChange = useCallback((address: string) => {
    setAddress(address);
  }, []);

  const removeImage = () => {
    if (preview?.startsWith("blob:")) {
      URL.revokeObjectURL(preview);
    }

    setPreview(null);
    setRemoveExistingImage(true);
    setImageError("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setIsLoadingCategories(true);
        const response = await fetch("/api/get-categories");

        if (!response.ok) {
          throw new Error("Failed to Fetch Categories");
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.message || "Failed to Fetch Categories");
        }

        setCategories(result.data);
      } catch (error) {
        console.error("FETCH CATEGORIES ERROR:", error);

        setCategoryError(
          error instanceof Error ? error.message : "Something went wrong.",
        );
      } finally {
        setIsLoadingCategories(false);
      }
    };

    fetchCategories();
  }, []);

  useEffect(() => {
    if (!state.success) return;

    Swal.fire({
      icon: "success",
      title: "Report Updated!",
      text: state.message,
      confirmButtonText: "OK",
      confirmButtonColor: "#16a34a",
      timer: 2000,
      timerProgressBar: true,
      allowOutsideClick: false,
      allowEscapeKey: false,
    }).then(() => {
      router.push("/dashboard");
    });
  }, [state.success, state.message, router]);

  return (
    <main className="min-h-screen bg-[#f5f8f4] p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-gray-500 transition hover:text-emerald-600"
          >
            <ArrowLeft size={17} />
            Back to Dashboard
          </Link>

          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-950 md:text-3xl">
              Update Waste Report
            </h1>

            <p className="mt-2 text-sm text-gray-500 md:text-base">
              Update your waste report information, location, category, or
              evidence photo.
            </p>
          </div>
        </div>

        <form action={formAction} className="space-y-6">
          {/* Basic Information */}
          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <FileText size={20} />
              </div>

              <div>
                <h2 className="font-bold text-gray-900">Report Information</h2>

                <p className="text-xs text-gray-400">
                  Provide details about the waste problem.
                </p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Title */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Report Title <span className="text-red-500">*</span>
                </label>

                <input
                  type="text"
                  name="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Example: Garbage pile near the main road"
                  maxLength={120}
                  required
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />

                {state.errors?.title && (
                  <p className="mt-1 text-xs text-red-500">
                    {state.errors.title}
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Description <span className="text-red-500">*</span>
                </label>

                <textarea
                  name="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the waste condition, approximate amount, and any other relevant information..."
                  rows={5}
                  maxLength={2000}
                  required
                  className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />

                <p className="mt-1 text-right text-xs text-gray-400">
                  {description.length}/2000 characters
                </p>

                {state.errors?.description && (
                  <p className="mt-1 text-xs text-red-500">
                    {state.errors.description}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Category */}
          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-8">
            <div className="mb-6">
              <h2 className="font-bold text-gray-900">Waste Category</h2>

              <p className="mt-1 text-xs text-gray-400">
                Select the category that best describes the waste.
              </p>
            </div>

            <input type="hidden" name="category" value={category} />

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((item) => {
                const Icon = getCategoryIcon(item.name);
                const selected = category === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCategory(item.id)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      selected
                        ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100"
                        : "border-gray-100 hover:border-emerald-200 hover:bg-gray-50"
                    }`}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                          selected
                            ? "bg-emerald-500 text-white"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        <Icon size={20} />
                      </div>

                      <div
                        className={`h-4 w-4 rounded-full border-2 ${
                          selected
                            ? "border-emerald-500 bg-emerald-500"
                            : "border-gray-300"
                        }`}
                      />
                    </div>

                    <p className="text-sm font-bold text-gray-900">
                      {item.name}
                    </p>

                    <p className="mt-1 text-xs leading-relaxed text-gray-400">
                      {item.description}
                    </p>
                  </button>
                );
              })}
            </div>

            {state.errors?.category && (
              <p className="mt-3 text-xs text-red-500">
                {state.errors.category}
              </p>
            )}
          </section>

          {/* Address */}
          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <MapPin size={20} />
              </div>

              <div>
                <h2 className="font-bold text-gray-900">Waste Address</h2>

                <p className="text-xs text-gray-400">
                  Where did you find the waste?
                </p>
              </div>
            </div>

            <label className="mb-2 block text-sm font-semibold text-gray-700">
              Location Address <span className="text-red-500">*</span>
            </label>

            <input
              type="text"
              name="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Example: Jl. Dipati Ukur No. 35, Bandung"
              required
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />

            {state.errors?.address && (
              <p className="mt-1 text-xs text-red-500">
                {state.errors.address}
              </p>
            )}

            <p className="mt-2 text-xs text-gray-400">
              Please provide a detailed address so the waste collection team can
              locate it.
            </p>

            {/* Future map integration */}
            {/* Interactive Location Picker */}
            <div className="mt-5">
              <LocationPicker
                latitude={latitude}
                longitude={longitude}
                onLocationChange={handleLocationChange}
                onAddressChange={handleAddressChange}
              />
            </div>

            {/* Hidden coordinates submitted to Server Action */}
            <input type="hidden" name="latitude" value={latitude ?? ""} />

            <input type="hidden" name="longitude" value={longitude ?? ""} />
          </section>

          {/* Image Upload */}
          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Camera size={20} />
              </div>

              <div>
                <h2 className="font-bold text-gray-900">Upload Photo</h2>

                <p className="text-xs text-gray-400">
                  Upload one photo as evidence of the waste condition.
                </p>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              name="image"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(e) => handleImageChange(e.target.files?.[0])}
            />

            {preview ? (
              <div className="relative max-w-sm overflow-hidden rounded-2xl border border-gray-200">
                <img
                  src={preview}
                  alt="Waste evidence preview"
                  className="h-64 w-full object-cover"
                />

                <button
                  type="button"
                  onClick={removeImage}
                  aria-label="Remove image"
                  className="absolute right-3 top-3 rounded-full bg-black/70 p-2 text-white transition hover:bg-red-500"
                >
                  <X size={17} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 px-5 py-10 transition hover:border-emerald-400 hover:bg-emerald-50/50"
              >
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white text-emerald-600 shadow-sm">
                  <Upload size={21} />
                </div>

                <p className="text-sm font-bold text-gray-700">
                  Click to upload photo
                </p>

                <p className="mt-1 text-xs text-gray-400">
                  PNG, JPG or JPEG (Maximum 5 MB)
                </p>
              </button>
            )}

            {(imageError || state.errors?.image) && (
              <p className="mt-2 text-sm text-red-500">
                {imageError || state.errors?.image}
              </p>
            )}
          </section>

          {/* Server Action Feedback */}
          {state.message && (
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                state.success
                  ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                  : "border-red-100 bg-red-50 text-red-600"
              }`}
            >
              {state.message}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
            <Link
              href="/user/dashboard"
              className="rounded-xl border border-gray-200 bg-white px-6 py-3 text-center text-sm font-bold text-gray-600 transition hover:bg-gray-50"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={isPending || !!imageError}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-7 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Upload size={17} />

              {isPending ? "Updateing..." : "Update Report"}
            </button>
          </div>

          <p className="pb-4 text-center text-xs text-gray-400">
            Your report will be reviewed by the WasteFlow administration team.
          </p>

          <input type="hidden" name="reportId" value={id ?? ""} />

          <input
            type="hidden"
            name="removeExistingImage"
            value={String(removeExistingImage)}
          />
        </form>
      </div>
    </main>
  );
}
