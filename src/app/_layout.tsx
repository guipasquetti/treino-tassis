import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { useColorScheme } from "react-native";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import { useAuthStore } from "@/store/authStore";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { session, isLoading, profileLoaded, initialize } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const inLogin = segments[0] === "login";

    if (!session && !inLogin) {
      router.replace("/login");
      return;
    }

    // Sessão presente mas profile/professional ainda carregando — aguarda antes de
    // decidir pra onde ir (evita mandar pro app com estado incompleto).
    if (session && !profileLoaded) return;

    if (session && inLogin) {
      router.replace("/(app)");
    }
  }, [session, isLoading, profileLoaded, segments]);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="(app)" />
      </Stack>
    </ThemeProvider>
  );
}
