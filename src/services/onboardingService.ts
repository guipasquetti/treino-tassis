import { supabase } from '@/lib/supabase';
import type { RespostasAnamnese } from '@/models/anamnese';

/** Se já existe anamnese pra este cliente — gate de onboarding em `aluno/_layout.tsx`. */
export async function possuiAnamnese(clientId: string): Promise<boolean> {
  const { data } = await supabase
    .from('anamnese')
    .select('client_id')
    .eq('client_id', clientId)
    .maybeSingle();
  return !!data;
}

/**
 * Paciente autenticado grava a própria anamnese e o plano que quer comprar, num passo só,
 * dentro do app (§12, 04/set). RLS não deixa o paciente escrever direto em `anamnese` nem
 * `subscriptions` — por isso sai por RPC `security definer`, escopada em `auth.uid()`.
 * `planoId` vira `subscriptions.plano_solicitado_id` (pedido do paciente) — quem confirma de
 * verdade (`plan_id`, o que libera treino/dieta) é o profissional, depois de revisar.
 */
export async function submeterAnamneseEPlano(
  respostas: RespostasAnamnese,
  planoId: string | null
): Promise<boolean> {
  const { data, error } = await supabase.rpc('submeter_anamnese_autenticado', {
    p_respostas: respostas,
    p_plano_id: planoId ?? undefined,
  });
  if (error) throw error;
  return data === true;
}
