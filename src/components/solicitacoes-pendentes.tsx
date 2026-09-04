import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Card, Screen, SectionTitle } from '@/components/ui';
import { formatarDataHora } from '@/models/domain';
import { finalizarCadastroConvite } from '@/services/conviteService';
import { recusarConvite, type SolicitacaoProfissional } from '@/services/solicitacoesService';
import { Palette, Spacing } from '@/theme';

/**
 * Aparece quando alguém que JÁ tem conta recebe um convite de um profissional novo (§12,
 * 04/set). Sem senha, sem código — a pessoa já está logada normalmente; só decide aceitar ou
 * recusar. Aceitar cria a assinatura (`finalizar_cadastro_convite`, mesma RPC de sempre);
 * recusar só fecha o convite.
 */
export function SolicitacoesPendentes({
  solicitacoes,
  onMudou,
}: {
  solicitacoes: SolicitacaoProfissional[];
  onMudou: () => void;
}) {
  return (
    <Screen title="Pedido de acesso" subtitle="Alguém quer te acompanhar">
      {solicitacoes.map((s) => (
        <SolicitacaoCard key={s.token} solicitacao={s} onMudou={onMudou} />
      ))}
    </Screen>
  );
}

function SolicitacaoCard({
  solicitacao,
  onMudou,
}: {
  solicitacao: SolicitacaoProfissional;
  onMudou: () => void;
}) {
  const [processando, setProcessando] = useState<'aceitar' | 'recusar' | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function aceitar() {
    setProcessando('aceitar');
    setErro(null);
    try {
      const ok = await finalizarCadastroConvite(solicitacao.token);
      if (!ok) {
        setErro('Não consegui vincular. Tenta de novo ou fala com o profissional.');
        return;
      }
      onMudou();
    } finally {
      setProcessando(null);
    }
  }

  async function recusar() {
    setProcessando('recusar');
    setErro(null);
    try {
      await recusarConvite(solicitacao.token);
      onMudou();
    } finally {
      setProcessando(null);
    }
  }

  return (
    <Card>
      <SectionTitle>{solicitacao.profissionalNome}</SectionTitle>
      <Body>Quer te acompanhar como profissional.</Body>
      <Caption>Pedido em {formatarDataHora(solicitacao.createdAt)}</Caption>
      {erro ? <Caption color={Palette.danger}>{erro}</Caption> : null}
      <View style={styles.acoes}>
        <Button label="Aceitar" onPress={aceitar} loading={processando === 'aceitar'} disabled={!!processando} />
        <Button
          label="Recusar"
          variant="ghost"
          color={Palette.danger}
          onPress={recusar}
          loading={processando === 'recusar'}
          disabled={!!processando}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  acoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
});
