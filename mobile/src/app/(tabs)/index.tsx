import { Alert } from "react-native";
import { clearAuthData } from "@/services/auth-storage";

import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";

import { getStoredUser, type AuthUser } from "@/services/auth-storage";
import { authenticatedFetch } from "@/services/api";

type ReportStatistics = {
  totalReports: number;
  pendingReports: number;
  completedReports: number;
};

type StatisticsResponse = {
  success: boolean;
  message?: string;
  data: ReportStatistics;
};

export default function DashboardScreen() {
  const router = useRouter();

  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            setLoggingOut(true);

            // Clear authentication data
            await clearAuthData();

            // Redirect to login page
            router.replace("/login");
          } catch (error) {
            console.error("Logout error:", error);

            Alert.alert("Logout Failed", "Unable to logout. Please try again.");

            setLoggingOut(false);
          }
        },
      },
    ]);
  };

  const [user, setUser] = useState<AuthUser | null>(null);

  const [statistics, setStatistics] = useState<ReportStatistics>({
    totalReports: 0,
    pendingReports: 0,
    completedReports: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchDashboardData = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        setError("");

        // 1. Get stored user
        const storedUser = await getStoredUser();
        setUser(storedUser);

        // 2. Get report statistics from backend
        const response = await authenticatedFetch("/api/get-report-info", {
          method: "GET",
        });

        const result: StatisticsResponse = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.message || "Failed to retrieve report statistics.",
          );
        }

        // 3. Update dashboard statistics
        setStatistics({
          totalReports: result.data.totalReports ?? 0,
          pendingReports: result.data.pendingReports ?? 0,
          completedReports: result.data.completedReports ?? 0,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Something went wrong.";

        if (message.toLowerCase().includes("session expired")) {
          router.replace("/login");
          return;
        }

        console.error("Dashboard error:", err);
        setError(message);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [router],
  );

  // Refresh dashboard whenever the screen becomes active
  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [fetchDashboardData]),
  );

  const userName = user?.name?.trim()
    ? user.name.trim().split(/\s+/)[0]
    : "there";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => fetchDashboardData(true)}
          colors={["#16A34A"]}
          tintColor="#16A34A"
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>

          {isLoading && !user ? (
            <ActivityIndicator
              size="small"
              color="#16A34A"
              style={styles.nameLoader}
            />
          ) : (
            <Text style={styles.name}>{userName} 👋</Text>
          )}
        </View>

        {/* <View style={styles.avatar}>
          <Ionicons name="person" size={24} color="#16A34A" />
        </View> */}
        <Pressable
          onPress={handleLogout}
          disabled={loggingOut}
          style={styles.logoutButton}
        >
          <Text style={styles.logoutButtonText}>
            {loggingOut ? "Logging out..." : "Logout"}
          </Text>
        </Pressable>
      </View>

      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Make Your Environment Cleaner!</Text>

        <Text style={styles.heroDescription}>
          Report waste problems around you and help create a cleaner
          environment.
        </Text>
      </View>

      {/* Activities */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>My Activities</Text>

        <Pressable onPress={() => router.push("/(tabs)/my-reports")}>
          <Text style={styles.viewAll}>View All</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={22} color="#DC2626" />

          <View style={styles.errorContent}>
            <Text style={styles.errorText}>{error}</Text>

            <Pressable onPress={() => fetchDashboardData()}>
              <Text style={styles.retryText}>Try Again</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.statsContainer}>
        {/* Total Reports */}
        <View style={styles.statCard}>
          <Ionicons name="document-text-outline" size={26} color="#16A34A" />

          {isLoading ? (
            <ActivityIndicator
              size="small"
              color="#16A34A"
              style={styles.statLoader}
            />
          ) : (
            <Text style={styles.statNumber}>{statistics.totalReports}</Text>
          )}

          <Text style={styles.statLabel}>Total Reports</Text>
        </View>

        {/* Pending Reports */}
        <View style={styles.statCard}>
          <Ionicons name="time-outline" size={26} color="#F59E0B" />

          {isLoading ? (
            <ActivityIndicator
              size="small"
              color="#F59E0B"
              style={styles.statLoader}
            />
          ) : (
            <Text style={styles.statNumber}>{statistics.pendingReports}</Text>
          )}

          <Text style={styles.statLabel}>Pending</Text>
        </View>

        {/* Completed Reports */}
        <View style={styles.statCard}>
          <Ionicons name="checkmark-circle-outline" size={26} color="#2563EB" />

          {isLoading ? (
            <ActivityIndicator
              size="small"
              color="#2563EB"
              style={styles.statLoader}
            />
          ) : (
            <Text style={styles.statNumber}>{statistics.completedReports}</Text>
          )}

          <Text style={styles.statLabel}>Completed</Text>
        </View>
      </View>

      {/* Getting Started */}
      <Text style={styles.sectionTitle}>Getting Started</Text>

      <Pressable
        style={styles.infoCard}
        onPress={() => router.push("/(tabs)/create-report")}
      >
        <Ionicons name="leaf-outline" size={28} color="#16A34A" />

        <View style={{ flex: 1 }}>
          <Text style={styles.infoTitle}>Make a New Report</Text>

          <Text style={styles.infoDescription}>
            Help your community by reporting waste problems in your area.
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  logoutButton: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  logoutButtonText: {
    color: "#DC2626",
    fontSize: 14,
    fontWeight: "600",
  },
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 30,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 35,
    marginBottom: 25,
  },
  greeting: {
    fontSize: 14,
    color: "#64748B",
  },
  name: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1E293B",
    marginTop: 4,
  },
  nameLoader: {
    marginTop: 8,
    alignSelf: "flex-start",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  hero: {
    backgroundColor: "#16A34A",
    borderRadius: 18,
    padding: 22,
    marginBottom: 28,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 10,
  },
  heroDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: "#DCFCE7",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 15,
  },
  viewAll: {
    fontSize: 13,
    fontWeight: "600",
    color: "#16A34A",
    marginBottom: 15,
  },
  statsContainer: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    elevation: 2,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1E293B",
    marginTop: 10,
  },
  statLoader: {
    marginTop: 10,
    height: 26,
  },
  statLabel: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 4,
    textAlign: "center",
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderRadius: 14,
    marginBottom: 25,
    elevation: 2,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#1E293B",
  },
  infoDescription: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 5,
    lineHeight: 19,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FEE2E2",
    padding: 12,
    borderRadius: 10,
    marginBottom: 15,
    gap: 10,
  },
  errorContent: {
    flex: 1,
  },
  errorText: {
    fontSize: 13,
    color: "#991B1B",
  },
  retryText: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#B91C1C",
    marginTop: 6,
  },
});
