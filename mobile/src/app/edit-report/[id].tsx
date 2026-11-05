import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { authenticatedFetch } from "@/services/api";
import { File } from "expo-file-system";

import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";

import { API_URL, MAX_IMAGE_SIZE } from "@/constants/config";

// ==========================================
// TYPES
// ==========================================

type ReportStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "REJECTED";

type Category = {
  id: string;
  name: string;
  description: string | null;
};

type SelectedImage = {
  uri: string;
  fileName: string;
  mimeType: string;
  fileSize?: number;
};

type WastePrediction = {
  prediction: string;
  confidence: number;
  top_predictions: {
    class: string;
    confidence: number;
  }[];
};

type Report = {
  id: string;
  title: string;
  description: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  status: ReportStatus;
  confirmedCategoryId?: string | null;
  confirmedCategory: {
    id?: string;
    name: string;
  } | null;
  images: {
    id: string;
    imageUrl: string;
  }[];
};

type ApiResponse = {
  success: boolean;
  data: Report[];
  message?: string;
};

// ==========================================
// SCREEN
// ==========================================

export default function EditReportScreen() {
  const router = useRouter();

  const { id } = useLocalSearchParams<{ id: string }>();

  const reportId = Array.isArray(id) ? id[0] : id;

  // ==========================================
  // STATES
  // ==========================================

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");

  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null,
  );

  const [showCategoryModal, setShowCategoryModal] = useState(false);

  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);

  const [removeExistingImage, setRemoveExistingImage] = useState(false);

  const [image, setImage] = useState<SelectedImage | null>(null);

  const [prediction, setPrediction] = useState<WastePrediction | null>(null);
  const [predicting, setPredicting] = useState(false);

  const [loadingLocation, setLoadingLocation] = useState(false);

  // ==========================================
  // FETCH REPORT
  // ==========================================

  const fetchReport = useCallback(async () => {
    if (!reportId) {
      Alert.alert("Error", "Invalid report ID.");
      router.back();
      return;
    }

    try {
      setLoading(true);

      const response = await authenticatedFetch("/api/get-report-data", {
        method: "GET",
      });

      const result: ApiResponse = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to retrieve report data.");
      }

      if (!Array.isArray(result.data)) {
        throw new Error("Invalid report data received from server.");
      }

      const report = result.data.find((item) => item.id === reportId);

      if (!report) {
        throw new Error(
          "Report not found or you do not have permission to edit it.",
        );
      }

      // Populate form
      setTitle(report.title ?? "");
      setDescription(report.description ?? "");
      setAddress(report.address ?? "");

      setLatitude(typeof report.latitude === "number" ? report.latitude : null);

      setLongitude(
        typeof report.longitude === "number" ? report.longitude : null,
      );

      // Populate category
      const categoryId =
        report.confirmedCategoryId ?? report.confirmedCategory?.id;

      if (categoryId) {
        const matchedCategory = categories.find(
          (category) => category.id === categoryId,
        );

        if (matchedCategory) {
          setSelectedCategory(matchedCategory);
        }
      }

      // Populate existing image
      const imageUrl = report.images?.[0]?.imageUrl ?? null;

      setExistingImageUrl(imageUrl);
      setRemoveExistingImage(false);
      setImage(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong.";

      if (message.toLowerCase().includes("session expired")) {
        router.replace("/login");
        return;
      }

      Alert.alert("Failed to Load Report", message, [
        {
          text: "Back",
          onPress: () => router.back(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [reportId, router, categories]);

  // ==========================================
  // FETCH CATEGORIES
  // ==========================================

  const fetchCategories = useCallback(async () => {
    try {
      if (!API_URL) {
        throw new Error("EXPO_PUBLIC_API_URL belum dikonfigurasi.");
      }

      const baseUrl = API_URL.replace(/\/+$/, "");

      const response = await fetch(`${baseUrl}/api/get-categories`);

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to retrieve categories.");
      }

      setCategories(result.data ?? []);
    } catch (error) {
      Alert.alert(
        "Failed to Load Categories",
        error instanceof Error ? error.message : "Something went wrong.",
      );
    }
  }, []);

  useEffect(() => {
    void fetchCategories();
  }, [fetchCategories]);

  // Load report after categories are available
  useEffect(() => {
    if (categories.length > 0 && reportId) {
      void fetchReport();
    }
  }, [categories, reportId, fetchReport]);

  // ==========================================
  // AI PREDICTION
  // ==========================================

  const predictWaste = async (
    selectedImage: SelectedImage,
  ): Promise<WastePrediction> => {
    const imageFile = new File(selectedImage.uri);

    if (imageFile.size > MAX_IMAGE_SIZE) {
      throw new Error("Image size exceeds the 4 MB limit.");
    }

    const formData = new FormData();

    formData.append("image", imageFile, selectedImage.fileName);

    const response = await authenticatedFetch("/api/predict-waste", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Failed to predict waste category.");
    }

    return result.data as WastePrediction;
  };

  const matchPredictedCategory = (predictedClass: string): Category | null => {
    const normalize = (value: string) =>
      value
        .toLowerCase()
        .trim()
        .replace(/[\s_-]+/g, "")
        .replace(/waste/g, "");

    return (
      categories.find(
        (category) => normalize(category.name) === normalize(predictedClass),
      ) ?? null
    );
  };

  // ==========================================
  // SELECT NEW IMAGE
  // ==========================================

  const pickImage = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission Required",
          "Please allow access to your photo gallery.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: false,
        quality: 0.8,
      });

      if (result.canceled || !result.assets.length) {
        return;
      }

      const asset = result.assets[0];

      const mimeType = asset.mimeType?.toLowerCase();

      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

      if (!mimeType || !allowedTypes.includes(mimeType)) {
        Alert.alert(
          "Invalid Image",
          "Only JPEG, PNG, and WebP images are allowed.",
        );
        return;
      }

      if (asset.fileSize !== undefined && asset.fileSize > MAX_IMAGE_SIZE) {
        Alert.alert("Image Too Large", "Maximum image size is 4 MB.");
        return;
      }

      const extension =
        mimeType === "image/png"
          ? ".png"
          : mimeType === "image/webp"
            ? ".webp"
            : ".jpg";

      const selectedImage: SelectedImage = {
        uri: asset.uri,
        fileName: asset.fileName || `report-${Date.now()}${extension}`,
        mimeType,
        fileSize: asset.fileSize,
      };

      setImage(selectedImage);
      setPrediction(null);

      setPredicting(true);

      try {
        const predictionResult = await predictWaste(selectedImage);

        setPrediction(predictionResult);

        const matchedCategory = matchPredictedCategory(
          predictionResult.prediction,
        );

        if (matchedCategory) {
          setSelectedCategory(matchedCategory);
        } else {
          Alert.alert(
            "Prediction Completed",
            `AI detected ${predictionResult.prediction}, but the category could not be matched with the database. Please select the category manually.`,
          );
        }
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "Session expired. Please login again."
        ) {
          router.replace("/login");
          return;
        }

        Alert.alert(
          "AI Prediction Failed",
          error instanceof Error
            ? error.message
            : "Unable to classify this image. You can still select the category manually.",
        );
      } finally {
        setPredicting(false);
      }
    } catch (error) {
      Alert.alert(
        "Image Selection Failed",
        error instanceof Error ? error.message : "Something went wrong.",
      );
    }
  };

  // ==========================================
  // REMOVE IMAGE
  // ==========================================

  const handleRemoveImage = () => {
    if (image) {
      setImage(null);
      setPrediction(null);
      return;
    }

    if (existingImageUrl && !removeExistingImage) {
      Alert.alert(
        "Remove Existing Photo",
        "Are you sure you want to remove the current report photo?",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Remove",
            style: "destructive",
            onPress: () => setRemoveExistingImage(true),
          },
        ],
      );
    }
  };

  // ==========================================
  // GET CURRENT GPS LOCATION
  // ==========================================

  const getCurrentLocation = async () => {
    try {
      setLoadingLocation(true);

      const permission = await Location.requestForegroundPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Izin Lokasi Dibutuhkan",
          "Izinkan WasteFlow mengakses lokasi untuk mengambil koordinat laporan.",
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const lat = location.coords.latitude;
      const lng = location.coords.longitude;

      setLatitude(lat);
      setLongitude(lng);

      const addresses = await Location.reverseGeocodeAsync({
        latitude: lat,
        longitude: lng,
      });

      if (addresses.length > 0) {
        const item = addresses[0];

        const generatedAddress = [
          item.street,
          item.district,
          item.subregion,
          item.city,
          item.region,
        ]
          .filter(Boolean)
          .join(", ");

        if (generatedAddress) {
          setAddress(generatedAddress);
        }
      }

      Alert.alert(
        "Lokasi Berhasil Diambil",
        "Koordinat GPS berhasil diperbarui.",
      );
    } catch (error) {
      Alert.alert(
        "Gagal Mengambil Lokasi",
        error instanceof Error ? error.message : "Terjadi kesalahan.",
      );
    } finally {
      setLoadingLocation(false);
    }
  };

  // ==========================================
  // UPDATE REPORT
  // ==========================================

  const handleSubmit = async () => {
    if (submitting || predicting) return;

    if (!title.trim()) {
      Alert.alert("Validation", "Report title is required.");
      return;
    }

    if (!description.trim()) {
      Alert.alert("Validation", "Report description is required.");
      return;
    }

    if (!selectedCategory) {
      Alert.alert("Validation", "Please select a waste category.");
      return;
    }

    if (!address.trim()) {
      Alert.alert("Validation", "Location address is required.");
      return;
    }

    if (latitude === null || longitude === null) {
      Alert.alert(
        "Validation",
        "GPS coordinates are unavailable. Please get your GPS location first.",
      );
      return;
    }

    if (!image && !existingImageUrl && !removeExistingImage) {
      Alert.alert("Validation", "Please select a report photo.");
      return;
    }

    try {
      setSubmitting(true);

      const formData = new FormData();

      formData.append("title", title.trim());
      formData.append("description", description.trim());
      formData.append("category", selectedCategory.id);
      formData.append("address", address.trim());
      formData.append("latitude", String(latitude));
      formData.append("longitude", String(longitude));

      formData.append("removeExistingImage", String(removeExistingImage));

      // Only upload when the user selects a new image.
      // If no new image is selected, the old image remains unchanged.
      if (image) {
        const imageFile = new File(image.uri);

        if (imageFile.size > MAX_IMAGE_SIZE) {
          throw new Error("Image size exceeds the 4 MB limit.");
        }

        formData.append("image", imageFile, image.fileName);
      }

      const response = await authenticatedFetch(
        `/api/update-report/${reportId}`,
        {
          method: "PATCH",
          body: formData,
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        const validationErrors = result.errors
          ? Object.entries(result.errors)
              .filter(([, message]) => Boolean(message))
              .map(([field, message]) => `${field}: ${message}`)
              .join("\n")
          : "";

        throw new Error(
          [result.message || "Failed to update report.", validationErrors]
            .filter(Boolean)
            .join("\n\n"),
        );
      }

      Alert.alert(
        "Success",
        "Your waste report has been updated successfully.",
        [
          {
            text: "OK",
            onPress: () => router.replace("/(tabs)/my-reports"),
          },
        ],
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Session expired. Please login again."
      ) {
        router.replace("/login");
        return;
      }

      Alert.alert(
        "Update Failed",
        error instanceof Error ? error.message : "Something went wrong.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ==========================================
  // LOADING SCREEN
  // ==========================================

  if (loading || categories.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#16A34A" />

        <Text style={styles.loadingText}>
          {loading ? "Loading report..." : "Loading categories..."}
        </Text>
      </View>
    );
  }

  // ==========================================
  // UI
  // ==========================================

  const displayedImage = image?.uri
    ? image.uri
    : !removeExistingImage
      ? existingImageUrl
      : null;

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={21} color="#334155" />
          </Pressable>

          <Text style={styles.title}>Edit Report</Text>

          <Text style={styles.subtitle}>
            Update your waste report information and location.
          </Text>
        </View>

        {/* Report Title */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Report Title *</Text>

          <TextInput
            style={styles.input}
            placeholder="Enter report title..."
            placeholderTextColor="#94A3B8"
            value={title}
            onChangeText={setTitle}
            editable={!submitting}
          />
        </View>

        {/* Description */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Description *</Text>

          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe the waste condition..."
            placeholderTextColor="#94A3B8"
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
            editable={!submitting}
          />
        </View>

        {/* Category */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Waste Category *</Text>

          <Pressable
            style={styles.selectInput}
            onPress={() => setShowCategoryModal(true)}
            disabled={submitting || predicting}
          >
            <Text
              style={[
                styles.selectText,
                !selectedCategory && styles.placeholder,
              ]}
            >
              {selectedCategory?.name || "Select waste category"}
            </Text>

            <Ionicons name="chevron-down" size={20} color="#64748B" />
          </Pressable>
        </View>

        {/* Address */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Location Address *</Text>

          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Enter location address..."
            placeholderTextColor="#94A3B8"
            value={address}
            onChangeText={setAddress}
            multiline
            textAlignVertical="top"
            editable={!submitting}
          />

          <Pressable
            style={styles.locationButton}
            onPress={getCurrentLocation}
            disabled={loadingLocation || submitting}
          >
            {loadingLocation ? (
              <ActivityIndicator color="#16A34A" />
            ) : (
              <Ionicons name="location-outline" size={20} color="#16A34A" />
            )}

            <Text style={styles.locationButtonText}>
              {loadingLocation ? "Getting location..." : "Update GPS Location"}
            </Text>
          </Pressable>

          {latitude !== null && longitude !== null && (
            <View style={styles.coordinates}>
              <Ionicons name="checkmark-circle" size={17} color="#16A34A" />

              <Text style={styles.coordinateText}>
                {latitude.toFixed(6)}, {longitude.toFixed(6)}
              </Text>
            </View>
          )}
        </View>

        {/* Image */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Report Photo</Text>

          <Pressable
            style={styles.uploadBox}
            onPress={pickImage}
            disabled={submitting || predicting}
          >
            <Ionicons name="images-outline" size={30} color="#16A34A" />

            <Text style={styles.uploadTitle}>
              {displayedImage ? "Change Photo" : "Select Photo from Gallery"}
            </Text>

            <Text style={styles.uploadDescription}>
              Select one photo. Maximum size: 4 MB.
            </Text>
          </Pressable>

          {displayedImage && (
            <View style={styles.imageWrapper}>
              <Image
                source={{ uri: displayedImage }}
                style={styles.previewImage}
              />

              <Pressable
                style={styles.removeImageButton}
                onPress={handleRemoveImage}
                disabled={submitting}
              >
                <Ionicons name="close" size={16} color="#FFFFFF" />
              </Pressable>

              <View style={styles.imageStatus}>
                <Text style={styles.imageStatusText}>
                  {image ? "New Photo" : "Current Photo"}
                </Text>
              </View>
            </View>
          )}

          {removeExistingImage && !image && (
            <View style={styles.removedImageNotice}>
              <Ionicons
                name="information-circle-outline"
                size={17}
                color="#B45309"
              />

              <Text style={styles.removedImageText}>
                Current photo will be removed when you save.
              </Text>

              <Pressable
                onPress={() => setRemoveExistingImage(false)}
                disabled={submitting}
              >
                <Text style={styles.undoText}>Undo</Text>
              </Pressable>
            </View>
          )}

          {/* AI Prediction Loading */}
          {predicting && (
            <View style={styles.predictionLoading}>
              <ActivityIndicator size="small" color="#16A34A" />

              <View style={{ flex: 1 }}>
                <Text style={styles.predictionLoadingTitle}>
                  Analyzing Waste Image...
                </Text>

                <Text style={styles.predictionLoadingDescription}>
                  AI is identifying the waste category. Please wait.
                </Text>
              </View>
            </View>
          )}

          {/* AI Prediction Result */}
          {prediction && !predicting && (
            <View style={styles.predictionCard}>
              <View style={styles.predictionHeader}>
                <View style={styles.predictionIcon}>
                  <Ionicons name="sparkles" size={20} color="#16A34A" />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.predictionTitle}>
                    AI Classification Result
                  </Text>

                  <Text style={styles.predictionSubtitle}>
                    Waste category detected by AI
                  </Text>
                </View>

                <View style={styles.aiBadge}>
                  <Text style={styles.aiBadgeText}>AI</Text>
                </View>
              </View>

              <View style={styles.predictionMain}>
                <Text style={styles.predictionCategory}>
                  {prediction.prediction.toUpperCase()}
                </Text>

                <Text style={styles.predictionConfidence}>
                  {(prediction.confidence * 100).toFixed(2)}% confidence
                </Text>
              </View>

              <View style={styles.predictionDivider} />

              <Text style={styles.topPredictionTitle}>Other Predictions</Text>

              {prediction.top_predictions.map((item, index) => (
                <View
                  key={`${item.class}-${index}`}
                  style={styles.topPredictionItem}
                >
                  <View style={styles.topPredictionInfo}>
                    <Text style={styles.topPredictionName}>
                      {item.class.charAt(0).toUpperCase() + item.class.slice(1)}
                    </Text>

                    <Text style={styles.topPredictionPercentage}>
                      {(item.confidence * 100).toFixed(2)}%
                    </Text>
                  </View>

                  <View style={styles.progressBackground}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.min(
                            100,
                            Math.max(0, item.confidence * 100),
                          )}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}

              <View style={styles.predictionNote}>
                <Ionicons
                  name="information-circle-outline"
                  size={17}
                  color="#64748B"
                />

                <Text style={styles.predictionNoteText}>
                  AI prediction is a recommendation. You can change the category
                  manually above.
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Update Button */}
        <Pressable
          style={[
            styles.submitButton,
            (submitting || predicting) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={submitting || predicting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Ionicons name="save-outline" size={19} color="#FFFFFF" />
          )}

          <Text style={styles.submitButtonText}>
            {submitting ? "Updating Report..." : "Save Changes"}
          </Text>
        </Pressable>

        <Pressable
          style={styles.cancelButton}
          onPress={() => router.back()}
          disabled={submitting}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>

        <Text style={styles.requiredNote}>* Required fields</Text>
      </ScrollView>

      {/* Category Selection Modal */}
      <Modal
        visible={showCategoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowCategoryModal(false)}
        >
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>

              <Pressable onPress={() => setShowCategoryModal(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </Pressable>
            </View>

            <ScrollView>
              {categories.map((category) => (
                <Pressable
                  key={category.id}
                  style={styles.categoryItem}
                  onPress={() => {
                    setSelectedCategory(category);
                    setShowCategoryModal(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.categoryName}>{category.name}</Text>

                    {category.description ? (
                      <Text style={styles.categoryDescription}>
                        {category.description}
                      </Text>
                    ) : null}
                  </View>

                  {selectedCategory?.id === category.id && (
                    <Ionicons
                      name="checkmark-circle"
                      size={21}
                      color="#16A34A"
                    />
                  )}
                </Pressable>
              ))}

              {categories.length === 0 && (
                <Text style={styles.emptyCategory}>
                  No categories available.
                </Text>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ==========================================
// STYLES
// ==========================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 12,
  },

  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },

  header: {
    marginTop: 45,
    marginBottom: 28,
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 17,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  title: {
    fontSize: 25,
    fontWeight: "bold",
    color: "#1E293B",
  },

  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: "#64748B",
    marginTop: 7,
  },

  fieldContainer: {
    marginBottom: 23,
  },

  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 9,
  },

  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    color: "#1E293B",
  },

  textArea: {
    minHeight: 105,
    textAlignVertical: "top",
  },

  selectInput: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 14,
  },

  selectText: {
    fontSize: 14,
    color: "#1E293B",
  },

  placeholder: {
    color: "#94A3B8",
  },

  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: "#DCFCE7",
    borderRadius: 10,
    padding: 13,
    marginTop: 10,
  },

  locationButtonText: {
    color: "#15803D",
    fontSize: 13,
    fontWeight: "600",
  },

  coordinates: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 10,
  },

  coordinateText: {
    color: "#15803D",
    fontSize: 12,
  },

  uploadBox: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#86EFAC",
    borderStyle: "dashed",
    borderRadius: 14,
    padding: 22,
    alignItems: "center",
  },

  uploadTitle: {
    color: "#15803D",
    fontWeight: "600",
    fontSize: 14,
    marginTop: 10,
  },

  uploadDescription: {
    color: "#94A3B8",
    fontSize: 11,
    marginTop: 6,
    textAlign: "center",
  },

  imageWrapper: {
    width: 150,
    height: 150,
    position: "relative",
    marginTop: 14,
  },

  previewImage: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
    backgroundColor: "#E2E8F0",
  },

  removeImageButton: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },

  imageStatus: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },

  imageStatusText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "600",
  },

  removedImageNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#FEF3C7",
    padding: 11,
    borderRadius: 9,
    marginTop: 12,
  },

  removedImageText: {
    flex: 1,
    fontSize: 11,
    color: "#92400E",
  },

  undoText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#B45309",
  },

  predictionLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 12,
    padding: 15,
    marginTop: 14,
  },

  predictionLoadingTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#15803D",
  },

  predictionLoadingDescription: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 4,
  },

  predictionCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 14,
    padding: 15,
    marginTop: 14,
  },

  predictionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  predictionIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },

  predictionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
  },

  predictionSubtitle: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 3,
  },

  aiBadge: {
    backgroundColor: "#DCFCE7",
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },

  aiBadgeText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#15803D",
  },

  predictionMain: {
    backgroundColor: "#F0FDF4",
    borderRadius: 10,
    padding: 14,
    marginTop: 15,
    alignItems: "center",
  },

  predictionCategory: {
    fontSize: 23,
    fontWeight: "bold",
    color: "#15803D",
  },

  predictionConfidence: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 5,
  },

  predictionDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 15,
  },

  topPredictionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 12,
  },

  topPredictionItem: {
    marginBottom: 12,
  },

  topPredictionInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  topPredictionName: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "500",
  },

  topPredictionPercentage: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "600",
  },

  progressBackground: {
    height: 7,
    backgroundColor: "#E2E8F0",
    borderRadius: 10,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    backgroundColor: "#16A34A",
    borderRadius: 10,
  },

  predictionNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    marginTop: 5,
  },

  predictionNoteText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 17,
    color: "#64748B",
  },

  submitButton: {
    backgroundColor: "#16A34A",
    borderRadius: 12,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 5,
  },

  submitButtonDisabled: {
    opacity: 0.7,
  },

  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "bold",
  },

  cancelButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },

  cancelButtonText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "600",
  },

  requiredNote: {
    color: "#94A3B8",
    fontSize: 11,
    textAlign: "center",
    marginTop: 12,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
  },

  modalContent: {
    maxHeight: "70%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    paddingBottom: 35,
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1E293B",
  },

  categoryItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },

  categoryName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
  },

  categoryDescription: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 4,
  },

  emptyCategory: {
    textAlign: "center",
    color: "#64748B",
    padding: 20,
  },
});
