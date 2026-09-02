import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { getProfessionalHome, type ProfessionalHomeData } from "@/services/homeService";
import { useAuthStore } from "@/store/authStore";

export function ProfessionalHome() {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const [data, setData] = useState<ProfessionalHomeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getProfessionalHome(user.id).then((result) => {
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
          Olá, {profile?.nome || "profissional"}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {data?.clients.length ?? 0} aluno{data?.clients.length === 1 ? "" : "s"}
        </ThemedText>

        {data && data.clients.length > 0 ? (
          data.clients.map((client) => (
            <ThemedView key={client.subscriptionId} type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">{client.clientName}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {client.planName ?? "Sem plano definido"} · {client.status}
              </ThemedText>
            </ThemedView>
          ))
        ) : (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="small" themeColor="textSecondary">
              Nenhum aluno vinculado ainda.
            </ThemedText>
          </ThemedView>
        )}
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
