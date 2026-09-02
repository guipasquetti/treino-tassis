import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { getClientHome, type ClientHomeData } from "@/services/homeService";
import { useAuthStore } from "@/store/authStore";

export function ClientHome() {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const [data, setData] = useState<ClientHomeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getClientHome(user.id).then((result) => {
      setData(result);
      setLoading(false);
    });
  }, [user?.id]);

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          Olá, {profile?.nome || "aluno"}
        </ThemedText>

        {data && data.subscriptions.length > 0 ? (
          data.subscriptions.map((sub) => (
            <ThemedView key={sub.id} type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">{sub.professionalName}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {sub.planName ?? "Sem plano definido"}
              </ThemedText>
            </ThemedView>
          ))
        ) : (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="small" themeColor="textSecondary">
              Nenhuma assinatura ativa ainda.
            </ThemedText>
          </ThemedView>
        )}

        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">Treino</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {data?.activePlan
              ? `Plano vigente: ${data.activePlan.periodo}`
              : "Nenhum plano de treino cadastrado ainda."}
          </ThemedText>
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">Histórico</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {data?.workoutLogCount ?? 0} séries registradas
          </ThemedText>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  safeArea: { flex: 1, padding: Spacing.four, gap: Spacing.three },
  title: { marginBottom: Spacing.two },
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.one },
});
