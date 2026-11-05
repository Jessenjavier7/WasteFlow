import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  Image,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { authenticatedFetch } from "@/services/api";

type ReportStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "REJECTED";

type Report = {
  id: string;
  title: string;
  description: string;
  address: string;
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
    oldStatus: string | null;
    newStatus: string;
    note: string | null;
    createdAt: string;
    user: {
      id: string;
      name: string | null;
      email: string | null;
    } | null;
  }[];
};

type ApiResponse = {
  success: boolean;
  data: Report[];
  message?: string;
};

const STATUS_CONFIG: Record<
  ReportStatus,
  {
    label: string;
    background: string;
    color: string;
  }
> = {
  PENDING: {
    label: "Pending",
    background: "#FEF3C7",
    color: "#B45309",
  },
  IN_PROGRESS: {
    label: "In Progress",
    background: "#DBEAFE",
    color: "#1D4ED8",
  },
  COMPLETED: {
    label: "Completed",
    background: "#DCFCE7",
    color: "#15803D",
  },
  REJECTED: {
    label: "Rejected",
    background: "#FEE2E2",
    color: "#B91C1C",
  },
};

export default function MyReportsScreen() {
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Fetch reports from API
  const fetchReports = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const response = await authenticatedFetch("/api/get-report-data", {
          method: "GET",
        });

        const result: ApiResponse = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Failed to retrieve your reports.");
        }

        if (!Array.isArray(result.data)) {
          throw new Error("Invalid report data received from server.");
        }

        setReports(result.data);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Something went wrong.";

        if (message.toLowerCase().includes("session expired")) {
          router.replace("/login");
          return;
        }

        setError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router],
  );

  // Fetch data whenever My Reports tab becomes active
  useFocusEffect(
    useCallback(() => {
      fetchReports();
    }, [fetchReports]),
  );

  // Filter reports based on search query
  const filteredReports = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return reports;
    }

    return reports.filter((report) => {
      const statusLabel = STATUS_CONFIG[report.status]?.label ?? "";

      const searchableText = [
        report.title,
        report.description,
        report.address,
        report.confirmedCategory?.name,
        report.status,
        statusLabel,
      ]
        .filter((value): value is string => typeof value === "string")
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [reports, searchQuery]);

  // Format report date
  const formatDate = (date: string) => {
    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "-";
    }

    return parsedDate.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // Render individual report card
  const renderReport = ({ item }: { item: Report }) => {
    const status = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.PENDING;

    const categoryName = item.confirmedCategory?.name || "Uncategorized";

    const imageUrl = item.images?.[0]?.imageUrl;

    return (
      <View style={styles.reportCard}>
        {/* Report Image */}
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.reportImage}
            resizeMode="cover"
            onError={(event) => {
              console.log(
                "Failed to load report image:",
                imageUrl,
                event.nativeEvent.error,
              );
            }}
          />
        ) : (
          <View style={styles.noImageContainer}>
            <Ionicons name="image-outline" size={35} color="#9CA3AF" />
            <Text style={styles.noImageText}>No Image Available</Text>
          </View>
        )}

        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.documentIcon}>
            <Ionicons name="document-text-outline" size={23} color="#16A34A" />
          </View>

          <View style={styles.cardTitleContainer}>
            <Text style={styles.reportTitle} numberOfLines={2}>
              {item.title}
            </Text>

            <Text style={styles.reportDate}>{formatDate(item.createdAt)}</Text>
          </View>

          <View
            style={[styles.statusBadge, { backgroundColor: status.background }]}
          >
            <Text style={[styles.statusText, { color: status.color }]}>
              {status.label}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Category */}
        <View style={styles.infoRow}>
          <Ionicons name="pricetag-outline" size={16} color="#64748B" />
          <Text style={styles.infoText}>{categoryName}</Text>
        </View>

        {/* Address */}
        {item.address ? (
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={16} color="#64748B" />
            <Text style={styles.infoText} numberOfLines={2}>
              {item.address}
            </Text>
          </View>
        ) : null}

        {/* Description */}
        {item.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
      </View>
    );
  };

  // Render empty, loading, and error states
  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color="#16A34A" />

          <Text style={styles.stateText}>Loading your reports...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.stateContainer}>
          <Ionicons name="cloud-offline-outline" size={55} color="#9CA3AF" />

          <Text style={styles.emptyTitle}>Unable to Load Reports</Text>

          <Text style={styles.emptyDescription}>{error}</Text>

          <Pressable style={styles.retryButton} onPress={() => fetchReports()}>
            <Ionicons name="refresh" size={17} color="#FFFFFF" />

            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      );
    }

    // No search results
    if (reports.length > 0 && filteredReports.length === 0) {
      return (
        <View style={styles.stateContainer}>
          <Ionicons name="search-outline" size={60} color="#9CA3AF" />

          <Text style={styles.emptyTitle}>No Results Found</Text>

          <Text style={styles.emptyDescription}>
            We couldn't find any reports matching "{searchQuery.trim()}". Try
            using different keywords.
          </Text>

          <Pressable
            style={styles.retryButton}
            onPress={() => setSearchQuery("")}
          >
            <Ionicons name="close" size={17} color="#FFFFFF" />

            <Text style={styles.retryButtonText}>Clear Search</Text>
          </Pressable>
        </View>
      );
    }

    // No reports available
    return (
      <View style={styles.stateContainer}>
        <Ionicons name="document-text-outline" size={65} color="#9CA3AF" />

        <Text style={styles.emptyTitle}>No Reports Yet</Text>

        <Text style={styles.emptyDescription}>
          You haven't submitted any waste reports. Start by creating your first
          report.
        </Text>

        <Pressable
          style={styles.createButton}
          onPress={() => router.push("/(tabs)/create-report")}
        >
          <Ionicons name="add" size={19} color="#FFFFFF" />

          <Text style={styles.createButtonText}>Create Report</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Reports</Text>

        <Text style={styles.subtitle}>
          Manage and track your waste reports.
        </Text>

        {!loading && !error && (
          <Text style={styles.reportCount}>
            {searchQuery.trim()
              ? `${filteredReports.length} of ${reports.length} Reports`
              : `${reports.length} ${
                  reports.length === 1 ? "Report" : "Reports"
                }`}
          </Text>
        )}
      </View>

      {/* Search Bar */}
      {reports.length > 0 && !error && (
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#94A3B8" />

          <TextInput
            style={styles.searchInput}
            placeholder="Search reports..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />

          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")} hitSlop={10}>
              <Ionicons name="close-circle" size={20} color="#94A3B8" />
            </Pressable>
          )}
        </View>
      )}

      {/* Reports List */}
      <FlatList
        data={filteredReports}
        keyExtractor={(item) => item.id}
        renderItem={renderReport}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={
          filteredReports.length === 0 ? styles.emptyList : styles.listContent
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchReports(true)}
            colors={["#16A34A"]}
            tintColor="#16A34A"
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 20,
  },

  // Header
  header: {
    marginTop: 45,
    marginBottom: 20,
  },

  title: {
    fontSize: 25,
    fontWeight: "bold",
    color: "#1E293B",
  },

  subtitle: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 6,
  },

  reportCount: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 15,
    fontWeight: "600",
  },

  // Search
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 20,
    gap: 10,
  },

  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#1E293B",
    paddingVertical: 0,
  },

  // List
  listContent: {
    paddingBottom: 25,
  },

  emptyList: {
    flexGrow: 1,
  },

  // Report Card
  reportCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  reportImage: {
    width: "100%",
    height: 190,
    borderRadius: 10,
    marginBottom: 15,
    backgroundColor: "#F1F5F9",
  },

  noImageContainer: {
    width: "100%",
    height: 150,
    borderRadius: 10,
    marginBottom: 15,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },

  noImageText: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 8,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  documentIcon: {
    width: 43,
    height: 43,
    borderRadius: 11,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  cardTitleContainer: {
    flex: 1,
    marginRight: 8,
  },

  reportTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#1E293B",
    lineHeight: 21,
  },

  reportDate: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 5,
  },

  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
  },

  statusText: {
    fontSize: 11,
    fontWeight: "bold",
  },

  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 14,
  },

  // Report Information
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 9,
    gap: 8,
  },

  infoText: {
    flex: 1,
    fontSize: 13,
    color: "#64748B",
  },

  description: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 19,
    marginTop: 3,
  },

  // Empty, Loading, and Error States
  stateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 25,
    paddingBottom: 80,
  },

  stateText: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 12,
  },

  emptyTitle: {
    fontSize: 19,
    fontWeight: "bold",
    color: "#1E293B",
    marginTop: 18,
  },

  emptyDescription: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 21,
    marginTop: 8,
  },

  // Buttons
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16A34A",
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 9,
    marginTop: 22,
    gap: 6,
  },

  createButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },

  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16A34A",
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 9,
    marginTop: 20,
    gap: 7,
  },

  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
