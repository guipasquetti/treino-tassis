import { supabase } from '@/lib/supabase';

export type ConviteInfo = {
  nome: string;
  email: string;
  status: string;
  /**
   * Já existe conta com este e-mail (outro profissional, ou de antes) — decide se a tela
   * pública mostra "Entrar" ou "Criar conta". Não é busca aberta: só é revelado pra quem já
   * tem o token, sobre o único e-mail que ele já carrega (§12, 04/set).
   */
  contaExistente: boolean;
};

/**
 * Lê nome/e-mail/status/conta-existente do convite pelo token. Chamada pública (sem sessão)
 * — a RPC é `security definer` e não confere `auth.uid()`; o token em si é o segredo.
 * Retorna `null` pra token inexistente (link inválido).
 */
export async function obterConvite(token: string): Promise<ConviteInfo | null> {
  const { data, error } = await supabase.rpc('obter_convite', { p_token: token });
  if (error || !data || data.length === 0) return null;
  const row = data[0];
  return { nome: row.nome, email: row.email, status: row.status, contaExistente: row.conta_existe };
}

/**
 * Fecha o convite: cria a assinatura pra este profissional e marca o convite/lead como
 * concluído. Precisa rodar com sessão do usuário autenticado (a RPC confere que o e-mail da
 * sessão bate com o do convite) — funciona igual pra quem acabou de criar conta ou pra quem
 * já tinha uma e só entrou (§12, 04/set).
 */
export async function finalizarCadastroConvite(token: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('finalizar_cadastro_convite', { p_token: token });
  if (error) throw error;
  return data === true;
}
