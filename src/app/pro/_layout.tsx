import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { RoleThemeProvider } from '@/contexts/role-theme';
import { Palette, RoleColors } from '@/theme';

export default function ProLayout() {
  return (
    <RoleThemeProvider color={RoleColors.profissional}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: RoleColors.profissional,
          tabBarInactiveTintColor: Palette.textTertiary,
          tabBarStyle: {
            backgroundColor: Palette.surface,
            borderTopColor: Palette.border,
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Painel',
            tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="leads"
          options={{
            title: 'Leads',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="people-circle" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="planos"
          options={{
            title: 'Planos',
            tabBarIcon: ({ color, size }) => <Ionicons name="pricetags" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="perfil"
          options={{
            title: 'Perfil',
            tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
          }}
        />
        {/* Detalhe do aluno e geração de convite: acessíveis por push, não são abas. */}
        <Tabs.Screen name="convite" options={{ href: null, headerShown: false }} />
        <Tabs.Screen
          name="aluno/[id]/index"
          options={{
            href: null,
            headerShown: true,
            title: 'Plano de treino',
            headerStyle: { backgroundColor: Palette.background },
            headerTintColor: Palette.text,
            headerShadowVisible: false,
          }}
        />
        <Tabs.Screen
          name="aluno/[id]/dieta"
          options={{
            href: null,
            headerShown: true,
            title: 'Plano alimentar',
            headerStyle: { backgroundColor: Palette.background },
            headerTintColor: Palette.text,
            headerShadowVisible: false,
          }}
        />
      </Tabs>
    </RoleThemeProvider>
  );
}
