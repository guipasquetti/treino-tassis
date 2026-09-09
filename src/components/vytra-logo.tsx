import { Image, type ImageStyle, type StyleProp } from 'react-native';

/**
 * Logotipo da Vytra.
 *
 * Os arquivos são PNG exportados dos SVGs canônicos em `assets/brand/` (gerados a partir de
 * uma geometria única — ver `docs/marca/BRAND.md`). São imagem, e não desenho em código, de
 * propósito: o wordmark é IBM Plex Mono convertido em curvas, então o logotipo fica idêntico
 * em iOS, Android e web sem depender de fonte carregada nem de `react-native-svg`.
 *
 * Só existem as variantes de cor que o brand book autoriza. Não tingir o mark com outra cor.
 */

const LOCKUP_RATIO = 1200 / 153; // 7.843
const MARK_RATIO = 1024 / 347; // 2.951

const lockups = {
  /** Sobre a base escura da marca — mark menta, wordmark claro. Padrão do app. */
  padrao: require('../../assets/brand/vytra-lockup-2400.png'),
  /** Tudo branco — sobre foto ou fundo colorido onde o menta perde contraste. */
  branco: require('../../assets/brand/vytra-lockup-white-2400.png'),
  /** Tudo preto — sobre fundo claro (documento, PDF, papel). */
  preto: require('../../assets/brand/vytra-lockup-black-2400.png'),
} as const;

const marks = {
  padrao: require('../../assets/brand/vytra-mark-1024.png'),
  branco: require('../../assets/brand/vytra-mark-white-1024.png'),
} as const;

export type VariantLockup = keyof typeof lockups;
export type VariantMark = keyof typeof marks;

/**
 * Lockup horizontal (mark + VYTRA). É a forma principal da marca.
 * `largura` em px — a altura sai da proporção fixa do arquivo.
 */
export function VytraLockup({
  largura = 180,
  variante = 'padrao',
  style,
}: {
  largura?: number;
  variante?: VariantLockup;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={lockups[variante]}
      accessibilityRole="image"
      accessibilityLabel="Vytra"
      resizeMode="contain"
      style={[{ width: largura, height: largura / LOCKUP_RATIO }, style]}
    />
  );
}

/**
 * Só o mark, sem o nome. Usar quando "Vytra" já está escrito por perto — cabeçalho de aba,
 * avatar, estado vazio. Abaixo de 16px de altura, usar o favicon (traço óptico mais pesado).
 */
export function VytraMark({
  largura = 40,
  variante = 'padrao',
  style,
}: {
  largura?: number;
  variante?: VariantMark;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={marks[variante]}
      accessibilityRole="image"
      accessibilityLabel="Vytra"
      resizeMode="contain"
      style={[{ width: largura, height: largura / MARK_RATIO }, style]}
    />
  );
}
