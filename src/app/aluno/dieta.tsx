import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, Card, EmptyState, Loading, Screen, SectionTitle, Stat } from '@/components/ui';
import { ListaComprasSection } from '@/components/lista-compras';
import {
  avisoDaRefeicao,
  itensReais,
  somaMacros,
  totalConferidoPeloNutricionista,
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

export default function DietaScreen() {
  const user = useAuthStore((s) => s.user);
  const [plano, setPlano] = useState<PlanoAlimentar | null>(null);
  const [categorias, setCategorias] = useState<Record<number, string>>({});
  const [liberado, setLiberado] = useState(true);
  const [loading, setLoading] = useState(true);

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

  if (loading || !user) return <Loading />;

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

      <ListaComprasSection userId={user.id} refeicoes={plano.refeicoes} categorias={categorias} />
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
});
