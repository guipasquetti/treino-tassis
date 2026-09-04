import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';

import { Loading } from '@/components/ui';
import { OnboardingAnamnese } from '@/components/onboarding-anamnese';
import { possuiAnamnese } from '@/services/onboardingService';
import { useAuthStore } from '@/store/authStore';
import { Palette } from '@/theme';

/**
 * Gate de onboarding (§12, 04/set): aluno sem anamnese ainda vê o formulário aqui, não as
 * abas. Uma vez enviado, `temAnamnese` vira `true` no state local e libera as abas — sem
 * precisar de reload, porque a RPC já gravou no banco.
 */
export default function ClientLayout() {
  const user = useAuthStore((s) => s.user);
  const [temAnamnese, setTemAnamnese] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setTemAnamnese(null);
      return;
    }
    possuiAnamnese(user.id).then(setTemAnamnese);
  }, [user]);

  if (!user || temAnamnese === null) return <Loading />;
  if (!temAnamnese) return <OnboardingAnamnese onConcluido={() => setTemAnamnese(true)} />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Palette.accent,
        tabBarInactiveTintColor: Palette.textTertiary,
        tabBarStyle: {
          backgroundColor: Palette.surface,
          borderTopColor: Palette.border,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Treino',
          tabBarIcon: ({ color, size }) => <Ionicons name="barbell" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="dieta"
        options={{
          title: 'Dieta',
          tabBarIcon: ({ color, size }) => <Ionicons name="restaurant" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
