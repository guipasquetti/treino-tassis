import { supabase } from '@/lib/supabase';
import type { RespostasAnamnese } from '@/models/anamnese';

export type ConviteInfo = {
  nome: string;
  email: string;
  status: string;
  /** Link de pagamento colado pelo profissional (Asaas/Pix/etc.) — nunca dado de cartão. */
  linkPagamento: string | null;
  /** Plano decidido na call de sensibilização (§12) — null em convites antigos sem plano. */
  plano: {
    nome: string;
    precoCentavos: number | null;
    periodicidade: string;
    incluiTreino: boolean;
    incluiDieta: boolean;
  } | null;
};

/**
 * Lê nome/e-mail/status/plano/link de pagamento do convite pelo token. Chamada pública (sem
 * sessão) — a RPC é `security definer` e não confere `auth.uid()`; o token em si é o segredo.
 * Retorna `null` pra token inexistente (link inválido).
 */
export async function obterConvite(token: string): Promise<ConviteInfo | null> {
  const { data, error } = await supabase.rpc('obter_convite', { p_token: token });
  if (error || !data || data.length === 0) return null;
  const row = data[0];
  return {
    nome: row.nome,
    email: row.email,
    status: row.status,
    linkPagamento: row.link_pagamento,
    plano: row.plano_nome
      ? {
          nome: row.plano_nome,
          precoCentavos: row.plano_preco_centavos,
          periodicidade: row.plano_periodicidade,
          incluiTreino: row.plano_inclui_treino,
          incluiDieta: row.plano_inclui_dieta,
        }
      : null,
  };
}

/**
 * Grava as respostas da anamnese no convite (ainda sem conta — token é a única prova de
 * posse). Só grava se `status = 'pendente'`; reenvio com o mesmo token depois de já
 * enviado retorna `false` sem sobrescrever.
 */
export async function submeterAnamnese(token: string, respostas: RespostasAnamnese): Promise<boolean> {
  const { data, error } = await supabase.rpc('submeter_anamnese', {
    p_token: token,
    p_respostas: respostas,
  });
  if (error) throw error;
  return data === true;
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
