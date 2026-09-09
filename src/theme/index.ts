/**
 * Design system da Vytra.
 *
 * Base estrutural: app Apple Fitness (referência escolhida em 02/set) — fundo quase preto,
 * cards elevados, cores saturadas por categoria, números grandes, cantos arredondados.
 * Base cromática: paleta "Sinal Vital" da marca Vytra (aprovada 08/set, aplicada 09/set) —
 * ver `docs/marca/BRAND.md`, que é a fonte canônica dos valores abaixo.
 *
 * As cores por tipo de treino (push/pull/leg) preservam o significado semântico que o
 * protótipo já usava — o Tassis e o aluno já associam essas cores aos dias de treino.
 */

/**
 * Cores da marca, exatamente como no brand book. Não usar direto na UI: a UI consome
 * `Palette`, que mapeia estes valores para papéis de interface. Estão exportadas porque
 * assets, splash e e-mails precisam do valor cru.
 */
export const Brand = {
  /** Base "Sinal Vital" — fundo de toda superfície da marca. */
  ink: '#0A0C0D',
  /** Sinal — o verde-menta do traço do mark. É o accent do produto. */
  mint: '#2ED9A3',
  /** Alerta âmbar — estado de atenção. Nunca é decoração. */
  amber: '#FFB020',
  /** Texto sobre a base. */
  paper: '#ECEFEE',
  paperMuted: '#9CA6A2',
} as const;

export const Palette = {
  /** Fundo da tela — base da marca. */
  background: Brand.ink,
  /** Card sobre o fundo. */
  surface: '#15181A',
  /** Elemento dentro de um card (input, chip inativo). */
  surfaceElevated: '#1D2123',
  /** Linha divisória. */
  border: '#262B2D',

  text: Brand.paper,
  textSecondary: Brand.paperMuted,
  textTertiary: '#6C7876',

  /** Accent principal da marca (era rosa `#FF375F` até o rebrand de 09/set). */
  accent: Brand.mint,
  /** Alerta da paleta Sinal Vital — estado de atenção, não é o accent. */
  vitalAlert: Brand.amber,
  /** Aliases legados mantidos para os módulos existentes consumirem só a paleta Vytra. */
  lime: Brand.mint,
  blue: Brand.mint,
  green: Brand.mint,
  purple: Brand.mint,
  orange: Brand.amber,
  yellow: Brand.amber,
  danger: '#FF453A',
} as const;

/** Cor por tipo de dia de treino. Mesma semântica do protótipo. */
export const TrainingColors = {
  // A diferença entre os dias fica no rótulo; a cor só sinaliza estado dentro da paleta Vytra.
  push: Palette.vitalAlert,
  pull: Palette.accent,
  leg: Palette.accent,
} as const;

export type TrainingType = keyof typeof TrainingColors;

export function trainingColor(tipo: string | null | undefined): string {
  return TrainingColors[tipo as TrainingType] ?? Palette.purple;
}

/**
 * O papel não muda a identidade visual: aluno e profissional compartilham o mesmo sinal Vytra.
 */
export const RoleColors = {
  aluno: Palette.accent,
  profissional: Palette.accent,
} as const;

export type Role = keyof typeof RoleColors;

/** Cor por macronutriente, usada nos totais da dieta. */
export const MacroColors = {
  kcal: Palette.accent,
  proteina: Palette.blue,
  carboidrato: Palette.orange,
  gordura: Palette.yellow,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const FontSize = {
  caption: 12,
  small: 14,
  body: 16,
  headline: 20,
  title: 28,
  display: 34,
  stat: 40,
} as const;

export { Fonts, headingStyle, monoStyle } from './fonts';
