import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Pill } from '@/components/ui';
import { Palette, RoleColors, Spacing } from '@/theme';

/** Alternador entre as duas frentes de trabalho do profissional sobre um aluno. */
export function AlunoTabs({ clientId, ativo }: { clientId: string; ativo: 'treino' | 'dieta' }) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Pill
        label="Treino"
        active={ativo === 'treino'}
        color={RoleColors.profissional}
        onPress={() => router.replace(`/pro/aluno/${clientId}`)}
      />
      <Pill
        label="Dieta"
        active={ativo === 'dieta'}
        color={Palette.purple}
        onPress={() => router.replace(`/pro/aluno/${clientId}/dieta`)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
});
