import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Card, EmptyState, Field, Loading, Pill, Screen, SectionTitle, Stat } from '@/components/ui';
import { formatarDataHora } from '@/models/domain';
import { obterPainelGestao, type PainelGestao, type ResumoAluno } from '@/services/gestaoService';
import { confirmarPlanoSolicitado } from '@/services/professionalService';
import { atualizarStatusTeleconsulta, criarTeleconsulta, type TeleconsultaComPaciente } from '@/services/teleconsultaService';
import { useAuthStore } from '@/store/authStore';
import { Palette, Radius, Spacing } from '@/theme';

type Alerta = { clientId: string; nome: string; texto: string };

function diasDesde(iso: string | null): number | null {
  if (!iso) return null;
  return Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function montarAlertas(alunos: ResumoAluno[]): Alerta[] {
  const alertas: Alerta[] = [];
  for (const aluno of alunos) {
    const dias = diasDesde(aluno.ultimoTreino);
    if (dias === null || dias > 7) {
      alertas.push({
        clientId: aluno.clientId,
        nome: aluno.nome,
        texto: dias === null ? 'Nunca treinou' : `Sem treino há ${dias} dia${dias === 1 ? '' : 's'}`,
      });
    }
    if (!aluno.temPlanoTreino && !aluno.temPlanoDieta) {
      alertas.push({ clientId: aluno.clientId, nome: aluno.nome, texto: 'Sem plano montado ainda' });
    }
    if (aluno.flagSaude) {
      alertas.push({ clientId: aluno.clientId, nome: aluno.nome, texto: `Saúde: ${aluno.flagSaude}` });
    }
  }
  return alertas;
}

export default function PainelScreen() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const [painel, setPainel] = useState<PainelGestao | null>(null);
  const [loading, setLoading] = useState(true);
  const [agendando, setAgendando] = useState(false);

  const carregar = useCallback(async () => {
    if (!user) return;
    setPainel(await obterPainelGestao(user.id));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setLoading(true);
      return;
    }
    carregar();
  }, [user, carregar]);

  if (loading || !user || !painel) return <Loading />;

  const alertas = montarAlertas(painel.alunos);

  return (
    <Screen
      title="Painel"
      subtitle="Visão geral dos seus pacientes"
      right={
        <Pressable
          onPress={() => router.push('/pro/leads')}
          style={({ pressed }) => [styles.convidar, pressed && styles.convidarPressed]}>
          <Caption color={Palette.text} style={styles.convidarText}>
            + Lead
          </Caption>
        </Pressable>
      }>
      <Card>
        <View style={styles.stats}>
          <Stat value={String(painel.totalAlunos)} label="Total" />
          <Stat value={String(painel.ativos)} label="Ativos" color={Palette.green} />
          <Stat value={String(painel.semPlano)} label="Sem plano" color={Palette.orange} />
        </View>
        <View style={styles.stats}>
          <Stat value={String(painel.semTreino7d)} label="Sem treino 7d+" color={Palette.orange} />
          <Stat value={String(painel.leadsPendentes)} label="Convites pendentes" color={Palette.blue} />
          <Stat value={String(painel.solicitacoesPendentes)} label="Pedidos de plano" color={Palette.blue} />
        </View>
      </Card>

      {painel.alunos.some((a) => !a.planoNome && a.planoSolicitadoId) ? (
        <>
          <SectionTitle>Pedidos de plano</SectionTitle>
          {painel.alunos
            .filter((a) => !a.planoNome && a.planoSolicitadoId)
            .map((a) => <PedidoPlanoCard key={a.subscriptionId} aluno={a} onMudou={carregar} />)}
        </>
      ) : null}

      <SectionTitle>Atenção necessária</SectionTitle>
      {alertas.length ? (
        alertas.map((a, i) => (
          <Card key={`${a.clientId}-${i}`} onPress={() => router.push(`/pro/aluno/${a.clientId}`)}>
            <Body>{a.nome}</Body>
            <Caption color={Palette.orange}>{a.texto}</Caption>
          </Card>
        ))
      ) : (
        <EmptyState text="Nada pedindo atenção agora." />
      )}

      <SectionTitle>Teleconsultas</SectionTitle>
      {painel.agenda.length ? (
        painel.agenda.map((c) => <ConsultaCard key={c.id} consulta={c} onMudou={carregar} />)
      ) : (
        <EmptyState text="Nenhuma teleconsulta agendada ainda." />
      )}
      {agendando ? (
        <NovaConsultaForm
          professionalId={user.id}
          alunos={painel.alunos}
          onCancelar={() => setAgendando(false)}
          onCriada={async () => {
            setAgendando(false);
            await carregar();
          }}
        />
      ) : (
        <Button label="Agendar teleconsulta" variant="ghost" onPress={() => setAgendando(true)} />
      )}

      <SectionTitle>Alunos</SectionTitle>
      {painel.alunos.length ? (
        painel.alunos.map((aluno) => <AlunoCard key={aluno.clientId} aluno={aluno} />)
      ) : (
        <EmptyState text="Nenhum aluno vinculado ainda. Alunos aparecem aqui quando têm uma assinatura com você." />
      )}
    </Screen>
  );
}

function AlunoCard({ aluno }: { aluno: ResumoAluno }) {
  const router = useRouter();
  const dias = diasDesde(aluno.ultimoTreino);
  const alerta = dias === null || dias > 7;

  return (
    <Card onPress={() => router.push(`/pro/aluno/${aluno.clientId}`)}>
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

      <View style={styles.badges}>
        <Caption color={aluno.temPlanoTreino ? Palette.green : Palette.textTertiary}>Treino</Caption>
        <Caption color={aluno.temPlanoDieta ? Palette.green : Palette.textTertiary}>Dieta</Caption>
      </View>

      <Caption color={alerta ? Palette.orange : Palette.textSecondary}>
        {aluno.ultimoTreino
          ? `Último treino: ${dias === 0 ? 'hoje' : `há ${dias} dia${dias === 1 ? '' : 's'}`}`
          : 'Nunca registrou um treino'}
      </Caption>
    </Card>
  );
}

/**
 * Aluno respondeu a anamnese e pediu um plano no onboarding (§12), mas ninguém confirmou
 * ainda — enquanto isso, treino e dieta ficam bloqueados pro aluno. "Confirmar" grava
 * `plan_id` de verdade (`confirmarPlanoSolicitado`), que é o que libera.
 */
function PedidoPlanoCard({ aluno, onMudou }: { aluno: ResumoAluno; onMudou: () => Promise<void> }) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);

  async function confirmar() {
    if (!aluno.planoSolicitadoId) return;
    setSalvando(true);
    try {
      await confirmarPlanoSolicitado(aluno.subscriptionId, aluno.planoSolicitadoId);
      await onMudou();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card onPress={() => router.push(`/pro/aluno/${aluno.clientId}`)}>
      <View style={styles.header}>
        <Body style={styles.nome}>{aluno.nome}</Body>
        <Caption color={Palette.blue}>Pediu: {aluno.planoSolicitadoNome}</Caption>
      </View>
      <Button label={`Confirmar ${aluno.planoSolicitadoNome}`} onPress={confirmar} loading={salvando} />
    </Card>
  );
}

function ConsultaCard({
  consulta,
  onMudou,
}: {
  consulta: TeleconsultaComPaciente;
  onMudou: () => Promise<void>;
}) {
  const [salvando, setSalvando] = useState(false);

  async function marcar(status: 'realizada' | 'cancelada') {
    setSalvando(true);
    try {
      await atualizarStatusTeleconsulta(consulta.id, status);
      await onMudou();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card>
      <View style={styles.header}>
        <Body style={styles.nome}>{consulta.pacienteNome}</Body>
        <Caption color={STATUS_COR[consulta.status] ?? Palette.textSecondary} style={styles.statusUpper}>
          {consulta.status}
        </Caption>
      </View>
      <Caption color={Palette.text}>{formatarDataHora(consulta.data_hora)}</Caption>
      {consulta.observacoes ? <Caption>{consulta.observacoes}</Caption> : null}

      {consulta.status === 'agendada' ? (
        <View style={styles.acoes}>
          <Button label="Entrar" onPress={() => Linking.openURL(consulta.link_meet)} />
          <Button label="Realizada" variant="ghost" onPress={() => marcar('realizada')} disabled={salvando} />
          <Button
            label="Cancelar"
            variant="ghost"
            color={Palette.danger}
            onPress={() => marcar('cancelada')}
            disabled={salvando}
          />
        </View>
      ) : null}
    </Card>
  );
}

const STATUS_COR: Record<string, string> = {
  agendada: Palette.blue,
  realizada: Palette.green,
  cancelada: Palette.textTertiary,
};

function NovaConsultaForm({
  professionalId,
  alunos,
  onCriada,
  onCancelar,
}: {
  professionalId: string;
  alunos: ResumoAluno[];
  onCriada: () => Promise<void>;
  onCancelar: () => void;
}) {
  const [pacienteId, setPacienteId] = useState<string | null>(null);
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [link, setLink] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!pacienteId) {
      setErro('Escolhe o aluno.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      setErro('Data no formato AAAA-MM-DD.');
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(hora)) {
      setErro('Hora no formato HH:MM.');
      return;
    }
    if (!link.trim()) {
      setErro('Cola o link do Meet (gere em meet.google.com/new).');
      return;
    }
    const dataHora = new Date(`${data}T${hora}:00`);
    if (Number.isNaN(dataHora.getTime())) {
      setErro('Data ou hora inválida.');
      return;
    }
    setErro(null);
    setSalvando(true);
    try {
      await criarTeleconsulta({
        professional_id: professionalId,
        patient_id: pacienteId,
        data_hora: dataHora.toISOString(),
        link_meet: link.trim(),
        observacoes: observacoes.trim(),
      });
      await onCriada();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui agendar.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card>
      <SectionTitle>Nova teleconsulta</SectionTitle>

      <Caption>Aluno</Caption>
      <View style={styles.alunosPicker}>
        {alunos.map((a) => (
          <Pill
            key={a.clientId}
            label={a.nome}
            active={pacienteId === a.clientId}
            onPress={() => setPacienteId(a.clientId)}
          />
        ))}
      </View>

      <Field label="Data" value={data} onChangeText={setData} placeholder="AAAA-MM-DD" />
      <Field label="Hora" value={hora} onChangeText={setHora} placeholder="HH:MM" />
      <Field
        label="Link do Meet"
        value={link}
        onChangeText={setLink}
        placeholder="https://meet.google.com/xxx-xxxx-xxx"
      />
      <Field label="Observações (opcional)" value={observacoes} onChangeText={setObservacoes} multiline />

      {erro ? <Caption color={Palette.danger}>{erro}</Caption> : null}

      <Button label="Agendar" onPress={salvar} loading={salvando} />
      <Button label="Cancelar" variant="ghost" onPress={onCancelar} />
    </Card>
  );
}

const styles = StyleSheet.create({
  convidar: {
    backgroundColor: Palette.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.lg,
  },
  convidarPressed: {
    opacity: 0.7,
  },
  convidarText: {
    fontWeight: '800',
  },
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
  statusUpper: {
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  badges: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  acoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  alunosPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
});
