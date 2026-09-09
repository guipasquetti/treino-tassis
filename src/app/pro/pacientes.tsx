import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';

import { Body, Button, Caption, Card, EmptyState, Loading, Pill, Screen, SectionTitle } from '@/components/ui';
import { obterPainelGestao, type ResumoAluno } from '@/services/gestaoService';
import { useAuthStore } from '@/store/authStore';
import { Palette } from '@/theme';

type Filtro = 'todos' | 'ativa' | 'pausada' | 'encerrada';

export default function PacientesScreen() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const [pacientes, setPacientes] = useState<ResumoAluno[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>('todos');

  const carregar = useCallback(async () => {
    if (!user) return;
    const painel = await obterPainelGestao(user.id);
    setPacientes(painel.alunos);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const task = setTimeout(() => {
      void carregar();
    }, 0);
    return () => clearTimeout(task);
  }, [carregar, user]);

  const visiveis = useMemo(
    () => (filtro === 'todos' ? pacientes : pacientes.filter((paciente) => paciente.status === filtro)),
    [filtro, pacientes],
  );

  if (loading || !user) return <Loading />;

  return (
    <Screen title="Pacientes" subtitle="Acompanhamentos que já estão ativos na sua carteira">
      <SectionTitle>Carteira</SectionTitle>
      <Caption>Leads ficam em Leads até aceitarem o convite e concluírem o cadastro.</Caption>

      <Pill label="Todos" active={filtro === 'todos'} color={Palette.accent} onPress={() => setFiltro('todos')} />
      <Pill label="Ativos" active={filtro === 'ativa'} color={Palette.green} onPress={() => setFiltro('ativa')} />
      <Pill label="Em pausa" active={filtro === 'pausada'} color={Palette.orange} onPress={() => setFiltro('pausada')} />

      {visiveis.length ? (
        visiveis.map((paciente) => (
          <Card key={paciente.clientId} onPress={() => router.push(`/pro/aluno/${paciente.clientId}/resumo`)}>
            <Body>{paciente.nome}</Body>
            <Caption color={paciente.status === 'ativa' ? Palette.green : Palette.orange}>
              {paciente.status === 'ativa' ? 'Acompanhamento ativo' : `Acompanhamento ${paciente.status}`}
            </Caption>
            <Caption>
              {paciente.planoNome ? `Serviço: ${paciente.planoNome}` : 'Serviço ainda não confirmado'}
            </Caption>
            <Caption color={Palette.textSecondary}>
              {paciente.temPlanoTreino ? 'Treino criado' : 'Sem treino'} ·{' '}
              {paciente.temPlanoDieta ? 'Dieta criada' : 'Sem dieta'}
            </Caption>
          </Card>
        ))
      ) : (
        <EmptyState text="Nenhum paciente neste filtro." />
      )}

      <Button label="Ver leads" variant="ghost" onPress={() => router.push('/pro/leads')} />
    </Screen>
  );
}
