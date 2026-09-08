import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Card, Field, Loading, Screen, SectionTitle, StepperButton } from '@/components/ui';
import {
  perguntasVisiveis,
  type OpcaoCheckin,
  type PerguntaCheckin,
  type RespostasCheckin,
  type ResumoCheckin,
} from '@/models/checkin';
import { submeterCheckin, uploadFotoCheckin } from '@/services/checkinService';
import { Palette, Spacing } from '@/theme';

/**
 * Check-in recorrente — uma pergunta por cartão, contador de progresso, resposta em um
 * toque quando dá (§13: é o formato que faz o paciente terminar as 22 perguntas). Sempre
 * avança a partir da lista de perguntas VISÍVEIS recalculada com a resposta que acabou de
 * ser dada — não do índice antigo — porque responder `dias_alcool` pode esconder
 * `quantidade_alcool` no mesmo passo.
 */
export function CheckinFlow({
  clientId,
  professionalId,
  onConcluido,
}: {
  clientId: string;
  professionalId: string;
  onConcluido: (resumo: ResumoCheckin) => void;
}) {
  const [respostas, setRespostas] = useState<RespostasCheckin>({});
  const [indice, setIndice] = useState(0);
  const [mostrarDetalhe, setMostrarDetalhe] = useState(false);
  const [detalheTexto, setDetalheTexto] = useState('');
  const [confirmandoPular, setConfirmandoPular] = useState(false);
  const [escalaValor, setEscalaValor] = useState(0);
  const [textoValor, setTextoValor] = useState('');
  const [fotos, setFotos] = useState<{ esquerdo?: string; direito?: string; costas?: string }>({});
  const [enviandoFoto, setEnviandoFoto] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const visiveis = perguntasVisiveis(respostas);
  const pergunta = visiveis[indice];

  useEffect(() => {
    setMostrarDetalhe(false);
    setDetalheTexto('');
    setConfirmandoPular(false);
    setTextoValor('');
    setEscalaValor(pergunta?.escalaMin ?? 0);
  }, [pergunta?.id]);

  if (!pergunta) return <Loading />;

  async function finalizar(respostasFinais: RespostasCheckin) {
    setErro(null);
    setEnviando(true);
    try {
      const resumo = await submeterCheckin(clientId, professionalId, respostasFinais, fotos);
      onConcluido(resumo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui enviar seu check-in.');
      setEnviando(false);
    }
  }

  function commit(novasRespostas: RespostasCheckin) {
    setRespostas(novasRespostas);
    const novasVisiveis = perguntasVisiveis(novasRespostas);
    const posAtual = novasVisiveis.findIndex((p) => p.id === pergunta.id);
    const proximo = (posAtual < 0 ? indice : posAtual) + 1;
    if (proximo >= novasVisiveis.length) {
      finalizar(novasRespostas);
    } else {
      setIndice(proximo);
    }
  }

  function escolherOpcao(opcao: OpcaoCheckin) {
    const novas = { ...respostas, [pergunta.id]: opcao.valor };
    if (opcao.pedeDetalhe) {
      setRespostas(novas);
      setMostrarDetalhe(true);
      return;
    }
    commit(novas);
  }

  function confirmarDetalhe() {
    const novas = { ...respostas };
    if (detalheTexto.trim()) novas[`${pergunta.id}_detalhe`] = detalheTexto.trim();
    commit(novas);
  }

  function confirmarEscala() {
    commit({ ...respostas, [pergunta.id]: String(escalaValor) });
  }

  function confirmarTexto() {
    const novas = { ...respostas };
    if (textoValor.trim()) novas[pergunta.id] = textoValor.trim();
    commit(novas);
  }

  function pular() {
    commit({ ...respostas });
  }

  async function escolherFoto(tipo: 'esquerdo' | 'direito' | 'costas') {
    const resultado = await DocumentPicker.getDocumentAsync({ type: 'image/*', copyToCacheDirectory: true });
    if (resultado.canceled || !resultado.assets?.[0]) return;
    const arquivo = resultado.assets[0];
    setEnviandoFoto(tipo);
    try {
      const caminho = await uploadFotoCheckin(clientId, tipo, { uri: arquivo.uri, name: arquivo.name });
      setFotos((atual) => ({ ...atual, [tipo]: caminho }));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui enviar a foto.');
    } finally {
      setEnviandoFoto(null);
    }
  }

  const progresso = `${indice + 1}/${visiveis.length}`;

  return (
    <Screen title="Check-in" subtitle={`${pergunta.categoria} · ${progresso}`}>
      <Card>
        <Body>{pergunta.texto}</Body>

        {mostrarDetalhe ? (
          <View style={styles.bloco}>
            <Field
              value={detalheTexto}
              onChangeText={setDetalheTexto}
              placeholder={
                pergunta.opcoes?.find((o) => o.valor === respostas[pergunta.id])?.pedeDetalhe
              }
              multiline
            />
            <Button label="Continuar" onPress={confirmarDetalhe} loading={enviando} />
          </View>
        ) : confirmandoPular ? (
          <View style={styles.bloco}>
            <Caption color={Palette.orange}>Você está prestes a pular esta pergunta.</Caption>
            <View style={styles.linha}>
              <Button
                label="Cancelar"
                variant="ghost"
                onPress={() => setConfirmandoPular(false)}
              />
              <Button label="Confirmar, pular" color={Palette.orange} onPress={pular} loading={enviando} />
            </View>
          </View>
        ) : (
          <View style={styles.bloco}>
            {(pergunta.tipo === 'ordinal' || pergunta.tipo === 'categorica') && (
              <View style={styles.opcoes}>
                {pergunta.opcoes?.map((opcao) => (
                  <Button
                    key={opcao.valor}
                    label={opcao.emoji ? `${opcao.emoji}  ${opcao.label}` : opcao.label}
                    variant="ghost"
                    onPress={() => escolherOpcao(opcao)}
                    disabled={enviando}
                  />
                ))}
              </View>
            )}

            {pergunta.tipo === 'escala' && (
              <View style={styles.escala}>
                <View style={styles.escalaRotulos}>
                  <Caption>{pergunta.escalaRotuloMin}</Caption>
                  <Caption>{pergunta.escalaRotuloMax}</Caption>
                </View>
                <View style={styles.stepperRow}>
                  <StepperButton
                    icon="remove"
                    onPress={() =>
                      setEscalaValor((v) => Math.max(pergunta.escalaMin ?? 0, v - 1))
                    }
                  />
                  <Body style={styles.escalaValor}>{escalaValor}</Body>
                  <StepperButton
                    icon="add"
                    onPress={() =>
                      setEscalaValor((v) => Math.min(pergunta.escalaMax ?? 10, v + 1))
                    }
                  />
                </View>
                <Button label="Continuar" onPress={confirmarEscala} loading={enviando} />
              </View>
            )}

            {pergunta.tipo === 'numero' && (
              <View style={styles.bloco}>
                <Field value={textoValor} onChangeText={setTextoValor} keyboardType="decimal-pad" placeholder="Ex.: 78,5" />
                <Button label="Continuar" onPress={confirmarTexto} loading={enviando} />
              </View>
            )}

            {pergunta.tipo === 'texto' && (
              <View style={styles.bloco}>
                <Field value={textoValor} onChangeText={setTextoValor} multiline placeholder="Opcional" />
                <Button label="Continuar" onPress={confirmarTexto} loading={enviando} />
              </View>
            )}

            {pergunta.tipo === 'foto' && (
              <View style={styles.bloco}>
                {(() => {
                  const tipo = pergunta.id.includes('esquerdo')
                    ? 'esquerdo'
                    : pergunta.id.includes('direito')
                      ? 'direito'
                      : 'costas';
                  return (
                    <>
                      <Button
                        label={fotos[tipo] ? 'Foto enviada — trocar' : 'Escolher foto'}
                        variant="ghost"
                        onPress={() => escolherFoto(tipo)}
                        loading={enviandoFoto === tipo}
                      />
                      <Button label="Continuar" onPress={() => commit({ ...respostas })} loading={enviando} />
                    </>
                  );
                })()}
              </View>
            )}
          </View>
        )}
      </Card>

      {erro ? <Caption color={Palette.danger}>{erro}</Caption> : null}

      {!mostrarDetalhe && !confirmandoPular && (
        <Button label="Pular pergunta" variant="ghost" color={Palette.textTertiary} onPress={() => setConfirmandoPular(true)} />
      )}
    </Screen>
  );
}

/** Tela de resumo mostrada assim que o check-in é enviado (§13: "devolutiva imediata"). */
export function CheckinResumo({ resumo, onFechar }: { resumo: ResumoCheckin; onFechar: () => void }) {
  return (
    <Screen title="Check-in enviado">
      <Card>
        <SectionTitle>Sua pontuação</SectionTitle>
        <Body style={styles.pontuacaoGrande}>
          {resumo.pontuacaoGeral !== null ? `${Math.round(resumo.pontuacaoGeral)}%` : '—'}
        </Body>
      </Card>

      {resumo.categorias.map((c) => (
        <Card key={c.categoria}>
          <View style={styles.resumoLinha}>
            <Caption color={Palette.text}>{c.categoria}</Caption>
            <Caption color={Palette.text}>{c.rotulo}</Caption>
          </View>
        </Card>
      ))}

      <Button label="Voltar" onPress={onFechar} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  bloco: { gap: Spacing.md },
  linha: { flexDirection: 'row', gap: Spacing.sm },
  opcoes: { gap: Spacing.sm },
  escala: { gap: Spacing.md },
  escalaRotulos: { flexDirection: 'row', justifyContent: 'space-between' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  escalaValor: { minWidth: 48, textAlign: 'center', fontVariant: ['tabular-nums'] },
  pontuacaoGrande: { fontSize: 40, fontWeight: '800', textAlign: 'center' },
  resumoLinha: { flexDirection: 'row', justifyContent: 'space-between' },
});
