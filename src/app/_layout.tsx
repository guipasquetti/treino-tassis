import { DarkTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { useAuthStore } from '@/store/authStore';
import { Palette } from '@/theme';

SplashScreen.preventAutoHideAsync();

/** O app é dark-only por decisão de identidade visual (referência Apple Fitness). */
const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Palette.background,
    card: Palette.surface,
    text: Palette.text,
    border: Palette.border,
    primary: Palette.accent,
  },
};

export default function RootLayout() {
  const { session, isLoading, profileLoaded, isProfessional, initialize } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    initialize().finally(() => SplashScreen.hideAsync().catch(() => {}));
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const raiz = segments[0];
    // A rota "/" (raiz undefined) decide sozinha pra onde ir — ver src/app/index.tsx.
    if (raiz === undefined) return;

    if (!session) {
      if (raiz !== 'login') router.replace('/login');
      return;
    }

    // Espera saber o papel antes de escolher a área — senão o aluno pisca na tela do
    // profissional (ou vice-versa) no primeiro render depois do login.
    if (!profileLoaded) return;

    // Trocou de papel ou entrou pela área errada (deep link, sessão antiga): corrige.
    const areaCorreta = isProfessional ? 'pro' : 'aluno';
    if (raiz !== areaCorreta) {
      router.replace(isProfessional ? '/pro' : '/aluno');
    }
  }, [session, isLoading, profileLoaded, isProfessional, segments]);

  return (
    <ThemeProvider value={theme}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Palette.background } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="aluno" />
        <Stack.Screen name="pro" />
      </Stack>
    </ThemeProvider>
  );
}
