import { useCallback, useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { CheckinFlow, CheckinResumo } from '@/components/checkin-flow';
import { Button, Caption, Card, EmptyState, Loading, Screen, SectionTitle } from '@/components/ui';
import { formatarDataHora } from '@/models/domain';
import type { ResumoCheckin } from '@/models/checkin';
import {
  checkinPendente,
  listarMeusCheckins,
  obterComparacaoFotos,
  type CheckIn,
  type ComparacaoAngulo,
} from '@/services/checkinService';
import { listarMeusProfissionais } from '@/services/professionalService';
import { useAuthStore } from '@/store/authStore';
import { Palette, Radius, Spacing } from '@/theme';

/**
 * Check-in do aluno (FA do roadmap, 06/set): série recorrente respondida pelo paciente,
 * separada do plano de treino/dieta. Escolhe o primeiro profissional vinculado — paciente
 * com nutri e treinador distintos (N:N) ainda respondem um check-in só; simplificação
 * conhecida, mesma classe do gate tudo-ou-nada de Treino/Dieta já documentado no HANDOFF.
 */
export default function CheckinScreen() {
  const user = useAuthStore((s) => s.user);
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [pendente, setPendente] = useState<boolean | null>(null);
  const [historico, setHistorico] = useState<CheckIn[]>([]);
  const [comparacao, setComparacao] = useState<ComparacaoAngulo[]>([]);
  const [emAndamento, setEmAndamento] = useState(false);
  const [resumo, setResumo] = useState<ResumoCheckin | null>(null);

  const carregar = useCallback(async () => {
    if (!user) return;
    const [profissionais, pend, hist, fotos] = await Promise.all([
      listarMeusProfissionais(user.id),
      checkinPendente(user.id),
      listarMeusCheckins(user.id),
      obterComparacaoFotos(user.id),
    ]);
    setProfessionalId(profissionais[0]?.professionalId ?? null);
    setPendente(pend);
    setHistorico(hist);
    setComparacao(fotos);
  }, [user?.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (!user || pendente === null) return <Loading />;

  if (resumo) {
    return (
      <CheckinResumo
        resumo={resumo}
        onFechar={() => {
          setResumo(null);
          setEmAndamento(false);
          carregar();
        }}
      />
    );
  }

  if (emAndamento && professionalId) {
    return <CheckinFlow clientId={user.id} professionalId={professionalId} onConcluido={setResumo} />;
  }

  return (
    <Screen title="Check-in" subtitle="Acompanhamento periódico">
      {!professionalId ? (
        <EmptyState text="Você ainda não tem um profissional vinculado." />
      ) : pendente ? (
        <Card>
          <SectionTitle>Check-in disponível</SectionTitle>
          <Caption>
            Leva poucos minutos e ajuda seu profissional a acompanhar sua evolução de perto.
          </Caption>
          <Button label="Começar check-in" onPress={() => setEmAndamento(true)} />
        </Card>
      ) : (
        <Card>
          <Caption>
            Você já respondeu seu check-in recente. Volta em alguns dias pra fazer o próximo.
          </Caption>
        </Card>
      )}

      {comparacao.length > 0 ? (
        <>
          <SectionTitle>Progresso visual</SectionTitle>
          {comparacao.map((c) => (
            <Card key={c.angulo}>
              <Caption>{c.label}</Caption>
              <View style={styles.fotos}>
                <View style={styles.fotoBloco}>
                  <Caption color={Palette.textTertiary}>
                    Antes · {c.primeira ? formatarDataHora(c.primeira.data) : '—'}
                  </Caption>
                  {c.primeira ? (
                    <Image source={{ uri: c.primeira.url }} style={styles.foto} resizeMode="cover" />
                  ) : (
                    <View style={styles.fotoVazia} />
                  )}
                </View>
                <View style={styles.fotoBloco}>
                  <Caption color={Palette.textTertiary}>
                    Agora · {c.ultima ? formatarDataHora(c.ultima.data) : '—'}
                  </Caption>
                  {c.ultima ? (
                    <Image source={{ uri: c.ultima.url }} style={styles.foto} resizeMode="cover" />
                  ) : (
                    <View style={styles.fotoVazia} />
                  )}
                </View>
              </View>
            </Card>
          ))}
        </>
      ) : null}

      {historico.length > 0 ? (
        <>
          <SectionTitle>Histórico</SectionTitle>
          {historico.slice(0, 10).map((c) => (
            <Card key={c.id}>
              <View style={styles.linha}>
                <Caption>{formatarDataHora(c.created_at)}</Caption>
                <Caption color={Palette.text}>
                  {c.pontuacao_geral != null ? `${Math.round(c.pontuacao_geral)}%` : '—'}
                </Caption>
              </View>
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  linha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  fotos: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  fotoBloco: {
    flex: 1,
    gap: Spacing.xs,
  },
  foto: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: Radius.md,
    backgroundColor: Palette.surfaceElevated,
  },
  fotoVazia: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: Radius.md,
    backgroundColor: Palette.surfaceElevated,
  },
});
