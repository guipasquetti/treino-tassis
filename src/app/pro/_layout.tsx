import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { Palette } from '@/theme';

export default function ProLayout() {
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
          title: 'Alunos',
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
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
      {/* Detalhe do aluno: acessível por push a partir da lista, não é uma aba. */}
      <Tabs.Screen
        name="aluno/[id]"
        options={{
          href: null,
          headerShown: true,
          title: 'Plano de treino',
          headerStyle: { backgroundColor: Palette.background },
          headerTintColor: Palette.text,
          headerShadowVisible: false,
        }}
      />
    </Tabs>
  );
}
