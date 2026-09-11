import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Pill } from '@/components/ui';
import { Palette, RoleColors, Spacing } from '@/theme';

/** Navegação do prontuário do paciente, entre o resumo e as duas prescrições. */
export function AlunoTabs({
  clientId,
  ativo,
}: {
  clientId: string;
  ativo: 'resumo' | 'treino' | 'dieta' | 'anamnese';
}) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Pill
        label="Resumo"
        active={ativo === 'resumo'}
        color={Palette.accent}
        onPress={() => router.replace(`/pro/aluno/${clientId}/resumo`)}
      />
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
      <Pill
        label="Anamnese"
        active={ativo === 'anamnese'}
        color={Palette.orange}
        onPress={() => router.replace(`/pro/aluno/${clientId}/anamnese`)}
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
