import { supabase } from '@/lib/supabase';

export type StatusVerificacao = 'pendente' | 'aprovado' | 'rejeitado';

export type VerificacaoProfissional = {
  status: StatusVerificacao;
  motivoRejeicao: string | null;
  numeroRegistro: string;
  ufRegistro: string;
};

export type SolicitacaoVerificacaoAdmin = {
  id: string;
  professionalId: string;
  professionalNome: string;
  professionalEmail: string | null;
  especialidade: string;
  cpf: string | null;
  numeroRegistro: string;
  ufRegistro: string;
  documentoPath: string | null;
  bio: string | null;
  status: StatusVerificacao;
  createdAt: string;
};

/**
 * Envia a carteirinha do conselho pro bucket privado `documentos-profissionais`
 * (§0/LGPD, 04/set — primeiro uso de Storage no projeto). Caminho sempre prefixado pelo
 * próprio `auth.uid()` — é o que a RLS de `storage.objects` confere pra liberar o upload.
 */
export async function uploadDocumentoVerificacao(
  userId: string,
  arquivo: { uri: string; name: string }
): Promise<string> {
  const extensao = arquivo.name.includes('.') ? arquivo.name.split('.').pop() : 'pdf';
  const caminho = `${userId}/carteirinha.${extensao}`;
  const resposta = await fetch(arquivo.uri);
  const blob = await resposta.blob();
  const { error } = await supabase.storage
    .from('documentos-profissionais')
    .upload(caminho, blob, { upsert: true, contentType: blob.type || undefined });
  if (error) throw error;
  return caminho;
}

/** Cria conta de profissional + verificação pendente, tudo na RPC `cadastrar_profissional`. */
export async function cadastrarProfissional(params: {
  nome: string;
  especialidade: string;
  cpf: string;
  numeroRegistro: string;
  ufRegistro: string;
  documentoPath: string;
  bio?: string;
}): Promise<boolean> {
  const { data, error } = await supabase.rpc('cadastrar_profissional', {
    p_nome: params.nome,
    p_especialidade: params.especialidade,
    p_cpf: params.cpf,
    p_numero_registro: params.numeroRegistro,
    p_uf_registro: params.ufRegistro,
    p_documento_path: params.documentoPath,
    p_bio: params.bio,
  });
  if (error) throw error;
  return data === true;
}

/** Status da própria verificação — banner "pendente"/"rejeitado" no Painel (§12, 04/set). */
export async function obterMinhaVerificacao(professionalId: string): Promise<VerificacaoProfissional | null> {
  const { data } = await supabase
    .from('professional_verificacoes')
    .select('status, motivo_rejeicao, numero_registro, uf_registro')
    .eq('professional_id', professionalId)
    .maybeSingle();
  if (!data) return null;
  return {
    status: data.status as StatusVerificacao,
    motivoRejeicao: data.motivo_rejeicao,
    numeroRegistro: data.numero_registro,
    ufRegistro: data.uf_registro,
  };
}

/** Admin: fila de solicitações pendentes, com o mínimo pra decidir (nunca dado de saúde). */
export async function listarVerificacoesPendentes(): Promise<SolicitacaoVerificacaoAdmin[]> {
  const { data: verificacoes } = await supabase
    .from('professional_verificacoes')
    .select('*')
    .eq('status', 'pendente')
    .order('created_at', { ascending: true });

  const linhas = verificacoes ?? [];
  if (!linhas.length) return [];

  const ids = linhas.map((v) => v.professional_id);
  const [{ data: profissionais }, { data: perfis }] = await Promise.all([
    supabase.from('professionals').select('id, especialidade').in('id', ids),
    supabase.from('profiles').select('id, nome, email').in('id', ids),
  ]);

  return linhas.map((v) => ({
    id: v.id,
    professionalId: v.professional_id,
    professionalNome: perfis?.find((p) => p.id === v.professional_id)?.nome || 'Sem nome',
    professionalEmail: perfis?.find((p) => p.id === v.professional_id)?.email ?? null,
    especialidade: profissionais?.find((p) => p.id === v.professional_id)?.especialidade ?? '',
    cpf: v.cpf,
    numeroRegistro: v.numero_registro,
    ufRegistro: v.uf_registro,
    documentoPath: v.documento_path,
    bio: v.bio,
    status: v.status as StatusVerificacao,
    createdAt: v.created_at,
  }));
}

/** Admin: link temporário (1h) pra abrir o documento no bucket privado. */
export async function obterUrlDocumento(caminho: string): Promise<string | null> {
  const { data } = await supabase.storage
    .from('documentos-profissionais')
    .createSignedUrl(caminho, 3600);
  return data?.signedUrl ?? null;
}

export async function aprovarVerificacao(id: string, adminId: string): Promise<void> {
  const { error } = await supabase
    .from('professional_verificacoes')
    .update({ status: 'aprovado', reviewed_by: adminId, reviewed_at: new Date().toISOString(), motivo_rejeicao: null })
    .eq('id', id);
  if (error) throw error;
}

export async function rejeitarVerificacao(id: string, adminId: string, motivo: string): Promise<void> {
  const { error } = await supabase
    .from('professional_verificacoes')
    .update({ status: 'rejeitado', reviewed_by: adminId, reviewed_at: new Date().toISOString(), motivo_rejeicao: motivo })
    .eq('id', id);
  if (error) throw error;
}
