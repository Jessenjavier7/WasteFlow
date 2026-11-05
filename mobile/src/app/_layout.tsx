import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { Stack, useRouter, useSegments } from "expo-router";

import { getAccessToken } from "@/services/auth-storage";

const PRIMARY_COLOR = "#16A34A";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();

  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function checkAuthentication() {
      try {
        const token = await getAccessToken();
        if (!isMounted) return;

        const currentRoute = segments[0];

        const isLoginScreen = currentRoute === "login";
        const isRegisterScreen = currentRoute === "register";
        const isAuthScreen = isLoginScreen || isRegisterScreen;

        if (!token && !isAuthScreen) {
          router.replace("/login");
        } else if (token && isAuthScreen) {
          router.replace("/(tabs)");
        } else if (!token && !isAuthScreen) {
          router.replace("/login");
        }
      } catch (error) {
        console.error("Authentication check failed:", error);

        if (isMounted) {
          router.replace("/login");
        }
      } finally {
        if (isMounted) {
          setIsCheckingAuth(false);
        }
      }
    }

    checkAuthentication();

    return () => {
      isMounted = false;
    };
  }, [segments, router]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="(tabs)" />
      </Stack>

      {isCheckingAuth && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        </View>
      )}
    </>
  );
}

const styles = {
  loadingOverlay: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
};
