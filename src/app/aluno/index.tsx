import { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

import {
  Body,
  Button,
  Caption,
  Card,
  DragSlider,
  EmptyState,
  Field,
  Loading,
  Pill,
  Screen,
  SectionTitle,
  StepperButton,
} from '@/components/ui';
import {
  formatarData,
  formatarSet,
  type DiaTreino,
  type Exercicio,
  type SetLog,
} from '@/models/domain';
import {
  avaliar,
  concluidoHoje,
  corrigirUltimaSerie,
  getWorkoutData,
  registrarSerie,
  seriesDeHoje,
  sessaoAnterior,
  snapPeso,
  sugerirSerie,
  type WorkoutData,
} from '@/services/workoutService';
import { temPlanoConfirmado } from '@/services/professionalService';
import { useAuthStore } from '@/store/authStore';
import { Palette, Radius, Spacing, trainingColor } from '@/theme';

export default function TreinoScreen() {
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<WorkoutData | null>(null);
  const [liberado, setLiberado] = useState(true);
  const [loading, setLoading] = useState(true);
  const [diaAtivo, setDiaAtivo] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!user) return;
    const [resultado, confirmado] = await Promise.all([
      getWorkoutData(user.id),
      temPlanoConfirmado(user.id),
    ]);
    setData(resultado);
    setLiberado(confirmado);
    setDiaAtivo((atual) => atual ?? resultado.plano?.dias[0]?.id ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setData(null);
      setLoading(true);
      return;
    }
    carregar();
  }, [user, carregar]);

  if (loading || !user) return <Loading />;

  if (!liberado) {
    return (
      <Screen title="Treino">
        <EmptyState text="Aguardando seu profissional confirmar o plano contratado pra liberar o treino." />
      </Screen>
    );
  }

  const dias = data?.plano?.dias ?? [];
  if (!dias.length) {
    return (
      <Screen title="Treino">
        <EmptyState text="Seu treinador ainda não montou um plano de treino." />
      </Screen>
    );
  }

  const dia = dias.find((d) => d.id === diaAtivo) ?? dias[0];
  const cor = trainingColor(dia.tipo);

  return (
    <Screen title="Treino" subtitle={data?.plano?.periodo || undefined}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dayTabs}>
        {dias.map((d) => (
          <Pill
            key={d.id}
            label={`${d.id} · ${d.nome}`}
            active={d.id === dia.id}
            color={trainingColor(d.tipo)}
            onPress={() => setDiaAtivo(d.id)}
          />
        ))}
      </ScrollView>

      <View style={[styles.dayHeader, { borderLeftColor: cor }]}>
        <Body>{dia.nome}</Body>
        <Caption>{dia.desc}</Caption>
      </View>

      {dia.ex.map((ex) => (
        <ExercicioCard
          key={ex.id}
          ex={ex}
          cor={cor}
          data={data!}
          onMudou={carregar}
          clientId={user!.id}
        />
      ))}
    </Screen>
  );
}

function ExercicioCard({
  ex,
  cor,
  data,
  clientId,
  onMudou,
}: {
  ex: Exercicio;
  cor: string;
  data: WorkoutData;
  clientId: string;
  onMudou: () => Promise<void>;
}) {
  const historico = data.historico[ex.id];
  const rascunho = data.rascunhos[ex.id];
  const logadas = seriesDeHoje(historico, rascunho);
  const anterior = sessaoAnterior(historico);
  const concluido = concluidoHoje(historico);
  const avaliacao = avaliar(ex, anterior);

  const [pendente, setPendente] = useState<SetLog | null>(null);
  const [salvando, setSalvando] = useState(false);

  const sugerida = pendente ?? sugerirSerie(ex, logadas, anterior);

  async function registrar() {
    setSalvando(true);
    try {
      await registrarSerie(clientId, ex, logadas, sugerida);
      setPendente(null);
      await onMudou();
    } finally {
      setSalvando(false);
    }
  }

  async function corrigir() {
    setSalvando(true);
    try {
      const removida = await corrigirUltimaSerie(clientId, ex, historico, rascunho);
      setPendente(removida);
      await onMudou();
    } finally {
      setSalvando(false);
    }
  }

  const restantes = ex.sets - logadas.length;

  return (
    <Card>
      <View style={styles.exHeader}>
        <Body style={styles.exName}>{ex.nome}</Body>
        <View style={[styles.badge, { backgroundColor: concluido ? Palette.green : cor }]}>
          <Caption color={Palette.background} style={styles.badgeText}>
            {logadas.length}/{ex.sets}
          </Caption>
        </View>
      </View>

      <Caption>
        Warm {ex.warm} · Feeder {ex.feeder} ·{' '}
        <Caption color={cor}>
          Working {ex.min}-{ex.max}
          {ex.tempo ? 's' : ''} ({ex.sets}x)
        </Caption>
      </Caption>

      {ex.nota ? <Caption color={Palette.orange}>{ex.nota}</Caption> : null}

      {ex.video ? (
        <Button
          label="Ver vídeo"
          variant="ghost"
          color={cor}
          onPress={() => Linking.openURL(ex.video!)}
        />
      ) : null}

      {anterior ? (
        <Caption>
          Última ({formatarData(anterior.data)}):{' '}
          <Caption color={Palette.text}>
            {anterior.sets.map((s) => formatarSet(ex, s)).join(' · ')}
          </Caption>
        </Caption>
      ) : null}

      <Caption color={avaliacao.tipo === 'up' ? Palette.green : Palette.textSecondary}>
        {avaliacao.texto}
      </Caption>

      {logadas.length > 0 ? (
        <View style={styles.logadas}>
          {logadas.map((s, i) => (
            <View key={i} style={styles.logadaChip}>
              <Caption color={Palette.text}>{formatarSet(ex, s)}</Caption>
              {s.obs ? <Caption color={Palette.textSecondary}>{s.obs}</Caption> : null}
            </View>
          ))}
        </View>
      ) : null}

      {concluido ? (
        <Caption color={Palette.green}>✓ Treino de hoje registrado</Caption>
      ) : (
        <View style={styles.registro}>
          {!ex.tempo && (
            <View style={styles.sliderRow}>
              <View style={styles.sliderLabel}>
                <Caption>Carga</Caption>
                <Body>{sugerida.p}kg</Body>
              </View>
              <DragSlider
                value={sugerida.p}
                min={0}
                max={300}
                color={cor}
                snap={snapPeso}
                onChange={(p) => setPendente({ ...sugerida, p })}
              />
            </View>
          )}

          <View style={styles.stepperRow}>
            <Caption>{ex.tempo ? 'Tempo' : 'Reps'}</Caption>
            <View style={styles.stepperControls}>
              <StepperButton
                icon="remove"
                onPress={() =>
                  setPendente({ ...sugerida, r: Math.max(0, sugerida.r - (ex.tempo ? 5 : 1)) })
                }
              />
              <Body style={styles.stepperValue}>
                {sugerida.r}
                {ex.tempo ? 's' : ''}
              </Body>
              <StepperButton
                icon="add"
                onPress={() => setPendente({ ...sugerida, r: sugerida.r + (ex.tempo ? 5 : 1) })}
              />
            </View>
          </View>

          <Field
            label="Observação (opcional)"
            value={sugerida.obs ?? ''}
            onChangeText={(obs) => setPendente({ ...sugerida, obs: obs || undefined })}
            placeholder="Ex.: senti dor no ombro"
          />

          <Button
            label={`Registrar ${logadas.length + 1}ª série${restantes === 1 ? ' (última)' : ''}`}
            color={cor}
            onPress={registrar}
            loading={salvando}
          />
        </View>
      )}

      {logadas.length > 0 && (
        <Button label="Corrigir última série" variant="ghost" color={Palette.orange} onPress={corrigir} />
      )}

      {historico && historico.length > 0 && (
        <View style={styles.historico}>
          <SectionTitle>Histórico</SectionTitle>
          {historico
            .slice()
            .reverse()
            .slice(0, 5)
            .map((s, i) => (
              <View key={i} style={styles.histRow}>
                <Caption>{formatarData(s.data)}</Caption>
                <Caption color={Palette.text}>
                  {s.sets.map((x) => formatarSet(ex, x)).join('  ·  ')}
                </Caption>
              </View>
            ))}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  dayTabs: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  dayHeader: {
    borderLeftWidth: 3,
    paddingLeft: Spacing.md,
    gap: 2,
  },
  exHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  exName: {
    flex: 1,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  badgeText: {
    fontWeight: '800',
  },
  logadas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  logadaChip: {
    backgroundColor: Palette.surfaceElevated,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    gap: 2,
  },
  registro: {
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  sliderRow: {
    gap: Spacing.xs,
  },
  sliderLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  stepperValue: {
    minWidth: 72,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  historico: {
    gap: Spacing.xs,
  },
  histRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
});
