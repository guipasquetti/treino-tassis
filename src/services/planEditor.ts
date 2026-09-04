import { supabase } from '@/lib/supabase';
import type { DiaTreino, Exercicio } from '@/models/domain';

/**
 * Edição do plano de treino pelo profissional.
 *
 * ⚠️ REGRA CENTRAL: `Exercicio.id` é a chave que liga o exercício ao histórico do aluno
 * (`workout_logs.exercise_id` / `workout_drafts.exercise_id`). Um id NUNCA pode ser
 * reatribuído a outro exercício — se isso acontecer, o histórico de carga do aluno passa
 * a apontar pro exercício errado, silenciosamente.
 *
 * O protótipo (`prototype/index.html`, `dadosDoBuilder`) regenera os ids por POSIÇÃO
 * (`a1`, `a2`… conforme o índice) toda vez que salva, então apagar ou reordenar um
 * exercício lá corrompe o histórico. Aqui os ids existentes são preservados e só os
 * exercícios novos ganham id — mantendo a mesma convenção legível (letra do dia + número).
 */

export type ExercicioEditavel = Exercicio & {
  /** Vazio enquanto o exercício ainda não foi salvo — recebe id na hora de gravar. */
  id: string;
};

export type DiaEditavel = Omit<DiaTreino, 'ex'> & { ex: ExercicioEditavel[] };

export type PlanoEditavel = {
  periodo: string;
  treinador: string;
  dias: DiaEditavel[];
};

export function novoExercicio(): ExercicioEditavel {
  return { id: '', nome: '', warm: '—', feeder: '—', sets: 2, min: 8, max: 12 };
}

export function novoDia(idsExistentes: string[]): DiaEditavel {
  return { id: proximoIdDeDia(idsExistentes), nome: '', tipo: 'push', desc: '', ex: [novoExercicio()] };
}

/** Próxima letra livre para um dia: A, B, C… pulando as já usadas. */
export function proximoIdDeDia(idsExistentes: string[]): string {
  const usados = new Set(idsExistentes);
  for (let i = 0; i < 26; i += 1) {
    const letra = String.fromCharCode(65 + i);
    if (!usados.has(letra)) return letra;
  }
  return `D${idsExistentes.length + 1}`;
}

/**
 * Gera um id para um exercício novo: letra do dia em minúscula + menor número livre,
 * conferindo contra TODOS os ids do plano (não só os do dia) pra nunca colidir.
 */
export function gerarIdDeExercicio(dia: DiaEditavel, idsEmUso: Set<string>): string {
  const prefixo = (dia.id[0] || 'x').toLowerCase();
  for (let n = 1; n < 1000; n += 1) {
    const candidato = `${prefixo}${n}`;
    if (!idsEmUso.has(candidato)) return candidato;
  }
  return `${prefixo}${Date.now()}`;
}

/** Coleta todos os ids de exercício já atribuídos no plano. */
export function idsEmUso(dias: DiaEditavel[]): Set<string> {
  const ids = new Set<string>();
  for (const dia of dias) {
    for (const ex of dia.ex) {
      if (ex.id) ids.add(ex.id);
    }
  }
  return ids;
}

/** Normaliza o plano pra gravação: preenche ids faltantes e limpa campos vazios. */
export function prepararParaSalvar(plano: PlanoEditavel): DiaTreino[] {
  const usados = idsEmUso(plano.dias);

  return plano.dias.map((dia, i) => ({
    id: dia.id || String.fromCharCode(65 + i),
    nome: dia.nome.trim() || `Dia ${i + 1}`,
    tipo: dia.tipo,
    desc: dia.desc.trim(),
    ex: dia.ex.map((ex, j) => {
      // Só exercício novo recebe id; os existentes mantêm o seu, preservando o histórico.
      let id = ex.id;
      if (!id) {
        id = gerarIdDeExercicio(dia, usados);
        usados.add(id);
      }

      const normalizado: Exercicio = {
        id,
        nome: ex.nome.trim() || `Exercício ${j + 1}`,
        warm: ex.warm.trim() || '—',
        feeder: ex.feeder.trim() || '—',
        sets: Number(ex.sets) || 1,
        min: Number(ex.min) || 1,
        max: Number(ex.max) || Number(ex.min) || 1,
      };
      if (ex.ombro) normalizado.ombro = true;
      if (ex.tempo) normalizado.tempo = true;
      if (ex.nota?.trim()) normalizado.nota = ex.nota.trim();
      if (ex.video?.trim()) normalizado.video = ex.video.trim();
      return normalizado;
    }),
  }));
}

/** Ids que sumiriam do plano — o histórico deles fica órfão. Usado pra avisar antes de salvar. */
export function idsRemovidos(original: DiaTreino[], editado: DiaEditavel[]): string[] {
  const antes = new Set(original.flatMap((d) => d.ex.map((e) => e.id)));
  const depois = idsEmUso(editado);
  return [...antes].filter((id) => !depois.has(id));
}

export function planoParaEdicao(dias: DiaTreino[], periodo: string, treinador: string): PlanoEditavel {
  if (!dias.length) {
    return { periodo, treinador, dias: [novoDia([])] };
  }
  return {
    periodo,
    treinador,
    dias: dias.map((d) => ({
      ...d,
      desc: d.desc ?? '',
      ex: d.ex.map((e) => ({ ...e, nota: e.nota ?? '', video: e.video ?? '' })),
    })),
  };
}

export async function salvarPlano(
  clientId: string,
  professionalId: string,
  plano: PlanoEditavel,
): Promise<void> {
  const dias = prepararParaSalvar(plano);
  const { error } = await supabase.from('plans').upsert(
    {
      client_id: clientId,
      professional_id: professionalId,
      periodo: plano.periodo.trim(),
      treinador: plano.treinador.trim(),
      dias,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'client_id' },
  );
  if (error) throw error;
}
