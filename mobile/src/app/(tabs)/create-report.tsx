import { useCallback, useEffect, useState } from "react";

import { authenticatedFetch } from "@/services/api";
import { useRouter } from "expo-router";
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

type WastePrediction = {
  prediction: string;
  confidence: number;
  top_predictions: {
    class: string;
    confidence: number;
  }[];
};

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

export default function CreateReportScreen() {
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null,
  );

  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Only one image is allowed
  const [image, setImage] = useState<SelectedImage | null>(null);

  // AI prediction states
  const [prediction, setPrediction] = useState<WastePrediction | null>(null);
  const [predicting, setPredicting] = useState(false);

  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingLocation, setLoadingLocation] = useState(false);

  const predictWaste = async (
    selectedImage: SelectedImage,
  ): Promise<WastePrediction> => {
    const formData = new FormData();

    const imageFile = new File(selectedImage.uri);

    if (imageFile.size > MAX_IMAGE_SIZE) {
      throw new Error("Image size exceeds the 4 MB limit.");
    }

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
  // FETCH CATEGORIES
  // ==========================================

  const fetchCategories = useCallback(async () => {
    try {
      if (!API_URL) {
        throw new Error("EXPO_PUBLIC_API_URL belum dikonfigurasi.");
      }

      setLoadingCategories(true);

      const baseUrl = API_URL.replace(/\/+$/, "");

      const response = await fetch(`${baseUrl}/api/get-categories`);

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal mengambil kategori.");
      }

      setCategories(result.data ?? []);
    } catch (error) {
      Alert.alert(
        "Gagal Memuat Kategori",
        error instanceof Error ? error.message : "Terjadi kesalahan.",
      );
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  useEffect(() => {
    void fetchCategories();
  }, [fetchCategories]);

  // ==========================================
  // SELECT IMAGE FROM GALLERY
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

      // Store selected image.
      setImage(selectedImage);

      // Clear previous prediction and category.
      setPrediction(null);
      setSelectedCategory(null);

      // Start AI prediction.
      setPredicting(true);

      try {
        const predictionResult = await predictWaste(selectedImage);

        setPrediction(predictionResult);

        // Automatically match AI prediction with database category.
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
        error instanceof Error
          ? error.message
          : "An unexpected error occurred.",
      );
    }
  };

  const removeImage = () => {
    setImage(null);
    setPrediction(null);
    setSelectedCategory(null);
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

      // Reverse geocoding
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
        "Koordinat GPS berhasil disimpan.",
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
  // RESET FORM
  // ==========================================

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setAddress("");
    setSelectedCategory(null);
    setImage(null);
    setPrediction(null);
    setPredicting(false);
    setLatitude(null);
    setLongitude(null);
  };

  // ==========================================
  // SUBMIT REPORT
  // ==========================================

  const handleSubmit = async () => {
    if (submitting) return;

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
      Alert.alert("Validation", "Please get your GPS location first.");
      return;
    }

    if (!image) {
      Alert.alert("Validation", "Please select one report photo.");
      return;
    }

    try {
      setSubmitting(true);

      // ==========================================
      // BUILD MULTIPART FORM DATA
      // ==========================================

      const formData = new FormData();

      formData.append("title", title.trim());
      formData.append("description", description.trim());
      formData.append("category", selectedCategory.id);
      formData.append("address", address.trim());
      formData.append("latitude", String(latitude));
      formData.append("longitude", String(longitude));

      // Convert image URI into an actual Expo File
      const imageFile = new File(image.uri);

      // Validate actual file size
      if (imageFile.size > MAX_IMAGE_SIZE) {
        throw new Error("Image size exceeds the 4 MB limit.");
      }

      // Append File instead of { uri, name, type }
      formData.append("image", imageFile, image.fileName);

      // ==========================================
      // SUBMIT REPORT
      // ==========================================

      const response = await authenticatedFetch("/api/report", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        const validationErrors = result.errors
          ? Object.entries(result.errors)
              .filter(([, message]) => Boolean(message))
              .map(([field, message]) => `${field}: ${message}`)
              .join("\n")
          : "";

        throw new Error(
          [result.message || "Failed to submit report.", validationErrors]
            .filter(Boolean)
            .join("\n\n"),
        );
      }

      Alert.alert(
        "Success",
        "Your waste report has been submitted successfully!",
        [
          {
            text: "OK",
            onPress: resetForm,
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
        "Submission Failed",
        error instanceof Error
          ? error.message
          : "An unexpected error occurred.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ==========================================
  // UI
  // ==========================================

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Create Report</Text>
          <Text style={styles.subtitle}>
            Bantu lingkungan menjadi lebih bersih dengan melaporkan masalah
            sampah.
          </Text>
        </View>

        {/* Report Title */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Report Title *</Text>

          <TextInput
            style={styles.input}
            placeholder="Contoh: Sampah menumpuk di pinggir jalan"
            placeholderTextColor="#94A3B8"
            value={title}
            onChangeText={setTitle}
          />
        </View>

        {/* Description */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Description *</Text>

          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Jelaskan kondisi sampah yang ditemukan..."
            placeholderTextColor="#94A3B8"
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* Category */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Waste Category *</Text>

          <Pressable
            style={styles.selectInput}
            onPress={() => setShowCategoryModal(true)}
            disabled={loadingCategories || submitting || predicting}
          >
            <Text
              style={[
                styles.selectText,
                !selectedCategory && styles.placeholder,
              ]}
            >
              {loadingCategories
                ? "Loading categories..."
                : selectedCategory?.name || "Select waste category"}
            </Text>

            {loadingCategories ? (
              <ActivityIndicator color="#16A34A" />
            ) : (
              <Ionicons name="chevron-down" size={20} color="#64748B" />
            )}
          </Pressable>

          {!loadingCategories && categories.length === 0 && (
            <Pressable onPress={fetchCategories}>
              <Text style={styles.retryText}>Retry loading categories</Text>
            </Pressable>
          )}
        </View>

        {/* Address */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Location Address *</Text>

          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Masukkan alamat lokasi sampah..."
            placeholderTextColor="#94A3B8"
            value={address}
            onChangeText={setAddress}
            multiline
            textAlignVertical="top"
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
              {loadingLocation
                ? "Getting location..."
                : "Get Current GPS Location"}
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

        {/* Single Image Upload */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Report Photo *</Text>

          <Pressable
            style={styles.uploadBox}
            onPress={pickImage}
            disabled={submitting}
          >
            <Ionicons name="images-outline" size={30} color="#16A34A" />

            <Text style={styles.uploadTitle}>
              {image ? "Change Photo" : "Select Photo from Gallery"}
            </Text>

            <Text style={styles.uploadDescription}>
              Upload one photo only. Maximum size: 4 MB.
            </Text>
          </Pressable>

          {image && (
            <View style={styles.imageWrapper}>
              <Image source={{ uri: image.uri }} style={styles.previewImage} />

              <Pressable
                style={styles.removeImageButton}
                onPress={removeImage}
                disabled={submitting}
              >
                <Ionicons name="close" size={16} color="#FFFFFF" />
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

        {/* Submit */}
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
            <Ionicons name="send-outline" size={18} color="#FFFFFF" />
          )}

          <Text style={styles.submitButtonText}>
            {submitting ? "Submitting Report..." : "Submit Report"}
          </Text>
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

              {!loadingCategories && categories.length === 0 && (
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
  // ==========================================
  // AI PREDICTION STYLES
  // ==========================================

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

  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginTop: 45,
    marginBottom: 28,
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
  retryText: {
    color: "#16A34A",
    fontSize: 13,
    marginTop: 8,
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
    width: 130,
    height: 130,
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
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
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
