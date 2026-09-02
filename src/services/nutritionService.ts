import { supabase } from '@/lib/supabase';
import type { Refeicao } from '@/models/domain';
import type { Tables } from '@/models/database.types';

export type PlanoAlimentar = Omit<Tables<'planos_alimentares'>, 'refeicoes'> & {
  refeicoes: Refeicao[];
};

export async function getPlanoAlimentar(clientId: string): Promise<PlanoAlimentar | null> {
  const { data } = await supabase
    .from('planos_alimentares')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle();

  if (!data) return null;
  return { ...data, refeicoes: (data.refeicoes ?? []) as Refeicao[] };
}

export type AlimentoTaco = Tables<'alimentos_taco'>;

/** Busca na tabela TACO por nome. Usado pelo profissional ao montar a dieta. */
export async function buscarAlimentos(termo: string, limite = 20): Promise<AlimentoTaco[]> {
  const busca = termo.trim();
  if (!busca) return [];
  const { data } = await supabase
    .from('alimentos_taco')
    .select('*')
    .ilike('nome', `%${busca}%`)
    .limit(limite);
  return data ?? [];
}
