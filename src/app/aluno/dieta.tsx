import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Body, Caption, Card, EmptyState, Field, Loading, Screen, SectionTitle, Stat } from '@/components/ui';
import {
  avisoDaRefeicao,
  itensReais,
  listaDeCompras,
  somaMacros,
  totalConferidoPeloNutricionista,
  type ItemListaCompras,
  type ItemRefeicao,
  type Refeicao,
} from '@/models/domain';
import {
  buscarCategoriasPorIds,
  getPlanoAlimentar,
  type PlanoAlimentar,
} from '@/services/nutritionService';
import { temPlanoConfirmado } from '@/services/professionalService';
import { useAuthStore } from '@/store/authStore';
import { MacroColors, Palette, Radius, Spacing } from '@/theme';

/**
 * Ícone por categoria oficial da TACO — aproximação, o Ionicons não tem ícone dedicado pra
 * "cereais" ou "leguminosas". Prioriza cada categoria ficar visualmente distinta na lista,
 * não precisão literal. Um set de ícones customizado é trabalho de design separado, não
 * feito aqui.
 */
const ICONE_CATEGORIA: Record<string, keyof typeof Ionicons.glyphMap> = {
  'Alimentos preparados': 'restaurant-outline',
  'Bebidas (alcoólicas e não alcoólicas)': 'wine-outline',
  'Carnes e derivados': 'flame-outline',
  'Cereais e derivados': 'basket-outline',
  'Frutas e derivados': 'nutrition-outline',
  'Gorduras e óleos': 'water-outline',
  'Leguminosas e derivados': 'ellipse-outline',
  'Leite e derivados': 'cafe-outline',
  Miscelâneas: 'apps-outline',
  'Nozes e sementes': 'flower-outline',
  'Outros alimentos industrializados': 'cube-outline',
  'Ovos e derivados': 'egg-outline',
  'Pescados e frutos do mar': 'fish-outline',
  'Produtos açucarados': 'ice-cream-outline',
  'Verduras, hortaliças e derivados': 'leaf-outline',
};
const ICONE_PADRAO: keyof typeof Ionicons.glyphMap = 'pencil-outline';

/** Chave de armazenamento local — checklist é por aparelho, não sincroniza entre dispositivos. */
function chaveMarcados(userId: string): string {
  return `lista-compras-marcados:${userId}`;
}

export default function DietaScreen() {
  const user = useAuthStore((s) => s.user);
  const [plano, setPlano] = useState<PlanoAlimentar | null>(null);
  const [categorias, setCategorias] = useState<Record<number, string>>({});
  const [diasPeriodo, setDiasPeriodo] = useState('30');
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [liberado, setLiberado] = useState(true);
  const [loading, setLoading] = useState(true);

  function alternarMarcado(chave: string) {
    if (!user) return;
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      AsyncStorage.setItem(chaveMarcados(user.id), JSON.stringify([...novo])).catch(() => {});
      return novo;
    });
  }

  // Checklist "efetivamente marcado" precisa sobreviver a reload — guardado no aparelho, não
  // no banco (não é dado que o profissional precisa ver, não justifica tabela nova + RLS).
  useEffect(() => {
    if (!user) {
      setMarcados(new Set());
      return;
    }
    AsyncStorage.getItem(chaveMarcados(user.id)).then((salvo) => {
      if (!salvo) return;
      try {
        setMarcados(new Set(JSON.parse(salvo)));
      } catch {
        // storage corrompido ou de versão antiga — ignora, começa do zero
      }
    });
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    Promise.all([getPlanoAlimentar(user.id), temPlanoConfirmado(user.id)]).then(
      async ([resultado, confirmado]) => {
        setPlano(resultado);
        setLiberado(confirmado);
        if (resultado) {
          const idsTaco = [
            ...new Set(
              resultado.refeicoes.flatMap((r) => r.itens.map((i) => i.taco_id)).filter((id): id is number => id != null),
            ),
          ];
          setCategorias(await buscarCategoriasPorIds(idsTaco));
        }
        setLoading(false);
      }
    );
  }, [user?.id]);

  if (loading) return <Loading />;

  if (!liberado) {
    return (
      <Screen title="Dieta">
        <EmptyState text="Aguardando seu profissional confirmar o plano contratado pra liberar a dieta." />
      </Screen>
    );
  }

  if (!plano || !plano.publicado || !plano.refeicoes.length) {
    return (
      <Screen title="Dieta">
        <EmptyState text="Seu nutricionista está montando seu plano — fica pronto em até 2 dias." />
      </Screen>
    );
  }

  const totalDia = somaMacros(plano.refeicoes.flatMap((r) => itensReais(r.itens)));
  const dias = Math.max(1, Number(diasPeriodo) || 30);
  const compras = listaDeCompras(plano.refeicoes, dias, categorias);
  const totalItensCompra = compras.reduce((n, g) => n + g.itens.length, 0);
  const totalMarcado = compras.reduce(
    (n, g) => n + g.itens.filter((item) => marcados.has(`${g.categoria}::${item.nome}`)).length,
    0,
  );

  return (
    <Screen title="Dieta" subtitle={plano.nutricionista || undefined}>
      <Card>
        <SectionTitle>Total do dia</SectionTitle>
        <View style={styles.statRow}>
          <Stat
            value={String(Math.round(totalDia.kcal))}
            label={plano.meta_kcal ? `de ${Math.round(Number(plano.meta_kcal))} kcal` : 'kcal'}
            color={MacroColors.kcal}
          />
        </View>
        <View style={styles.macroRow}>
          <MacroChip
            label="Proteína"
            valor={totalDia.proteina_g}
            meta={plano.meta_proteina_g}
            cor={MacroColors.proteina}
          />
          <MacroChip
            label="Carbo"
            valor={totalDia.carboidrato_g}
            meta={plano.meta_carboidrato_g}
            cor={MacroColors.carboidrato}
          />
          <MacroChip
            label="Gordura"
            valor={totalDia.lipideos_g}
            meta={plano.meta_gordura_g}
            cor={MacroColors.gordura}
          />
        </View>
      </Card>

      {plano.refeicoes.map((refeicao, i) => (
        <RefeicaoCard key={i} refeicao={refeicao} />
      ))}

      {plano.observacoes ? (
        <Card>
          <SectionTitle>Observações</SectionTitle>
          <Caption>{plano.observacoes}</Caption>
        </Card>
      ) : null}

      {compras.length > 0 ? (
        <>
          <Card>
            <View style={styles.comprasHeader}>
              <View style={styles.comprasTitulo}>
                <SectionTitle>Lista de compras</SectionTitle>
                <Caption>
                  {totalMarcado}/{totalItensCompra} comprados · {compras.length} categorias · projeção {dias} dia
                  {dias === 1 ? '' : 's'}
                </Caption>
              </View>
              <View style={styles.diasCampo}>
                <Field
                  value={diasPeriodo}
                  onChangeText={setDiasPeriodo}
                  keyboardType="number-pad"
                  placeholder="30"
                />
                <Caption>dias</Caption>
              </View>
            </View>
            <Caption color={Palette.textTertiary}>
              Arroz, feijão, massa e carne já convertidos de peso pronto pra peso cru de
              compra — estimativa por tabela padrão, confirme com seu nutricionista.
            </Caption>
          </Card>

          {compras.map((grupo) => {
            const chaves = grupo.itens.map((item) => `${grupo.categoria}::${item.nome}`);
            const marcadosNaCategoria = chaves.filter((c) => marcados.has(c)).length;
            const completa = marcadosNaCategoria === chaves.length;
            return (
              <Card key={grupo.categoria} style={completa ? styles.categoriaCompleta : undefined}>
                <View style={styles.categoriaHeader}>
                  <View style={styles.categoriaIconeWrap}>
                    <Ionicons
                      name={ICONE_CATEGORIA[grupo.categoria] ?? ICONE_PADRAO}
                      size={16}
                      color={completa ? Palette.green : Palette.purple}
                    />
                  </View>
                  <Caption color={Palette.text} style={styles.categoriaTexto}>
                    {grupo.categoria}
                  </Caption>
                  <Caption color={completa ? Palette.green : Palette.textTertiary}>
                    {marcadosNaCategoria}/{chaves.length}
                  </Caption>
                </View>

                {grupo.itens.map((item, i) => (
                  <ItemCompraRow
                    key={chaves[i]}
                    item={item}
                    marcado={marcados.has(chaves[i])}
                    onToggle={() => alternarMarcado(chaves[i])}
                  />
                ))}
              </Card>
            );
          })}
        </>
      ) : null}
    </Screen>
  );
}

function MacroChip({
  label,
  valor,
  meta,
  cor,
}: {
  label: string;
  valor: number;
  meta: number | null;
  cor: string;
}) {
  return (
    <View style={styles.macroChip}>
      <Caption color={cor}>{label}</Caption>
      <Body>
        {Math.round(valor)}
        <Caption color={Palette.textTertiary}>{meta ? ` / ${Math.round(Number(meta))}g` : 'g'}</Caption>
      </Body>
    </View>
  );
}

function RefeicaoCard({ refeicao }: { refeicao: Refeicao }) {
  const itens = itensReais(refeicao.itens);
  const total = somaMacros(itens);
  const conferido = totalConferidoPeloNutricionista(refeicao.itens);
  const aviso = avisoDaRefeicao(refeicao.itens);

  return (
    <Card>
      <View style={styles.refeicaoHeader}>
        <Body>{refeicao.nome}</Body>
        <Caption color={MacroColors.kcal}>{Math.round(total.kcal)} kcal</Caption>
      </View>
      {itens.map((item, i) => (
        <ItemRow key={i} item={item} />
      ))}
      {conferido ? (
        <Caption color={Palette.green}>
          ✓ Total conferido pelo nutricionista: {Math.round(conferido.kcal)} kcal
        </Caption>
      ) : null}
      {aviso ? <Caption color={Palette.orange}>{aviso}</Caption> : null}
    </Card>
  );
}

function ItemCompraRow({
  item,
  marcado,
  onToggle,
}: {
  item: ItemListaCompras;
  marcado: boolean;
  onToggle: () => void;
}) {
  const cor = marcado ? Palette.textTertiary : Palette.text;
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [styles.compraLinha, pressed && styles.compraLinhaPressionada]}>
      <Ionicons
        name={marcado ? 'checkmark-circle' : 'ellipse-outline'}
        size={22}
        color={marcado ? Palette.green : Palette.textTertiary}
      />
      <View style={styles.compraTextos}>
        <Caption color={cor} style={marcado ? styles.riscado : undefined}>
          {item.nome}
        </Caption>
        {item.mediaPorPorcao ? <Caption color={Palette.textTertiary}>{item.mediaPorPorcao}</Caption> : null}
        {item.quantidadePronta ? (
          <Caption color={Palette.textTertiary}>{item.quantidadePronta} já pronto/cozido</Caption>
        ) : null}
        {item.substitutos ? (
          <Caption color={Palette.textTertiary}>Ou: {item.substitutos.join(', ')}</Caption>
        ) : null}
      </View>
      <Caption color={cor} style={styles.compraQuantidade}>
        {item.quantidade}
        {item.quantidadePronta ? ' cru' : ''}
      </Caption>
    </Pressable>
  );
}

function ItemRow({ item }: { item: ItemRefeicao }) {
  return (
    <View style={styles.item}>
      <View style={styles.itemHeader}>
        <Caption color={Palette.text}>{item.nome}</Caption>
        <Caption>{item.quantidade}</Caption>
      </View>

      {item.macros ? (
        <Caption color={Palette.textTertiary}>
          {Math.round(item.macros.kcal)} kcal · P {item.macros.proteina_g}g · C{' '}
          {item.macros.carboidrato_g}g · G {item.macros.lipideos_g}g
        </Caption>
      ) : (
        <Caption color={Palette.textTertiary}>Sem referência na TACO</Caption>
      )}

      {item.substituicoes.length > 0 ? (
        <View style={styles.subs}>
          {item.substituicoes.map((sub, i) => (
            <Caption key={i} color={Palette.textTertiary}>
              ↔ {sub.nome} — {sub.quantidade}
              {sub.macros ? ` (${Math.round(sub.macros.kcal)} kcal)` : ''}
            </Caption>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  macroChip: {
    flex: 1,
    backgroundColor: Palette.surfaceElevated,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 2,
  },
  refeicaoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  item: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.border,
    paddingTop: Spacing.sm,
    gap: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  subs: {
    paddingLeft: Spacing.md,
    gap: 2,
  },
  comprasHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  comprasTitulo: {
    flex: 1,
    gap: 2,
  },
  diasCampo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    width: 90,
  },
  categoriaCompleta: {
    opacity: 0.6,
  },
  categoriaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
    marginBottom: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.border,
  },
  categoriaIconeWrap: {
    width: 26,
    height: 26,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoriaTexto: {
    flex: 1,
    fontWeight: '700',
  },
  compraLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  compraLinhaPressionada: {
    opacity: 0.6,
  },
  compraTextos: {
    flex: 1,
    gap: 1,
  },
  compraQuantidade: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  riscado: {
    textDecorationLine: 'line-through',
  },
});
