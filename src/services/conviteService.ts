import { supabase } from '@/lib/supabase';

export type ConviteInfo = {
  nome: string;
  email: string;
  status: string;
};

/**
 * Lê nome/e-mail/status do convite pelo token. Chamada pública (sem sessão) — a RPC é
 * `security definer` e não confere `auth.uid()`; o token em si é o segredo. Retorna `null`
 * pra token inexistente (link inválido).
 */
export async function obterConvite(token: string): Promise<ConviteInfo | null> {
  const { data, error } = await supabase.rpc('obter_convite', { p_token: token });
  if (error || !data || data.length === 0) return null;
  return data[0];
}

/**
 * Fecha o convite: cria/atualiza profile e anamnese a partir das respostas salvas, cria a
 * assinatura, marca o convite como concluído. Precisa rodar com sessão do usuário recém
 * autenticado (a RPC confere que o e-mail da sessão bate com o do convite).
 */
export async function finalizarCadastroConvite(token: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('finalizar_cadastro_convite', { p_token: token });
  if (error) throw error;
  return data === true;
}
