import { useFonts } from 'expo-font';
import type { TextStyle } from 'react-native';

/**
 * Tipografia da marca Vytra (brand book em `docs/marca/BRAND.md`).
 *
 * - **Big Shoulders Display** — títulos e números grandes. Condensada, vertical, dá o tom
 *   "técnico/monitor" sem custar largura de tela.
 * - **IBM Plex Mono** — wordmark, rótulos, dados tabulares. É a fonte do logotipo.
 * - Texto corrido continua na fonte do sistema: é a que melhor lê em parágrafo e não
 *   custa nada carregar.
 *
 * Os arquivos ficam em `assets/fonts/` versionados no repositório — de propósito, pra não
 * depender de pacote npm novo nem de rede em tempo de build.
 */
export const Fonts = {
  heading: 'BigShouldersDisplay-Bold',
  headingBlack: 'BigShouldersDisplay-Black',
  mono: 'IBMPlexMono-Medium',
  monoStrong: 'IBMPlexMono-SemiBold',
} as const;

/**
 * Carrega as fontes da marca. Devolve `true` quando pode desenhar.
 *
 * Se um dia falhar (arquivo corrompido, plataforma sem suporte), `useFonts` devolve o erro
 * e o app deve seguir com a fonte do sistema em vez de travar na splash — quem chama trata
 * isso, ver `src/app/_layout.tsx`.
 */
export function useBrandFonts(): [boolean, Error | null] {
  const [carregadas, erro] = useFonts({
    [Fonts.heading]: require('../../assets/fonts/BigShouldersDisplay-Bold.ttf'),
    [Fonts.headingBlack]: require('../../assets/fonts/BigShouldersDisplay-Black.ttf'),
    [Fonts.mono]: require('../../assets/fonts/IBMPlexMono-Medium.ttf'),
    [Fonts.monoStrong]: require('../../assets/fonts/IBMPlexMono-SemiBold.ttf'),
  });
  return [carregadas, erro ?? null];
}

/**
 * Estilo de título da marca. Big Shoulders é condensada e tem caixa alta estreita — por isso
 * o tracking levemente aberto, como no brand book.
 */
export function headingStyle(size: number, black = false): TextStyle {
  return {
    fontFamily: black ? Fonts.headingBlack : Fonts.heading,
    fontSize: size,
    letterSpacing: size * 0.01,
    // Big Shoulders tem ascendente alto: sem lineHeight explícito o texto "flutua" no bloco.
    lineHeight: size * 1.05,
  };
}

/** Estilo de rótulo/dado tabular em IBM Plex Mono. */
export function monoStyle(size: number, strong = false): TextStyle {
  return {
    fontFamily: strong ? Fonts.monoStrong : Fonts.mono,
    fontSize: size,
    letterSpacing: size * 0.04,
  };
}
