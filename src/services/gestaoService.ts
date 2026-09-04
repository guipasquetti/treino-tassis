import { supabase } from '@/lib/supabase';
import { listarAlunos, type AlunoVinculado } from '@/services/professionalService';
import { listarAgenda, type TeleconsultaComPaciente } from '@/services/teleconsultaService';

export type ResumoAluno = AlunoVinculado & {
  temPlanoTreino: boolean;
  temPlanoDieta: boolean;
  flagSaude: string | null;
};

export type PainelGestao = {
  totalAlunos: number;
  ativos: number;
  semPlano: number;
  semTreino7d: number;
  leadsPendentes: number;
  /** Pediu um plano no onboarding (§12) mas o profissional ainda não confirmou. */
  solicitacoesPendentes: number;
  /** Agenda completa (todos os status), ordenada por data — a tela decide o que mostrar. */
  agenda: TeleconsultaComPaciente[];
  alunos: ResumoAluno[];
};

function diasDesde(iso: string | null): number | null {
  if (!iso) return null;
  const hoje = new Date();
  const data = new Date(iso);
  return Math.round((hoje.getTime() - data.getTime()) / 86_400_000);
}

/**
 * Agrega dado que já existe em outras tabelas — não cria nenhuma tabela nova. Cada consulta
 * já é filtrada pela RLS existente (is_professional_of / professional_id = auth.uid()), então
 * isso só devolve o que o profissional já podia ver espalhado em outras telas.
 */
export async function obterPainelGestao(professionalId: string): Promise<PainelGestao> {
  const alunos = await listarAlunos(professionalId);
  const clientIds = alunos.map((a) => a.clientId);

  const [{ data: comTreino }, { data: comDieta }, { data: anamneses }, { data: convites }, agenda] =
    await Promise.all([
      supabase.from('plans').select('client_id').eq('professional_id', professionalId),
      supabase.from('planos_alimentares').select('client_id').eq('professional_id', professionalId),
      clientIds.length
        ? supabase
            .from('anamnese')
            .select('client_id, condicoes_medicas, lesoes_dores')
            .in('client_id', clientIds)
        : Promise.resolve({ data: [] as { client_id: string; condicoes_medicas: string; lesoes_dores: string }[] }),
      supabase
        .from('convites')
        .select('id')
        .eq('created_by', professionalId)
        .eq('status', 'pendente'),
      listarAgenda(professionalId),
    ]);

  const treinoSet = new Set((comTreino ?? []).map((p) => p.client_id));
  const dietaSet = new Set((comDieta ?? []).map((p) => p.client_id));
  const anamnesePorCliente = new Map((anamneses ?? []).map((a) => [a.client_id, a]));

  const resumos: ResumoAluno[] = alunos.map((aluno) => {
    const anamnese = anamnesePorCliente.get(aluno.clientId);
    const sinaisSaude = [anamnese?.condicoes_medicas, anamnese?.lesoes_dores]
      .filter((v) => v && v.trim() && v.trim().toLowerCase() !== 'não')
      .join(' · ');
    return {
      ...aluno,
      temPlanoTreino: treinoSet.has(aluno.clientId),
      temPlanoDieta: dietaSet.has(aluno.clientId),
      flagSaude: sinaisSaude || null,
    };
  });

  return {
    totalAlunos: alunos.length,
    ativos: alunos.filter((a) => a.status === 'ativa').length,
    semPlano: resumos.filter((a) => !a.temPlanoTreino && !a.temPlanoDieta).length,
    semTreino7d: alunos.filter((a) => {
      const dias = diasDesde(a.ultimoTreino);
      return dias === null || dias > 7;
    }).length,
    leadsPendentes: convites?.length ?? 0,
    solicitacoesPendentes: resumos.filter((a) => !a.planoNome && a.planoSolicitadoId).length,
    agenda,
    alunos: resumos,
  };
}
