import { supabase } from '@/lib/supabase';
import { macrosPorGramas, type ItemRefeicao, type Refeicao } from '@/models/domain';
import type { AlimentoTaco } from '@/services/nutritionService';

/**
 * Edição do plano alimentar pelo profissional.
 *
 * ⚠️ Formato dos itens: os macros gravados são **absolutos** (já na quantidade do item),
 * não por 100g. É o formato que já existe em produção e que a tela do aluno lê. O editor
 * preserva `substituicoes` e `obs` dos itens existentes — a dieta real do Tassis tem
 * substituições com observações escritas à mão, e perdê-las seria destruir trabalho dele.
 */

export type PlanoAlimentarEditavel = {
  periodo: string;
  nutricionista: string;
  meta_kcal: string;
  meta_proteina_g: string;
  meta_carboidrato_g: string;
  meta_gordura_g: string;
  observacoes: string;
  refeicoes: Refeicao[];
};

export function novoItem(): ItemRefeicao {
  return { nome: '', quantidade: '', macros: null, substituicoes: [] };
}

export function novaRefeicao(): Refeicao {
  return { nome: '', itens: [novoItem()] };
}

/** Monta um item a partir de um alimento da TACO numa dada gramagem. */
export function itemDeTaco(alimento: AlimentoTaco, gramas: number): ItemRefeicao {
  return {
    nome: alimento.nome,
    quantidade: `${gramas}g`,
    macros: macrosPorGramas(alimento, gramas),
    substituicoes: [],
    taco_id: alimento.id,
    quantidade_g: gramas,
  };
}

/**
 * Recalcula os macros de um item quando a gramagem muda — só possível se o item veio da
 * TACO (tem `taco_id`). Item livre mantém os macros que o profissional digitou.
 */
export function recalcularPorGramas(
  item: ItemRefeicao,
  gramas: number,
  alimento: AlimentoTaco | undefined,
): ItemRefeicao {
  if (!alimento) return { ...item, quantidade: `${gramas}g`, quantidade_g: gramas };
  return {
    ...item,
    quantidade: `${gramas}g`,
    quantidade_g: gramas,
    macros: macrosPorGramas(alimento, gramas),
  };
}

function numeroOuNulo(v: string): number | null {
  const limpo = v.trim().replace(',', '.');
  if (!limpo) return null;
  const n = Number(limpo);
  return Number.isNaN(n) ? null : n;
}

export function planoAlimentarParaEdicao(
  plano: {
    periodo: string;
    nutricionista: string;
    meta_kcal: number | null;
    meta_proteina_g: number | null;
    meta_carboidrato_g: number | null;
    meta_gordura_g: number | null;
    observacoes: string;
    refeicoes: Refeicao[];
  } | null,
  nomeProfissional: string,
): PlanoAlimentarEditavel {
  if (!plano) {
    return {
      periodo: '',
      nutricionista: nomeProfissional,
      meta_kcal: '',
      meta_proteina_g: '',
      meta_carboidrato_g: '',
      meta_gordura_g: '',
      observacoes: '',
      refeicoes: [novaRefeicao()],
    };
  }
  return {
    periodo: plano.periodo ?? '',
    nutricionista: plano.nutricionista || nomeProfissional,
    meta_kcal: plano.meta_kcal?.toString() ?? '',
    meta_proteina_g: plano.meta_proteina_g?.toString() ?? '',
    meta_carboidrato_g: plano.meta_carboidrato_g?.toString() ?? '',
    meta_gordura_g: plano.meta_gordura_g?.toString() ?? '',
    observacoes: plano.observacoes ?? '',
    refeicoes: plano.refeicoes.length ? plano.refeicoes : [novaRefeicao()],
  };
}

export async function salvarPlanoAlimentar(
  clientId: string,
  professionalId: string,
  plano: PlanoAlimentarEditavel,
): Promise<void> {
  const refeicoes = plano.refeicoes.map((r) => ({
    ...r,
    nome: r.nome.trim() || 'Refeição',
    // Preserva todo o resto do item (substituicoes, obs, taco_id) — só normaliza texto.
    itens: r.itens.map((i) => ({ ...i, nome: i.nome.trim(), quantidade: i.quantidade.trim() })),
  }));

  const { error } = await supabase.from('planos_alimentares').upsert(
    {
      client_id: clientId,
      professional_id: professionalId,
      periodo: plano.periodo.trim(),
      nutricionista: plano.nutricionista.trim(),
      meta_kcal: numeroOuNulo(plano.meta_kcal),
      meta_proteina_g: numeroOuNulo(plano.meta_proteina_g),
      meta_carboidrato_g: numeroOuNulo(plano.meta_carboidrato_g),
      meta_gordura_g: numeroOuNulo(plano.meta_gordura_g),
      observacoes: plano.observacoes.trim(),
      refeicoes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'client_id' },
  );
  if (error) throw error;
}
