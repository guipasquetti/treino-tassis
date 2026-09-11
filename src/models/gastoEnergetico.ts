/**
 * Cálculo de gasto energético — fórmulas fixas (Mifflin-St Jeor, Harris-Benedict, Cunningham),
 * mencionadas no kickoff do Tassis (HANDOFF.md §2). Puro cálculo determinístico: é o insumo
 * que a calculadora do editor de dieta (`pro/aluno/[id]/dieta.tsx`) usa pra sugerir metas de
 * macro — o profissional sempre revisa e pode ajustar antes de publicar, nunca é gravado sozinho.
 *
 * Também é o insumo que a futura fase de IA vai precisar respeitar: "toda sugestão baseada no
 * que o profissional seta, nas fórmulas presentes" (decisão do Guilherme).
 */

export type FormulaCalculo = 'mifflin_st_jeor' | 'harris_benedict' | 'cunningham';

export type Objetivo = 'deficit' | 'manutencao' | 'superavit';

export type DadosAntropometricos = {
  pesoKg: number;
  alturaCm: number;
  idade: number;
  sexo: 'feminino' | 'masculino' | 'outro';
  /** Obrigatório só para Cunningham. */
  percentualGordura?: number;
};

/**
 * Taxa Metabólica Basal, em kcal/dia. Retorna `null` quando faltam dados obrigatórios pra
 * fórmula escolhida (ex.: Cunningham sem `percentualGordura`) — a tela avisa, nunca calcula
 * com dado incompleto.
 */
export function calcularTMB(formula: FormulaCalculo, dados: DadosAntropometricos): number | null {
  const { pesoKg, alturaCm, idade, sexo, percentualGordura } = dados;
  if (!pesoKg || !alturaCm || !idade) return null;

  switch (formula) {
    case 'mifflin_st_jeor': {
      const base = 10 * pesoKg + 6.25 * alturaCm - 5 * idade;
      if (sexo === 'masculino') return base + 5;
      if (sexo === 'feminino') return base - 161;
      // "Outro": média dos dois ajustes, sem enviesar pra nenhum lado.
      return base - 78;
    }
    case 'harris_benedict': {
      if (sexo === 'masculino') return 66.5 + 13.75 * pesoKg + 5.003 * alturaCm - 6.755 * idade;
      if (sexo === 'feminino') return 655.1 + 9.563 * pesoKg + 1.850 * alturaCm - 4.676 * idade;
      const homem = 66.5 + 13.75 * pesoKg + 5.003 * alturaCm - 6.755 * idade;
      const mulher = 655.1 + 9.563 * pesoKg + 1.850 * alturaCm - 4.676 * idade;
      return (homem + mulher) / 2;
    }
    case 'cunningham': {
      if (percentualGordura == null) return null;
      const massaMagraKg = pesoKg * (1 - percentualGordura / 100);
      return 500 + 22 * massaMagraKg;
    }
  }
}

/** Gasto Energético Total, em kcal/dia — TMB × fator de atividade setado pelo profissional. */
export function calcularGET(tmb: number, fatorAtividade: number): number {
  return Math.round(tmb * fatorAtividade);
}

const AJUSTE_KCAL_POR_OBJETIVO: Record<Objetivo, number> = {
  deficit: -500,
  manutencao: 0,
  superavit: 300,
};

/**
 * Sugestão inicial de macro a partir do GET — ponto de partida editável, nunca publica
 * sozinho. Proteína em g/kg de peso corporal (padrão conservador, ajustável na tela); o
 * restante das calorias se divide em carboidrato/gordura numa proporção fixa simples.
 */
export function sugerirMacros(
  getKcal: number,
  objetivo: Objetivo,
  pesoKg: number,
  proteinaGPorKg = 2,
): { kcal: number; proteinaG: number; carboidratoG: number; lipideosG: number } {
  const kcalAlvo = Math.max(0, getKcal + AJUSTE_KCAL_POR_OBJETIVO[objetivo]);
  const proteinaG = Math.round(pesoKg * proteinaGPorKg);
  const kcalProteina = proteinaG * 4;
  const kcalRestante = Math.max(0, kcalAlvo - kcalProteina);
  // 55% do restante em carboidrato, 45% em gordura — proporção simples de partida.
  const lipideosG = Math.round((kcalRestante * 0.45) / 9);
  const carboidratoG = Math.round((kcalRestante * 0.55) / 4);
  return { kcal: Math.round(kcalAlvo), proteinaG, carboidratoG, lipideosG };
}

/** Idade em anos completos a partir de `profiles.data_nascimento` (ISO `AAAA-MM-DD`). */
export function idadeApartirDe(dataNascimentoISO: string): number {
  const nascimento = new Date(dataNascimentoISO);
  const hoje = new Date();
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const aindaNaoFezAniversario =
    hoje.getMonth() < nascimento.getMonth() ||
    (hoje.getMonth() === nascimento.getMonth() && hoje.getDate() < nascimento.getDate());
  if (aindaNaoFezAniversario) idade -= 1;
  return idade;
}
