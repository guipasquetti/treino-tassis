import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, Card, EmptyState, Loading, Screen, Stat } from '@/components/ui';
import { formatarData, hojeISO } from '@/models/domain';
import { listarAlunos, type AlunoVinculado } from '@/services/professionalService';
import { useAuthStore } from '@/store/authStore';
import { Palette, Radius, Spacing } from '@/theme';

/** Dias desde a última sessão registrada. Null quando nunca treinou. */
function diasDesde(iso: string | null): number | null {
  if (!iso) return null;
  const hoje = new Date(hojeISO());
  const data = new Date(iso);
  return Math.round((hoje.getTime() - data.getTime()) / 86_400_000);
}

export default function AlunosScreen() {
  const user = useAuthStore((s) => s.user);
  const [alunos, setAlunos] = useState<AlunoVinculado[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    if (!user) return;
    setAlunos(await listarAlunos(user.id));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (loading) return <Loading />;

  const ativos = alunos.filter((a) => a.status === 'ativa').length;
  const inativos = alunos.filter((a) => {
    const dias = diasDesde(a.ultimoTreino);
    return dias === null || dias > 7;
  }).length;

  return (
    <Screen title="Alunos">
      <Card>
        <View style={styles.stats}>
          <Stat value={String(alunos.length)} label="Total" />
          <Stat value={String(ativos)} label="Assinatura ativa" color={Palette.green} />
          <Stat value={String(inativos)} label="Sem treino 7d+" color={Palette.orange} />
        </View>
      </Card>

      {alunos.length ? (
        alunos.map((aluno) => <AlunoCard key={aluno.subscriptionId} aluno={aluno} />)
      ) : (
        <EmptyState text="Nenhum aluno vinculado ainda. Alunos aparecem aqui quando têm uma assinatura com você." />
      )}
    </Screen>
  );
}

function AlunoCard({ aluno }: { aluno: AlunoVinculado }) {
  const dias = diasDesde(aluno.ultimoTreino);
  const alerta = dias === null || dias > 7;

  return (
    <Card>
      <View style={styles.header}>
        <Body style={styles.nome}>{aluno.nome}</Body>
        <View
          style={[
            styles.status,
            { backgroundColor: aluno.status === 'ativa' ? Palette.green : Palette.orange },
          ]}>
          <Caption color={Palette.background} style={styles.statusText}>
            {aluno.status}
          </Caption>
        </View>
      </View>

      <Caption>{aluno.planoNome ?? 'Sem plano definido'}</Caption>

      <Caption color={alerta ? Palette.orange : Palette.textSecondary}>
        {aluno.ultimoTreino
          ? `Último treino: ${formatarData(aluno.ultimoTreino)}${
              dias !== null && dias > 0 ? ` · há ${dias} dia${dias === 1 ? '' : 's'}` : ' · hoje'
            }`
          : 'Nunca registrou um treino'}
      </Caption>
    </Card>
  );
}

const styles = StyleSheet.create({
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  nome: {
    flex: 1,
  },
  status: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  statusText: {
    fontWeight: '800',
    textTransform: 'capitalize',
  },
});
