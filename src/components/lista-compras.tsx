import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Body, Caption, Card, Field, SectionTitle } from '@/components/ui';
import { listaDeCompras, type ItemListaCompras, type Refeicao } from '@/models/domain';
import { Palette, Radius, Spacing } from '@/theme';

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

/**
 * Seção de lista de compras, extraída de `aluno/dieta.tsx` (09/set) pra ser reaproveitada
 * também pela rota dedicada `aluno/lista-compras.tsx` — mesma lógica de checklist/projeção
 * nos dois lugares, sem duplicar o estado do checklist marcado.
 */
export function ListaComprasSection({
  userId,
  refeicoes,
  categorias,
  collapsible = false,
}: {
  userId: string;
  refeicoes: Refeicao[];
  categorias: Record<number, string>;
  /** Quando true, a lista some por trás do card de resumo até o aluno tocar nele — usado em
   * `aluno/dieta.tsx` pra não empurrar as refeições pra baixo da dobra. A rota dedicada
   * (`aluno/lista-compras.tsx`) mantém o padrão de sempre, sem essa prop. */
  collapsible?: boolean;
}) {
  const [diasPeriodo, setDiasPeriodo] = useState('30');
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [aberta, setAberta] = useState(!collapsible);

  useEffect(() => {
    AsyncStorage.getItem(chaveMarcados(userId)).then((salvo) => {
      if (!salvo) return;
      try {
        setMarcados(new Set(JSON.parse(salvo)));
      } catch {
        // storage corrompido ou de versão antiga — ignora, começa do zero
      }
    });
  }, [userId]);

  function alternarMarcado(chave: string) {
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      AsyncStorage.setItem(chaveMarcados(userId), JSON.stringify([...novo])).catch(() => {});
      return novo;
    });
  }

  const dias = Math.max(1, Number(diasPeriodo) || 30);
  const compras = listaDeCompras(refeicoes, dias, categorias);
  const totalItensCompra = compras.reduce((n, g) => n + g.itens.length, 0);
  const totalMarcado = compras.reduce(
    (n, g) => n + g.itens.filter((item) => marcados.has(`${g.categoria}::${item.nome}`)).length,
    0,
  );

  if (!compras.length) return null;

  return (
    <>
      <Card onPress={collapsible ? () => setAberta((a) => !a) : undefined}>
        <View style={styles.comprasHeader}>
          <View style={styles.comprasTitulo}>
            <SectionTitle>Lista de compras</SectionTitle>
            <Caption>
              {totalMarcado}/{totalItensCompra} comprados · {compras.length} categorias · projeção {dias} dia
              {dias === 1 ? '' : 's'}
            </Caption>
          </View>
          {aberta ? (
            <View style={styles.diasCampo}>
              <Field value={diasPeriodo} onChangeText={setDiasPeriodo} keyboardType="number-pad" placeholder="30" />
              <Caption>dias</Caption>
            </View>
          ) : null}
          {collapsible ? (
            <Ionicons
              name={aberta ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={Palette.textTertiary}
            />
          ) : null}
        </View>
        {aberta ? (
          <Caption color={Palette.textTertiary}>
            Arroz, feijão, massa e carne já convertidos de peso pronto pra peso cru de compra —
            estimativa por tabela padrão, confirme com seu nutricionista.
          </Caption>
        ) : null}
      </Card>

      {aberta &&
        compras.map((grupo) => {
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

const styles = StyleSheet.create({
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
