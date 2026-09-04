import { supabase } from '@/lib/supabase';
import type { Tables, TablesInsert, TablesUpdate } from '@/models/database.types';

export type PlanoProfissional = Tables<'professional_plans'>;

export type AlunoVinculado = {
  subscriptionId: string;
  clientId: string;
  nome: string;
  status: string;
  planoNome: string | null;
  /** Data da última série registrada, se houver. */
  ultimoTreino: string | null;
};

/** Alunos do profissional, com sinal de atividade recente (quem sumiu aparece sem data). */
export async function listarAlunos(professionalId: string): Promise<AlunoVinculado[]> {
  const { data: subs } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('professional_id', professionalId);

  const subscriptions = subs ?? [];
  if (!subscriptions.length) return [];

  const clientIds = subscriptions.map((s) => s.patient_id);
  const planIds = subscriptions.map((s) => s.plan_id).filter((id): id is string => !!id);

  const [{ data: perfis }, { data: planos }, { data: logs }] = await Promise.all([
    supabase.from('profiles').select('id, nome').in('id', clientIds),
    planIds.length
      ? supabase.from('professional_plans').select('id, nome').in('id', planIds)
      : Promise.resolve({ data: [] as Pick<PlanoProfissional, 'id' | 'nome'>[] }),
    supabase
      .from('workout_logs')
      .select('client_id, session_date')
      .in('client_id', clientIds)
      .order('session_date', { ascending: false }),
  ]);

  const ultimoPorCliente = new Map<string, string>();
  for (const log of logs ?? []) {
    if (!ultimoPorCliente.has(log.client_id)) ultimoPorCliente.set(log.client_id, log.session_date);
  }

  return subscriptions.map((sub) => ({
    subscriptionId: sub.id,
    clientId: sub.patient_id,
    nome: perfis?.find((p) => p.id === sub.patient_id)?.nome || 'Aluno',
    status: sub.status,
    planoNome: planos?.find((p) => p.id === sub.plan_id)?.nome ?? null,
    ultimoTreino: ultimoPorCliente.get(sub.patient_id) ?? null,
  }));
}

export type ProfissionalVinculado = {
  subscriptionId: string;
  professionalId: string;
  nome: string;
  especialidade: string;
  planoNome: string | null;
  status: string;
};

/** Profissionais que atendem este aluno — pode ser mais de um (relação N:N). */
export async function listarMeusProfissionais(clientId: string): Promise<ProfissionalVinculado[]> {
  const { data: subs } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('patient_id', clientId)
    .eq('status', 'ativa');

  const subscriptions = subs ?? [];
  if (!subscriptions.length) return [];

  const professionalIds = subscriptions.map((s) => s.professional_id);
  const planIds = subscriptions.map((s) => s.plan_id).filter((id): id is string => !!id);

  const [{ data: perfis }, { data: profissionais }, { data: planos }] = await Promise.all([
    supabase.from('profiles').select('id, nome').in('id', professionalIds),
    supabase.from('professionals').select('id, especialidade').in('id', professionalIds),
    planIds.length
      ? supabase.from('professional_plans').select('id, nome').in('id', planIds)
      : Promise.resolve({ data: [] as Pick<PlanoProfissional, 'id' | 'nome'>[] }),
  ]);

  return subscriptions.map((sub) => ({
    subscriptionId: sub.id,
    professionalId: sub.professional_id,
    nome: perfis?.find((p) => p.id === sub.professional_id)?.nome || 'Profissional',
    especialidade:
      profissionais?.find((p) => p.id === sub.professional_id)?.especialidade ?? '',
    planoNome: planos?.find((p) => p.id === sub.plan_id)?.nome ?? null,
    status: sub.status,
  }));
}

export async function listarPlanos(professionalId: string): Promise<PlanoProfissional[]> {
  const { data } = await supabase
    .from('professional_plans')
    .select('*')
    .eq('professional_id', professionalId)
    .order('created_at', { ascending: true });
  return data ?? [];
}

export async function criarPlano(plano: TablesInsert<'professional_plans'>): Promise<void> {
  const { error } = await supabase.from('professional_plans').insert(plano);
  if (error) throw error;
}

export async function alternarPlanoAtivo(planoId: string, ativo: boolean): Promise<void> {
  const { error } = await supabase
    .from('professional_plans')
    .update({ ativo })
    .eq('id', planoId);
  if (error) throw error;
}

export type ConviteCriado = { id: string; token: string };

/**
 * Cria o convite (nome/e-mail do futuro paciente + plano vendido) e devolve o token — o
 * banco gera o token (`gen_random_uuid()`, ver migração `20260904_convite_token_default`),
 * não o client. RLS confere que `created_by` é o próprio profissional autenticado.
 */
export async function criarConvite(params: {
  professionalId: string;
  nome: string;
  email: string;
  planId: string | null;
  /** Convite nascido de um lead (§12) — o RPC de fechamento usa isso pra marcar o lead como convertido. */
  leadId?: string | null;
  /**
   * Link de pagamento gerado fora do app (Asaas/Pix/etc.) — mesmo padrão de
   * `teleconsultas.link_meet`: o app nunca coleta dado de cartão, só guarda a URL.
   */
  linkPagamento?: string | null;
}): Promise<ConviteCriado> {
  const { data, error } = await supabase
    .from('convites')
    .insert({
      nome: params.nome,
      email: params.email,
      created_by: params.professionalId,
      plan_id: params.planId,
      lead_id: params.leadId ?? null,
      link_pagamento: params.linkPagamento?.trim() || null,
    })
    .select('id, token')
    .single();
  if (error) throw error;
  return data;
}

export async function atualizarPlano(
  planoId: string,
  updates: TablesUpdate<'professional_plans'>
): Promise<void> {
  const { error } = await supabase.from('professional_plans').update(updates).eq('id', planoId);
  if (error) throw error;
}
