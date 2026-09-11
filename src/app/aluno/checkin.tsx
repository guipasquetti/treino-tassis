import { useCallback, useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { CheckinFlow, CheckinResumo } from '@/components/checkin-flow';
import {
  BarraProgresso,
  Button,
  Caption,
  Card,
  EmptyState,
  Loading,
  Pill,
  Screen,
  SectionTitle,
  Sparkline,
  Stat,
} from '@/components/ui';
import { formatarDataHora } from '@/models/domain';
import type { ResumoCheckin } from '@/models/checkin';
import {
  checkinPendente,
  historicoPontuacao,
  listarCheckinsDaAssinatura,
  obterComparacaoFotos,
  resumoAdesao,
  streakCheckin,
  type CheckIn,
  type ComparacaoAngulo,
} from '@/services/checkinService';
import { listarMeusProfissionais, type ProfissionalVinculado } from '@/services/professionalService';
import { useAuthStore } from '@/store/authStore';
import { Palette, Radius, Spacing } from '@/theme';

/**
 * Check-in do aluno (FA do roadmap, 06/set): série recorrente respondida pelo paciente,
 * separado por acompanhamento contratado. Quem tem nutricionista e treinador escolhe para
 * qual profissional responder; histórico, fotos e prazo ficam isolados por assinatura.
 */
export default function CheckinScreen() {
  const user = useAuthStore((s) => s.user);
  const [profissionais, setProfissionais] = useState<ProfissionalVinculado[] | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [pendente, setPendente] = useState<boolean | null>(null);
  const [historico, setHistorico] = useState<CheckIn[]>([]);
  const [comparacao, setComparacao] = useState<ComparacaoAngulo[]>([]);
  const [emAndamento, setEmAndamento] = useState(false);
  const [resumo, setResumo] = useState<ResumoCheckin | null>(null);

  const carregar = useCallback(async () => {
    if (!user) return;
    const vinculos = await listarMeusProfissionais(user.id);
    setProfissionais(vinculos);
    setSubscriptionId((atual) => (atual && vinculos.some((v) => v.subscriptionId === atual) ? atual : vinculos.length === 1 ? vinculos[0].subscriptionId : null));
  }, [user?.id]);

  const carregarAcompanhamento = useCallback(async () => {
    if (!subscriptionId) {
      setPendente(null);
      setHistorico([]);
      setComparacao([]);
      return;
    }
    const [pend, hist, fotos] = await Promise.all([
      checkinPendente(subscriptionId),
      listarCheckinsDaAssinatura(subscriptionId),
      obterComparacaoFotos(subscriptionId),
    ]);
    setPendente(pend);
    setHistorico(hist);
    setComparacao(fotos);
  }, [subscriptionId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    carregarAcompanhamento();
  }, [carregarAcompanhamento]);

  const profissionalSelecionado = profissionais?.find((v) => v.subscriptionId === subscriptionId) ?? null;
  const pontuacoes = historicoPontuacao(historico);
  const adesao = resumoAdesao(historico);
  const streak = streakCheckin(historico);

  if (!user || profissionais === null || (subscriptionId !== null && pendente === null)) return <Loading />;

  if (resumo) {
    return (
      <CheckinResumo
        resumo={resumo}
        onFechar={() => {
          setResumo(null);
          setEmAndamento(false);
          carregarAcompanhamento();
        }}
      />
    );
  }

  if (emAndamento && profissionalSelecionado) {
    return (
      <CheckinFlow
        clientId={user.id}
        professionalId={profissionalSelecionado.professionalId}
        subscriptionId={profissionalSelecionado.subscriptionId}
        onConcluido={setResumo}
      />
    );
  }

  return (
    <Screen title="Check-in" subtitle="Acompanhamento periódico">
      {!profissionais.length ? (
        <EmptyState text="Você ainda não tem um profissional vinculado." />
      ) : !profissionalSelecionado ? (
        <Card>
          <SectionTitle>Para quem é este check-in?</SectionTitle>
          <Caption>Escolha o acompanhamento para manter suas respostas e evolução no lugar certo.</Caption>
          <View style={styles.profissionais}>
            {profissionais.map((profissional) => (
              <Pill
                key={profissional.subscriptionId}
                label={rotuloProfissional(profissional)}
                active={false}
                onPress={() => {
                  setPendente(null);
                  setSubscriptionId(profissional.subscriptionId);
                }}
              />
            ))}
          </View>
        </Card>
      ) : pendente ? (
        <Card>
          <SectionTitle>Check-in disponível</SectionTitle>
          <Caption>
            Para {rotuloProfissional(profissionalSelecionado)}. Leva poucos minutos e ajuda no seu acompanhamento.
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

      {profissionalSelecionado && profissionais.length > 1 ? (
        <View style={styles.profissionais}>
          {profissionais.map((profissional) => (
            <Pill
              key={profissional.subscriptionId}
              label={rotuloProfissional(profissional)}
              active={profissional.subscriptionId === profissionalSelecionado.subscriptionId}
              onPress={() => {
                setPendente(null);
                setSubscriptionId(profissional.subscriptionId);
              }}
            />
          ))}
        </View>
      ) : null}

      {profissionalSelecionado && (streak > 0 || pontuacoes.length >= 2 || adesao.length > 0) ? (
        <>
          <SectionTitle>Sua evolução</SectionTitle>
          {streak > 0 ? (
            <Card>
              <Stat
                value={String(streak)}
                label={streak === 1 ? 'check-in seguido' : 'check-ins seguidos'}
                color={Palette.accent}
              />
            </Card>
          ) : null}
          {pontuacoes.length >= 2 ? (
            <Card>
              <Caption>Pontuação geral</Caption>
              <Caption color={Palette.textTertiary}>
                {Math.round(pontuacoes[pontuacoes.length - 1].pontuacao)}% no último check-in
              </Caption>
              <Sparkline valores={pontuacoes.map((p) => p.pontuacao)} cor={Palette.accent} />
            </Card>
          ) : null}
          {adesao.length > 0 ? (
            <Card>
              <Caption>Adesão por categoria (últimos check-ins)</Caption>
              {adesao.map((a) => {
                const cor = a.mediaPontuacao >= 60 ? Palette.accent : Palette.vitalAlert;
                return (
                  <View key={a.categoria} style={styles.adesaoLinha}>
                    <Caption color={Palette.text}>
                      {a.categoria} — {a.rotulo} ({a.mediaPontuacao}%)
                    </Caption>
                    <BarraProgresso valor={a.mediaPontuacao} total={100} cor={cor} />
                  </View>
                );
              })}
            </Card>
          ) : null}
        </>
      ) : null}

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
  profissionais: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  linha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  adesaoLinha: {
    gap: Spacing.xs,
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

function rotuloProfissional(profissional: ProfissionalVinculado): string {
  const especialidade = profissional.especialidade === 'nutricionista' ? 'Nutrição' : 'Treino';
  return `${especialidade} · ${profissional.nome}`;
}
