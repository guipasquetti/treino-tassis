/**
 * Design system do App Treino.
 *
 * Identidade visual inspirada no app Apple Fitness (referência escolhida em 02/set):
 * fundo preto real, cards elevados em cinza, cores saturadas por categoria, números
 * grandes em destaque, cantos bem arredondados.
 *
 * As cores por tipo de treino (push/pull/leg) preservam o significado semântico que o
 * protótipo já usava — o Tassis e o aluno já associam essas cores aos dias de treino —
 * só foram deslocadas pra paleta mais saturada da referência.
 */

export const Palette = {
  /** Fundo da tela — preto real, como na referência. */
  background: '#000000',
  /** Card sobre o fundo. */
  surface: '#1C1C1E',
  /** Elemento dentro de um card (input, chip inativo). */
  surfaceElevated: '#2C2C2E',
  /** Linha divisória. */
  border: '#38383A',

  text: '#FFFFFF',
  textSecondary: '#98989F',
  textTertiary: '#636366',

  /** Accent principal da marca Vytra (paleta "Sinal Vital", aprovada 08/set) — antes rosa
   * `#FF375F` da referência Apple Fitness, trocado no rebrand de 09/set. */
  accent: '#2ED9A3',
  /** Alerta da paleta Sinal Vital — reservado pra estado de atenção, não é o accent. */
  vitalAlert: '#FFB020',
  /** Verde-limão dos ícones de exercício da referência. */
  lime: '#BFFF3C',
  blue: '#0A84FF',
  green: '#32D74B',
  purple: '#BF5AF2',
  orange: '#FF9F0A',
  yellow: '#FFD60A',
  danger: '#FF453A',
} as const;

/** Cor por tipo de dia de treino. Mesma semântica do protótipo. */
export const TrainingColors = {
  // `push` era Palette.accent (rosa) — fixado em laranja no rebrand de 09/set porque o
  // accent virou verde-menta, perto demais do verde já usado por `leg`.
  push: Palette.orange,
  pull: Palette.blue,
  leg: Palette.green,
} as const;

export type TrainingType = keyof typeof TrainingColors;

export function trainingColor(tipo: string | null | undefined): string {
  return TrainingColors[tipo as TrainingType] ?? Palette.purple;
}

/**
 * Cor por perfil de acesso — aluno em rosa (já era o accent padrão), profissional em azul
 * (já era a cor dominante do Painel: pedidos/convites pendentes, agenda). Roxo fica de fora
 * porque já é a cor do módulo de dieta (aba "Dieta", botão "Salvar dieta").
 */
export const RoleColors = {
  aluno: Palette.accent,
  profissional: Palette.blue,
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
