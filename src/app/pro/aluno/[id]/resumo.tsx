import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { AlunoTabs } from '@/components/aluno-tabs';
import { Body, Button, Caption, Card, EmptyState, Loading, Pill, Screen, SectionTitle } from '@/components/ui';
import { formatarDataHora } from '@/models/domain';
import { obterPainelGestao, type ResumoAluno } from '@/services/gestaoService';
import { useAuthStore } from '@/store/authStore';
import { Palette } from '@/theme';

export default function ResumoPacienteScreen() {
  const { id: clientId } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const [paciente, setPaciente] = useState<ResumoAluno | null>(null);
  const [consultas, setConsultas] = useState<{ id: string; data_hora: string; status: string; observacoes: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    if (!user || !clientId) return;
    const painel = await obterPainelGestao(user.id);
    setPaciente(painel.alunos.find((aluno) => aluno.clientId === clientId) ?? null);
    setConsultas(
      painel.agenda.filter((consulta) => consulta.patient_id === clientId).map((consulta) => ({
        id: consulta.id,
        data_hora: consulta.data_hora,
        status: consulta.status,
        observacoes: consulta.observacoes,
      })),
    );
    setLoading(false);
  }, [clientId, user]);

  useEffect(() => {
    const task = setTimeout(() => {
      void carregar();
    }, 0);
    return () => clearTimeout(task);
  }, [carregar]);

  if (loading || !user) return <Loading />;
  if (!paciente) return <EmptyState text="Paciente não encontrado na sua carteira." />;

  return (
    <Screen title={paciente.nome} subtitle="Resumo do acompanhamento">
      <AlunoTabs clientId={clientId!} ativo="resumo" />

      <Card>
        <Pill
          label={paciente.status === 'ativa' ? 'Acompanhamento ativo' : `Acompanhamento ${paciente.status}`}
          active
          color={paciente.status === 'ativa' ? Palette.green : Palette.orange}
        />
        <Caption>{paciente.planoNome ? `Serviço contratado: ${paciente.planoNome}` : 'Serviço ainda não confirmado.'}</Caption>
        {paciente.planoSolicitadoNome && !paciente.planoNome ? (
          <Caption color={Palette.orange}>Paciente pediu: {paciente.planoSolicitadoNome}</Caption>
        ) : null}
      </Card>

      <SectionTitle>Prescrições</SectionTitle>
      <Card>
        <Body>Treino</Body>
        <Caption color={paciente.temPlanoTreino ? Palette.green : Palette.orange}>
          {paciente.temPlanoTreino ? 'Plano criado' : 'Ainda não criado'}
        </Caption>
        <Button
          label={paciente.temPlanoTreino ? 'Editar treino' : 'Criar treino'}
          onPress={() => router.push(`/pro/aluno/${clientId}`)}
        />
      </Card>
      <Card>
        <Body>Dieta</Body>
        <Caption color={paciente.temPlanoDieta ? Palette.green : Palette.orange}>
          {paciente.temPlanoDieta ? 'Plano criado' : 'Ainda não criado'}
        </Caption>
        <Button
          label={paciente.temPlanoDieta ? 'Editar dieta' : 'Criar dieta'}
          color={Palette.purple}
          onPress={() => router.push(`/pro/aluno/${clientId}/dieta`)}
        />
      </Card>

      <SectionTitle>Consultas</SectionTitle>
      {consultas.length ? (
        consultas.map((consulta) => (
          <Card key={consulta.id}>
            <Body>{formatarDataHora(consulta.data_hora)}</Body>
            <Caption color={consulta.status === 'realizada' ? Palette.green : Palette.textSecondary}>
              {consulta.status}
            </Caption>
            {consulta.observacoes ? <Caption>{consulta.observacoes}</Caption> : null}
          </Card>
        ))
      ) : (
        <EmptyState text="Nenhuma consulta registrada para este paciente." />
      )}
      <Button label="Agendar consulta no Início" variant="ghost" onPress={() => router.push('/pro')} />
    </Screen>
  );
}
