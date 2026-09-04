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

    // Fluxo público de convite: sem sessão até o fim (ou sessão momentânea criada no meio
    // do próprio fluxo, antes de finalizar_cadastro_convite rodar). Não pode ser
    // redirecionado por aqui — a própria tela navega quando termina.
    if (raiz === 'convite') return;

    // Cadastro de profissional (§0, 04/set): mesma lógica — sem sessão até o fim, ou sessão
    // momentânea criada no meio do próprio fluxo (signUp acontece antes de
    // cadastrar_profissional rodar).
    if (raiz === 'cadastro-profissional') return;

    if (!session) {
      if (raiz !== 'login') router.replace('/login');
      return;
    }

    // Admin (04/set) é ortogonal a aluno/profissional — o Guilherme, por exemplo, é cliente
    // do Tassis E admin. Não pode cair na regra de área abaixo.
    if (raiz === 'admin') return;

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
