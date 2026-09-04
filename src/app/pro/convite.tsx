import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Body, Button, Caption, Card, EmptyState, Field, Pill, Screen, SectionTitle } from '@/components/ui';
import { criarConvite, listarPlanos, type PlanoProfissional } from '@/services/professionalService';
import { vincularConviteAoLead } from '@/services/leadsService';
import { useAuthStore } from '@/store/authStore';
import { Palette, Radius, Spacing, FontSize } from '@/theme';

/** Base pública do app — mesma origem no browser; fallback pra produção fora da web. */
function baseUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return 'https://app-treino.expo.app';
}

/**
 * Convite só nasce de um lead (decisão do Guilherme, 04/set): antes da call de sensibilização
 * não tem nome/e-mail/plano de verdade pra colocar aqui, e o lead não entenderia receber um
 * link "frio". `leadId` vem do card do lead em `pro/leads.tsx` — sem ele, a tela só orienta a
 * criar o lead primeiro, não deixa gerar convite às cegas.
 */
export default function ConviteScreen() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const params = useLocalSearchParams<{ leadId?: string; nome?: string; email?: string }>();
  const [planos, setPlanos] = useState<PlanoProfissional[]>([]);
  const [nome, setNome] = useState(params.nome ?? '');
  const [email, setEmail] = useState(params.email ?? '');
  const [planoId, setPlanoId] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  const carregarPlanos = useCallback(async () => {
    if (!user) return;
    const todos = await listarPlanos(user.id);
    setPlanos(todos.filter((p) => p.ativo));
  }, [user]);

  useEffect(() => {
    carregarPlanos();
  }, [carregarPlanos]);

  async function gerar() {
    if (!user || !params.leadId) return;
    if (!nome.trim() || !email.trim()) {
      setErro('Preenche nome e e-mail.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErro('E-mail parece inválido.');
      return;
    }
    if (planos.length && !planoId) {
      setErro('Escolhe o plano — foi decidido na call de sensibilização.');
      return;
    }
    setErro(null);
    setCriando(true);
    try {
      const convite = await criarConvite({
        professionalId: user.id,
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        planId: planoId,
        leadId: params.leadId,
      });
      await vincularConviteAoLead(params.leadId, convite.id);
      setLink(`${baseUrl()}/convite/${convite.token}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui gerar o convite.');
    } finally {
      setCriando(false);
    }
  }

  if (!params.leadId) {
    return (
      <Screen title="Convidar aluno">
        <EmptyState text="O convite parte de um lead — cria o lead e registra a call de sensibilização antes de gerar o link." />
        <Button label="Ir para Leads" onPress={() => router.push('/pro/leads')} />
      </Screen>
    );
  }

  if (link) {
    return (
      <Screen title="Convite gerado">
        <Card>
          <SectionTitle>Link do convite</SectionTitle>
          <Body>{nome}</Body>
          <Caption>{email}</Caption>
          <TextInput
            style={styles.linkInput}
            value={link}
            editable={false}
            selectTextOnFocus
            multiline
          />
          <Caption>Toque no link e copie — mande pelo WhatsApp de sempre.</Caption>
        </Card>
        <Button label="Voltar pros leads" onPress={() => router.push('/pro/leads')} />
      </Screen>
    );
  }

  return (
    <Screen title="Convidar aluno" subtitle="Gera o link de anamnese pra este lead">
      <Card>
        <Field label="Nome" value={nome} onChangeText={setNome} placeholder="Nome do paciente" />
        <Field
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          placeholder="email@paciente.com"
          keyboardType="default"
        />
      </Card>

      <Card>
        <SectionTitle>Plano vendido</SectionTitle>
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
          <Caption>Nenhum plano ativo — crie um em Planos antes de convidar.</Caption>
        )}
      </Card>

      {erro ? <Caption color={Palette.danger}>{erro}</Caption> : null}
      <Button label="Gerar convite" onPress={gerar} loading={criando} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  planos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  linkInput: {
    backgroundColor: Palette.surfaceElevated,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    color: Palette.accent,
    fontSize: FontSize.small,
  },
});
