import { supabase } from '@/lib/supabase';
import type { Tables, TablesInsert } from '@/models/database.types';

export type Teleconsulta = Tables<'teleconsultas'>;

export type TeleconsultaComPaciente = Teleconsulta & {
  pacienteNome: string;
};

/** Agenda do profissional, mais recente primeiro. Junta o nome do paciente em memória
 * (mesmo padrão de `listarAlunos` — o projeto não usa select aninhado do PostgREST). */
export async function listarAgenda(professionalId: string): Promise<TeleconsultaComPaciente[]> {
  const { data: consultas } = await supabase
    .from('teleconsultas')
    .select('*')
    .eq('professional_id', professionalId)
    .order('data_hora', { ascending: true });

  const lista = consultas ?? [];
  if (!lista.length) return [];

  const patientIds = [...new Set(lista.map((c) => c.patient_id))];
  const { data: perfis } = await supabase.from('profiles').select('id, nome').in('id', patientIds);

  return lista.map((c) => ({
    ...c,
    pacienteNome: perfis?.find((p) => p.id === c.patient_id)?.nome || 'Aluno',
  }));
}

/** Próxima teleconsulta agendada do paciente (visão dele mesmo). */
export async function proximaTeleconsulta(patientId: string): Promise<Teleconsulta | null> {
  const { data } = await supabase
    .from('teleconsultas')
    .select('*')
    .eq('patient_id', patientId)
    .eq('status', 'agendada')
    .gte('data_hora', new Date().toISOString())
    .order('data_hora', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function criarTeleconsulta(teleconsulta: TablesInsert<'teleconsultas'>): Promise<void> {
  const { error } = await supabase.from('teleconsultas').insert(teleconsulta);
  if (error) throw error;
}

export async function atualizarStatusTeleconsulta(
  id: string,
  status: 'realizada' | 'cancelada',
): Promise<void> {
  const { error } = await supabase.from('teleconsultas').update({ status }).eq('id', id);
  if (error) throw error;
}
