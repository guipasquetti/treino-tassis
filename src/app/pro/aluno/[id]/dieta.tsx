import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AlunoTabs } from '@/components/aluno-tabs';
import {
  Body,
  Button,
  Caption,
  Card,
  Field,
  Loading,
  RemoveButton,
  Screen,
  SectionTitle,
} from '@/components/ui';
import { somaMacros, type ItemRefeicao, type Refeicao } from '@/models/domain';
import { getProfile } from '@/services/authService';
import {
  itemDeTaco,
  novaRefeicao,
  novoItem,
  planoAlimentarParaEdicao,
  recalcularPorGramas,
  salvarPlanoAlimentar,
  type PlanoAlimentarEditavel,
} from '@/services/dietEditor';
import {
  buscarAlimentos,
  getAlimento,
  getPlanoAlimentar,
  type AlimentoTaco,
} from '@/services/nutritionService';
import { useAuthStore } from '@/store/authStore';
import { MacroColors, Palette, Radius, Spacing } from '@/theme';

export default function EditorDietaScreen() {
  const { id: clientId } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);

  const [nomeAluno, setNomeAluno] = useState('');
  const [plano, setPlano] = useState<PlanoAlimentarEditavel | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!clientId) return;
    const [perfil, atual] = await Promise.all([getProfile(clientId), getPlanoAlimentar(clientId)]);
    setNomeAluno(perfil?.nome || 'Aluno');
    setPlano(planoAlimentarParaEdicao(atual, profile?.nome || ''));
  }, [clientId, profile?.nome]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (!plano) return <Loading />;

  function atualizarRefeicao(indice: number, mudanca: Partial<Refeicao>) {
    setPlano((atual) =>
      atual
        ? {
            ...atual,
            refeicoes: atual.refeicoes.map((r, i) => (i === indice ? { ...r, ...mudanca } : r)),
          }
        : atual,
    );
  }

  function atualizarItem(refIndice: number, itemIndice: number, item: ItemRefeicao) {
    setPlano((atual) =>
      atual
        ? {
            ...atual,
            refeicoes: atual.refeicoes.map((r, i) =>
              i === refIndice
                ? { ...r, itens: r.itens.map((it, j) => (j === itemIndice ? item : it)) }
                : r,
            ),
          }
        : atual,
    );
  }

  async function salvar() {
    if (!user || !clientId || !plano) return;
    setErro(null);
    setMensagem(null);
    setSalvando(true);
    try {
      await salvarPlanoAlimentar(clientId, user.id, plano);
      setMensagem('Dieta salva.');
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui salvar a dieta.');
    } finally {
      setSalvando(false);
    }
  }

  const totalDia = somaMacros(plano.refeicoes.flatMap((r) => r.itens));

  return (
    <Screen title={nomeAluno} subtitle="Plano alimentar">
      <AlunoTabs clientId={clientId!} ativo="dieta" />

      <Card>
        <View style={styles.totalHeader}>
          <SectionTitle>Total montado</SectionTitle>
          <Caption color={MacroColors.kcal}>
            {Math.round(totalDia.kcal)}
            {plano.meta_kcal ? ` / ${plano.meta_kcal}` : ''} kcal
          </Caption>
        </View>
        <Caption>
          P {Math.round(totalDia.proteina_g)}g · C {Math.round(totalDia.carboidrato_g)}g · G{' '}
          {Math.round(totalDia.lipideos_g)}g
        </Caption>
      </Card>

      <Card>
        <Field
          label="Período"
          value={plano.periodo}
          onChangeText={(periodo) => setPlano({ ...plano, periodo })}
          placeholder="Ex.: Set/Out 2026"
        />
        <Field
          label="Nutricionista"
          value={plano.nutricionista}
          onChangeText={(nutricionista) => setPlano({ ...plano, nutricionista })}
        />
        <SectionTitle>Metas do dia</SectionTitle>
        <View style={styles.linha}>
          <Field
            label="kcal"
            value={plano.meta_kcal}
            keyboardType="decimal-pad"
            onChangeText={(meta_kcal) => setPlano({ ...plano, meta_kcal })}
          />
          <Field
            label="Proteína (g)"
            value={plano.meta_proteina_g}
            keyboardType="decimal-pad"
            onChangeText={(meta_proteina_g) => setPlano({ ...plano, meta_proteina_g })}
          />
        </View>
        <View style={styles.linha}>
          <Field
            label="Carbo (g)"
            value={plano.meta_carboidrato_g}
            keyboardType="decimal-pad"
            onChangeText={(meta_carboidrato_g) => setPlano({ ...plano, meta_carboidrato_g })}
          />
          <Field
            label="Gordura (g)"
            value={plano.meta_gordura_g}
            keyboardType="decimal-pad"
            onChangeText={(meta_gordura_g) => setPlano({ ...plano, meta_gordura_g })}
          />
        </View>
      </Card>

      {plano.refeicoes.map((refeicao, ri) => (
        <RefeicaoCard
          key={ri}
          refeicao={refeicao}
          podeRemover={plano.refeicoes.length > 1}
          onMudar={(mudanca) => atualizarRefeicao(ri, mudanca)}
          onMudarItem={(ii, item) => atualizarItem(ri, ii, item)}
          onRemover={() =>
            setPlano({ ...plano, refeicoes: plano.refeicoes.filter((_, i) => i !== ri) })
          }
        />
      ))}

      <Button
        label="+ Refeição"
        variant="ghost"
        onPress={() => setPlano({ ...plano, refeicoes: [...plano.refeicoes, novaRefeicao()] })}
      />

      <Card>
        <Field
          label="Observações"
          value={plano.observacoes}
          onChangeText={(observacoes) => setPlano({ ...plano, observacoes })}
          placeholder="Orientações gerais"
        />
      </Card>

      {erro ? <Caption color={Palette.danger}>{erro}</Caption> : null}
      {mensagem ? <Caption color={Palette.green}>{mensagem}</Caption> : null}

      <Button label="Salvar dieta" color={Palette.purple} onPress={salvar} loading={salvando} />
    </Screen>
  );
}

function RefeicaoCard({
  refeicao,
  podeRemover,
  onMudar,
  onMudarItem,
  onRemover,
}: {
  refeicao: Refeicao;
  podeRemover: boolean;
  onMudar: (mudanca: Partial<Refeicao>) => void;
  onMudarItem: (indice: number, item: ItemRefeicao) => void;
  onRemover: () => void;
}) {
  const total = somaMacros(refeicao.itens);

  return (
    <Card>
      <View style={styles.refeicaoHeader}>
        <Field
          value={refeicao.nome}
          onChangeText={(nome) => onMudar({ nome })}
          placeholder="Nome da refeição"
        />
        <Caption color={MacroColors.kcal}>{Math.round(total.kcal)} kcal</Caption>
      </View>

      {refeicao.itens.map((item, ii) => (
        <ItemEditor
          key={ii}
          item={item}
          onMudar={(novo) => onMudarItem(ii, novo)}
          onRemover={() => onMudar({ itens: refeicao.itens.filter((_, i) => i !== ii) })}
        />
      ))}

      <BuscaTaco onEscolher={(item) => onMudar({ itens: [...refeicao.itens, item] })} />

      <Button
        label="+ Item sem TACO"
        variant="ghost"
        onPress={() => onMudar({ itens: [...refeicao.itens, novoItem()] })}
      />

      {podeRemover && <RemoveButton label="Remover refeição" onPress={onRemover} />}
    </Card>
  );
}

function ItemEditor({
  item,
  onMudar,
  onRemover,
}: {
  item: ItemRefeicao;
  onMudar: (item: ItemRefeicao) => void;
  onRemover: () => void;
}) {
  const [gramas, setGramas] = useState(item.quantidade_g ? String(item.quantidade_g) : '');
  const [recalculando, setRecalculando] = useState(false);

  async function aplicarGramas(valor: string) {
    setGramas(valor);
    const n = Number(valor);
    if (!item.taco_id || !n) return;
    setRecalculando(true);
    try {
      const alimento = await getAlimento(item.taco_id);
      onMudar(recalcularPorGramas(item, n, alimento ?? undefined));
    } finally {
      setRecalculando(false);
    }
  }

  return (
    <View style={styles.item}>
      <View style={styles.itemHeader}>
        <Caption color={Palette.textTertiary}>
          {item.taco_id ? 'TACO' : 'livre'}
          {item.substituicoes.length ? ` · ${item.substituicoes.length} substituição(ões)` : ''}
        </Caption>
        <RemoveButton label="✕" onPress={onRemover} />
      </View>

      <Field
        value={item.nome}
        onChangeText={(nome) => onMudar({ ...item, nome })}
        placeholder="Nome do alimento"
      />

      {item.taco_id ? (
        <Field
          label={recalculando ? 'Gramas (recalculando…)' : 'Gramas'}
          value={gramas}
          keyboardType="decimal-pad"
          onChangeText={aplicarGramas}
        />
      ) : (
        <Field
          label="Quantidade"
          value={item.quantidade}
          onChangeText={(quantidade) => onMudar({ ...item, quantidade })}
          placeholder="Ex.: 2 fatias (50g)"
        />
      )}

      {item.macros ? (
        <Caption color={Palette.textTertiary}>
          {Math.round(item.macros.kcal)} kcal · P {item.macros.proteina_g}g · C{' '}
          {item.macros.carboidrato_g}g · G {item.macros.lipideos_g}g
        </Caption>
      ) : (
        <Caption color={Palette.orange}>Sem macros — não entra no total do dia</Caption>
      )}

      {item.obs ? <Caption color={Palette.textTertiary}>{item.obs}</Caption> : null}
    </View>
  );
}

function BuscaTaco({ onEscolher }: { onEscolher: (item: ItemRefeicao) => void }) {
  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState<AlimentoTaco[]>([]);
  const [buscando, setBuscando] = useState(false);

  async function buscar() {
    setBuscando(true);
    try {
      setResultados(await buscarAlimentos(termo));
    } finally {
      setBuscando(false);
    }
  }

  return (
    <View style={styles.busca}>
      <View style={styles.linha}>
        <Field
          value={termo}
          onChangeText={setTermo}
          placeholder="Buscar alimento na TACO"
        />
        <Button label="Buscar" variant="ghost" onPress={buscar} loading={buscando} />
      </View>

      {resultados.map((alimento) => (
        <Card
          key={alimento.id}
          style={styles.resultado}
          onPress={() => {
            onEscolher(itemDeTaco(alimento, 100));
            setResultados([]);
            setTermo('');
          }}>
          <Body>{alimento.nome}</Body>
          <Caption>
            {Math.round(alimento.kcal ?? 0)} kcal/100g · P {alimento.proteina_g ?? 0}g · C{' '}
            {alimento.carboidrato_g ?? 0}g · G {alimento.lipideos_g ?? 0}g
          </Caption>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  totalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  linha: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'flex-end',
  },
  refeicaoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  item: {
    backgroundColor: Palette.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  busca: {
    gap: Spacing.sm,
  },
  resultado: {
    backgroundColor: Palette.surfaceElevated,
    padding: Spacing.md,
    gap: 2,
  },
});
