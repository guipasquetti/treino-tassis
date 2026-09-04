import { supabase } from '@/lib/supabase';

export type SolicitacaoProfissional = {
  token: string;
  profissionalNome: string;
  createdAt: string;
};

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
    createdAt: row.created_at,
  }));
}

/** Recusa o pedido — não cria assinatura nenhuma, só fecha o convite como recusado. */
export async function recusarConvite(token: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('recusar_convite', { p_token: token });
  if (error) throw error;
  return data === true;
}
