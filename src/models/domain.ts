/**
 * Tipos dos campos jsonb do Supabase.
 *
 * Estas formas foram extraídas dos dados REAIS em produção (projeto `treino-tassis`),
 * não inventadas — o protótipo em `prototype/index.html` já grava nesse formato e está
 * em uso. Mudar qualquer uma delas quebra os dados existentes.
 */

/** Uma série registrada: peso e repetições. Em exercício por tempo, `r` são segundos. */
export type SetLog = {
  /** Peso em kg. */
  p: number;
  /** Repetições — ou segundos, quando `Exercicio.tempo` é true. */
  r: number;
};

export type Exercicio = {
  id: string;
  nome: string;
  /** Quantidade de séries "working". */
  sets: number;
  /** Repetições mínimas da faixa (ou segundos, se `tempo`). */
  min: number;
  /** Repetições máximas da faixa (ou segundos, se `tempo`). */
  max: number;
  /** Prescrição de aquecimento, ex.: "8-10 (2x)" ou "—". */
  warm: string;
  /** Prescrição de feeder sets, ex.: "4 reps (2x)" ou "—". */
  feeder: string;
  nota?: string;
  /** Exercício medido em tempo (prancha), não em repetições. */
  tempo?: boolean;
  /** Envolve ombro — usado pelo treinador como alerta de volume. */
  ombro?: boolean;
};

export type DiaTreino = {
  /** Letra do dia: "A", "B", "C"... */
  id: string;
  /** "Push", "Pull", "Leg". */
  nome: string;
  /** Grupos musculares, ex.: "Peito · Ombro · Tríceps". */
  desc: string;
  tipo: string;
  ex: Exercicio[];
};

export type Macros = {
  kcal: number;
  proteina_g: number;
  carboidrato_g: number;
  lipideos_g: number;
};

export type ItemSubstituicao = {
  nome: string;
  quantidade: string;
  macros: Macros | null;
  obs?: string;
};

export type ItemRefeicao = {
  nome: string;
  /** Texto livre, ex.: "2 fatias (50g)". */
  quantidade: string;
  /** Null quando o alimento não tem referência na TACO. Sempre ABSOLUTO (já na quantidade). */
  macros: Macros | null;
  obs?: string;
  substituicoes: ItemSubstituicao[];
  /**
   * Origem na tabela TACO, quando o item veio de lá. Campos opcionais adicionados pelo
   * editor do app — dados antigos não têm, e leitores devem ignorar se ausentes.
   * Servem pra recalcular os macros quando a gramagem muda.
   */
  taco_id?: number;
  quantidade_g?: number;
};

/** Escala os macros da TACO (que são por 100g) para a quantidade em gramas. */
export function macrosPorGramas(
  por100g: { kcal: number | null; proteina_g: number | null; carboidrato_g: number | null; lipideos_g: number | null },
  gramas: number,
): Macros {
  const f = gramas / 100;
  const arredondar = (v: number | null) => Math.round((v ?? 0) * f * 10) / 10;
  return {
    kcal: arredondar(por100g.kcal),
    proteina_g: arredondar(por100g.proteina_g),
    carboidrato_g: arredondar(por100g.carboidrato_g),
    lipideos_g: arredondar(por100g.lipideos_g),
  };
}

export type Refeicao = {
  nome: string;
  itens: ItemRefeicao[];
};

export function somaMacros(itens: { macros: Macros | null }[]): Macros {
  return itens.reduce<Macros>(
    (acc, item) => ({
      kcal: acc.kcal + (item.macros?.kcal ?? 0),
      proteina_g: acc.proteina_g + (item.macros?.proteina_g ?? 0),
      carboidrato_g: acc.carboidrato_g + (item.macros?.carboidrato_g ?? 0),
      lipideos_g: acc.lipideos_g + (item.macros?.lipideos_g ?? 0),
    }),
    { kcal: 0, proteina_g: 0, carboidrato_g: 0, lipideos_g: 0 },
  );
}

/** Data de hoje em ISO (YYYY-MM-DD), no fuso local — igual ao protótipo. */
export function hojeISO(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano.slice(2)}`;
}

/** "10/09 às 14:30" a partir de um timestamptz — usado na agenda de teleconsultas. */
export function formatarDataHora(iso: string): string {
  const d = new Date(iso);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const hora = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dia}/${mes} às ${hora}:${min}`;
}

/** "60kg × 12" ou "45s" para exercício por tempo. */
export function formatarSet(ex: Exercicio, set: SetLog): string {
  if (ex.tempo) return `${set.r}s`;
  return `${set.p}kg × ${set.r}`;
}
