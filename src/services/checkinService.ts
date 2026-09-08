import { supabase } from '@/lib/supabase';
import { calcularResumo, type RespostasCheckin, type ResumoCheckin } from '@/models/checkin';
import type { Tables } from '@/models/database.types';

export type CheckIn = Tables<'check_ins'>;

const PERIODICIDADE_DIAS = 14;

/** Envia um check-in — série temporal, nunca sobrescrita (§14: cada envio é uma linha nova). */
export async function submeterCheckin(
  clientId: string,
  professionalId: string,
  respostas: RespostasCheckin,
  fotos: { esquerdo?: string; direito?: string; costas?: string },
): Promise<ResumoCheckin> {
  const resumo = calcularResumo(respostas);
  const { error } = await supabase.from('check_ins').insert({
    client_id: clientId,
    professional_id: professionalId,
    respostas,
    pontuacao_geral: resumo.pontuacaoGeral,
    pontuacao_categorias: Object.fromEntries(
      resumo.categorias.map((c) => [c.categoria, { valor: c.pontuacao, rotulo: c.rotulo }]),
    ),
    foto_perfil_esquerdo_path: fotos.esquerdo ?? null,
    foto_perfil_direito_path: fotos.direito ?? null,
    foto_costas_path: fotos.costas ?? null,
  });
  if (error) throw error;
  return resumo;
}

/** Envia uma foto do check-in pro bucket privado — caminho sempre prefixado pelo próprio uid. */
export async function uploadFotoCheckin(
  clientId: string,
  tipo: 'esquerdo' | 'direito' | 'costas',
  arquivo: { uri: string; name: string },
): Promise<string> {
  const extensao = arquivo.name.includes('.') ? arquivo.name.split('.').pop() : 'jpg';
  const caminho = `${clientId}/${Date.now()}-${tipo}.${extensao}`;
  const resposta = await fetch(arquivo.uri);
  const blob = await resposta.blob();
  const { error } = await supabase.storage
    .from('fotos-checkin')
    .upload(caminho, blob, { contentType: blob.type || undefined });
  if (error) throw error;
  return caminho;
}

/** Link temporário (1h) pra abrir uma foto do bucket privado. */
export async function obterUrlFotoCheckin(caminho: string): Promise<string | null> {
  const { data } = await supabase.storage.from('fotos-checkin').createSignedUrl(caminho, 3600);
  return data?.signedUrl ?? null;
}

/** Histórico do próprio paciente, mais recente primeiro. */
export async function listarMeusCheckins(clientId: string): Promise<CheckIn[]> {
  const { data } = await supabase
    .from('check_ins')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

/** Histórico de um paciente, visto pelo profissional (RLS já escopa por `is_professional_of`). */
export async function listarCheckinsDoAluno(clientId: string): Promise<CheckIn[]> {
  return listarMeusCheckins(clientId);
}

/** Se o paciente já pode enviar um novo check-in (nunca enviou, ou já passou a periodicidade). */
export async function checkinPendente(clientId: string): Promise<boolean> {
  const { data } = await supabase
    .from('check_ins')
    .select('created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return true;
  const diasDesde = (Date.now() - new Date(data.created_at).getTime()) / 86_400_000;
  return diasDesde >= PERIODICIDADE_DIAS;
}
