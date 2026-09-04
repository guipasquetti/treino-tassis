import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, Card, Field, Pill, Screen, SectionTitle } from '@/components/ui';
import { SECOES_ANAMNESE, type RespostasAnamnese } from '@/models/anamnese';
import { listarMeusProfissionais, listarPlanos, type PlanoProfissional } from '@/services/professionalService';
import { submeterAnamneseEPlano } from '@/services/onboardingService';
import { useAuthStore } from '@/store/authStore';
import { Palette, Spacing } from '@/theme';

/**
 * Onboarding dentro do app (§12, 04/set): lead já criou conta e está logado, mas ainda não
 * respondeu a anamnese. `aluno/_layout.tsx` mostra isto no lugar das abas até isso acontecer.
 * O plano escolhido aqui é só um PEDIDO (`plano_solicitado_id`) — quem libera treino/dieta é
 * o profissional, confirmando depois de revisar (ver Painel).
 */
export function OnboardingAnamnese({ onConcluido }: { onConcluido: () => void }) {
  const user = useAuthStore((s) => s.user);
  const [respostas, setRespostas] = useState<RespostasAnamnese>({});
  const [planos, setPlanos] = useState<PlanoProfissional[]>([]);
  const [planoId, setPlanoId] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregarPlanos = useCallback(async () => {
    if (!user) return;
    const profissionais = await listarMeusProfissionais(user.id);
    const professionalId = profissionais[0]?.professionalId;
    if (!professionalId) return;
    const todos = await listarPlanos(professionalId);
    setPlanos(todos.filter((p) => p.ativo));
  }, [user]);

  useEffect(() => {
    carregarPlanos();
  }, [carregarPlanos]);

  const atualizarResposta = useCallback((id: string, valor: string) => {
    setRespostas((atual) => ({ ...atual, [id]: valor }));
  }, []);

  async function enviar() {
    if (planos.length && !planoId) {
      setErro('Escolhe qual plano você quer contratar.');
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      const ok = await submeterAnamneseEPlano(respostas, planoId);
      if (!ok) {
        setErro('Não consegui enviar suas respostas. Tenta de novo.');
        return;
      }
      onConcluido();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui enviar suas respostas.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Screen title="Vamos te conhecer" subtitle="Antes de começar, responde a anamnese e escolhe seu plano">
      <Card>
        <Caption>
          Suas respostas são usadas só pelo profissional que te convidou, pra montar seu plano.
          Nenhum campo é obrigatório — responda o que fizer sentido.
        </Caption>
      </Card>

      {SECOES_ANAMNESE.map((secao) => (
        <Card key={secao.titulo}>
          <SectionTitle>{secao.titulo}</SectionTitle>
          {secao.campos.map((campo) => (
            <Field
              key={campo.id}
              label={campo.label}
              value={respostas[campo.id] ?? ''}
              onChangeText={(v) => atualizarResposta(campo.id, v)}
              placeholder={campo.placeholder}
              keyboardType={campo.tipo === 'numero' ? 'decimal-pad' : 'default'}
              multiline={campo.tipo === 'area'}
            />
          ))}
        </Card>
      ))}

      <Card>
        <SectionTitle>Qual plano você quer contratar?</SectionTitle>
        {planos.length ? (
          <View style={styles.planos}>
            {planos.map((plano) => (
              <Pill
                key={plano.id}
                label={plano.nome}
                active={planoId === plano.id}
                onPress={() => setPlanoId((atual) => (atual === plano.id ? null : plano.id))}
              />
            ))}
          </View>
        ) : (
          <Caption>Seu profissional ainda não tem planos ativos — fala direto com ele.</Caption>
        )}
      </Card>

      {erro ? <Caption color={Palette.danger}>{erro}</Caption> : null}
      <Button label="Enviar respostas" onPress={enviar} loading={enviando} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  planos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
});
