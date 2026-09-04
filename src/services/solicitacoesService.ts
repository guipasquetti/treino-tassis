import { supabase } from '@/lib/supabase';

export type SolicitacaoProfissional = {
  token: string;
  profissionalNome: string;
  especialidade: string;
  createdAt: string;
};

/**
 * `professionals.especialidade` é texto livre (§5 do HANDOFF, sem enum ainda) — mapeia os
 * valores conhecidos pra rótulo legível; especialidade nova/futura aparece como veio, em vez
 * de sumir.
 */
export function rotuloEspecialidade(especialidade: string): string {
  const rotulos: Record<string, string> = {
    personal_trainer: 'Educador físico',
    nutricionista: 'Nutricionista',
  };
  return rotulos[especialidade] ?? especialidade;
}

/**
 * Convites pendentes endereçados ao e-mail do usuário autenticado — o caso de quem já tinha
 * conta (outro profissional, ou de antes) e um novo profissional quer atendê-lo (§12, 04/set).
 * Sem senha, sem código: a pessoa já está logada normalmente, só decide aceitar ou recusar.
 */
export async function listarSolicitacoesPendentes(): Promise<SolicitacaoProfissional[]> {
  const { data, error } = await supabase.rpc('obter_solicitacoes_pendentes');
  if (error || !data) return [];
  return data.map((row) => ({
    token: row.token,
    profissionalNome: row.profissional_nome,
    especialidade: row.especialidade,
    createdAt: row.created_at,
  }));
}

/** Recusa o pedido — não cria assinatura nenhuma, só fecha o convite como recusado. */
export async function recusarConvite(token: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('recusar_convite', { p_token: token });
  if (error) throw error;
  return data === true;
}
