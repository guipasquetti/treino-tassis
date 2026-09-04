import { supabase } from '@/lib/supabase';
import type { Tables, TablesInsert, TablesUpdate } from '@/models/database.types';

export type Lead = Tables<'leads'>;
export type Atendimento = Tables<'atendimentos'>;

/** Leads do profissional — passo 1 do funil (HANDOFF §12), antes de qualquer convite/conta. */
export async function listarLeads(professionalId: string): Promise<Lead[]> {
  const { data } = await supabase
    .from('leads')
    .select('*')
    .eq('professional_id', professionalId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function criarLead(lead: TablesInsert<'leads'>): Promise<Lead> {
  const { data, error } = await supabase.from('leads').insert(lead).select('*').single();
  if (error) throw error;
  return data;
}

export async function atualizarLead(leadId: string, updates: TablesUpdate<'leads'>): Promise<void> {
  const { error } = await supabase
    .from('leads')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', leadId);
  if (error) throw error;
}

/** Vincula o convite gerado a partir de um lead — não é crítico (o RPC que fecha o cadastro
 * já lê `convites.lead_id`); serve só pra tela mostrar "convite já gerado" nesse lead. */
export async function vincularConviteAoLead(leadId: string, conviteId: string): Promise<void> {
  await supabase.from('leads').update({ convite_id: conviteId }).eq('id', leadId);
}

export async function listarAtendimentosDoLead(leadId: string): Promise<Atendimento[]> {
  const { data } = await supabase
    .from('atendimentos')
    .select('*')
    .eq('lead_id', leadId)
    .order('data_atendimento', { ascending: false });
  return data ?? [];
}

export async function criarAtendimento(atendimento: TablesInsert<'atendimentos'>): Promise<void> {
  const { error } = await supabase.from('atendimentos').insert(atendimento);
  if (error) throw error;
}
