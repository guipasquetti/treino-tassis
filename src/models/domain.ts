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
  /** Observação livre sobre a série, ex.: "senti dor no ombro". */
  obs?: string;
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
  /** URL de um vídeo curto de execução (YouTube, Drive, etc.). */
  video?: string;
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
  /**
   * Linha de anotação, não alimento — guarda o total já conferido à mão pelo nutricionista
   * pra essa refeição (achado em dado real de produção em 06/set, nunca escrita pelo editor
   * do app: alguém gravou direto via SQL). Nunca soma macro de novo, nunca vira item de
   * lista de compras, nunca aparece como comida na tela.
   */
  ehTotal?: boolean;
};

/**
 * `true` pra linha de anotação (o total conferido à mão, ou o aviso de "sem total
 * calculado") — nunca alimento de verdade. Reconhecida por `ehTotal` explícito OU por não
 * ter quantidade nenhuma: todo alimento real tem alguma quantidade, mesmo vaga como
 * "à vontade" — só uma anotação tem `quantidade` vazia.
 */
export function ehAnotacao(item: ItemRefeicao): boolean {
  return item.ehTotal === true || !item.quantidade.trim();
}

/** Só os alimentos de verdade — filtra as linhas de anotação antes de somar macro ou comprar. */
export function itensReais(itens: ItemRefeicao[]): ItemRefeicao[] {
  return itens.filter((item) => !ehAnotacao(item));
}

/** Total que o nutricionista já conferiu à mão pra essa refeição, quando existe essa linha. */
export function totalConferidoPeloNutricionista(itens: ItemRefeicao[]): Macros | null {
  return itens.find((item) => item.ehTotal)?.macros ?? null;
}

/** Aviso de texto livre do nutricionista sobre essa refeição (ex.: "sem total calculado"). */
export function avisoDaRefeicao(itens: ItemRefeicao[]): string | null {
  return itens.find((item) => !item.ehTotal && ehAnotacao(item))?.nome ?? null;
}

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

export type ItemListaCompras = {
  nome: string;
  quantidade: string;
  /** "≈120g por porção" — só quando o item aparece em mais de uma refeição do dia. */
  mediaPorPorcao?: string;
  /** Nomes das substituições vistas pra esse item — informativo, nunca somado à quantidade. */
  substitutos?: string[];
};
export type CategoriaListaCompras = { categoria: string; itens: ItemListaCompras[] };

/** Categoria de fallback pra item sem correspondência na TACO nem nas palavras-chave. */
export const CATEGORIA_ITENS_LIVRES = 'Itens diversos';

/**
 * Fallback de categoria por palavra-chave no nome — a dieta real do Tassis não usa nenhum
 * item vindo da busca TACO (tudo foi digitado com macro calculado à mão), então a categoria
 * por `taco_id` nunca dispara sozinha. Cobre os alimentos mais comuns de dieta brasileira;
 * primeiro padrão que bater vence. Não é a classificação oficial da TACO — é aproximação.
 */
const PALAVRAS_CATEGORIA: [RegExp, string][] = [
  [/caf[ée]|ch[áa]|suco|refrigerante|[áa]gua\b|vinho|cerveja|bebida/i, 'Bebidas (alcoólicas e não alcoólicas)'],
  [/frango|peito de frango|coxa|sobrecoxa|carne|alcatra|contrafil[ée]|coxão|lagarto|patinho|filé.?mignon|bacon|linguiça|linguica|presunto/i, 'Carnes e derivados'],
  [/tilápia|tilapia|peixe|salmão|salmao|atum|sardinha|camarão|camarao|frutos do mar/i, 'Pescados e frutos do mar'],
  [/\bovo/i, 'Ovos e derivados'],
  [/queijo|leite|iogurte|requeijão|requeijao|ricota|manteiga|cream cheese/i, 'Leite e derivados'],
  [/arroz|macarrão|macarrao|aveia|pão|pao\b|batata|mandioca|tapioca|farinha|granola|cuscuz/i, 'Cereais e derivados'],
  [/feijão|feijao|lentilha|grão.de.bico|grao.de.bico|ervilha|\bsoja\b/i, 'Leguminosas e derivados'],
  [/laranja|banana|maçã|maca\b|mamão|mamao|abacaxi|manga|uva|morango|mexerica|tangerina|melancia|melão|melao|\bfruta/i, 'Frutas e derivados'],
  [/alface|tomate|cenoura|brócolis|brocolis|couve|espinafre|abobrinha|pepino|legum|verdura|salada/i, 'Verduras, hortaliças e derivados'],
  [/azeite|óleo|oleo|margarina/i, 'Gorduras e óleos'],
  [/castanha|amêndoa|amendoa|amendoim|\bnoz\b|nozes|semente|chia|linhaça|linhaca/i, 'Nozes e sementes'],
  [/açúcar|acucar|\bdoce\b|\bmel\b|chocolate|geleia/i, 'Produtos açucarados'],
  [/whey|suplemento|proteína isolada|proteina isolada/i, 'Miscelâneas'],
];

function categoriaPorNome(nome: string): string | null {
  for (const [padrao, categoria] of PALAVRAS_CATEGORIA) {
    if (padrao.test(nome)) return categoria;
  }
  return null;
}

const REGEX_CONTAGEM = /^\s*([\d.,]+)\s*(unidades?|fatias?)\b/i;
const REGEX_PESO_PARENTESES = /\(([\d.,]+)\s*(kg|g|l|ml)\)/i;
const REGEX_PESO_SOLTO = /([\d.,]+)\s*(kg|g|l|ml)\b/i;

type QuantidadeParseada = { valor: number; unidade: string };

/**
 * Extrai um número comprável do texto livre do item. Prioriza CONTAGEM ("2 unidades", "2
 * fatias") sobre peso — ovo e pão de forma são mais reais na feira como "60 unidades"/"60
 * fatias" do que como grama total. Sem contagem, usa o peso/volume entre parênteses (o valor
 * mais confiável, é o que o nutricionista calculou) ou solto no texto. "à vontade"/"a gosto"
 * não casam com nada — devolve `null`, e a linha vira texto original, nunca multiplicado.
 */
function parsearQuantidade(texto: string): QuantidadeParseada | null {
  const contagem = texto.match(REGEX_CONTAGEM);
  if (contagem) {
    const numero = Number(contagem[1].replace(',', '.'));
    if (!Number.isNaN(numero)) {
      return { valor: numero, unidade: contagem[2].toLowerCase().startsWith('fatia') ? 'fatia' : 'unidade' };
    }
  }
  const peso = texto.match(REGEX_PESO_PARENTESES) ?? texto.match(REGEX_PESO_SOLTO);
  if (peso) {
    const numero = Number(peso[1].replace(',', '.'));
    if (!Number.isNaN(numero)) {
      const unidadeBruta = peso[2].toLowerCase();
      if (unidadeBruta === 'kg') return { valor: numero * 1000, unidade: 'g' };
      if (unidadeBruta === 'l') return { valor: numero * 1000, unidade: 'ml' };
      return { valor: numero, unidade: unidadeBruta };
    }
  }
  return null;
}

function formatarNumero(v: number): string {
  return (Math.round(v * 10) / 10).toString().replace('.', ',');
}

function formatarQuantidade(valor: number, unidade: string): string {
  if (unidade === 'unidade' || unidade === 'fatia') {
    const n = Math.round(valor);
    return `${n} ${unidade}${n === 1 ? '' : 's'}`;
  }
  if (unidade === 'g') return valor >= 1000 ? `${formatarNumero(valor / 1000)}kg` : `${Math.round(valor)}g`;
  if (unidade === 'ml') return valor >= 1000 ? `${formatarNumero(valor / 1000)}L` : `${Math.round(valor)}ml`;
  return `${formatarNumero(valor)} ${unidade}`;
}

type GrupoCompra = {
  nome: string;
  tacoId?: number;
  /** `null` assim que QUALQUER ocorrência não é parseável, ou entra em unidade incompatível — desiste de somar. */
  totalPorDia: number | null;
  unidade: string | null;
  ocorrenciasPorDia: number;
  substitutos: Set<string>;
  quantidadeOriginal: string;
};

/**
 * Lista de compras derivada da dieta — não é salva em lugar nenhum, é sempre recalculada a
 * partir das refeições atuais (FA do roadmap, item 06: "recalcula quando a dieta muda").
 * Agrupa por NOME normalizado (não por `taco_id`) — arroz no almoço e no jantar, mesmo com
 * gramagens diferentes, viram uma linha só, venha o item da TACO ou digitado à mão. Guardado
 * é sempre o valor de CADA ocorrência (nunca inferido) — se qualquer uma não for parseável
 * ("à vontade"), a linha inteira volta a mostrar o texto original em vez de um número
 * inventado. Substituições (`item.substituicoes`) nunca entram na soma — são alternativa,
 * não item extra a comprar — só aparecem como nota.
 *
 * `dias` projeta o consumo diário pro período todo (pedido do Guilherme, 06/set: "prever o
 * que o cliente vai gastar nos 30 dias") — a dieta é sempre um dia-modelo repetido, então o
 * total do período é o total do dia × número de dias.
 */
export function listaDeCompras(
  refeicoes: Refeicao[],
  dias: number,
  categoriaPorTacoId: Record<number, string>,
): CategoriaListaCompras[] {
  const grupos = new Map<string, GrupoCompra>();

  for (const refeicao of refeicoes) {
    for (const item of itensReais(refeicao.itens)) {
      const chave = item.nome.trim().toLowerCase();
      let grupo = grupos.get(chave);
      if (!grupo) {
        grupo = {
          nome: item.nome.trim(),
          tacoId: item.taco_id,
          totalPorDia: 0,
          unidade: null,
          ocorrenciasPorDia: 0,
          substitutos: new Set(),
          quantidadeOriginal: item.quantidade,
        };
        grupos.set(chave, grupo);
      }
      if (grupo.tacoId == null && item.taco_id != null) grupo.tacoId = item.taco_id;

      const parsed: QuantidadeParseada | null =
        item.quantidade_g != null ? { valor: item.quantidade_g, unidade: 'g' } : parsearQuantidade(item.quantidade);

      if (grupo.totalPorDia !== null) {
        if (!parsed || (grupo.unidade !== null && grupo.unidade !== parsed.unidade)) {
          grupo.totalPorDia = null;
        } else {
          grupo.unidade = parsed.unidade;
          grupo.totalPorDia += parsed.valor;
        }
      }

      grupo.ocorrenciasPorDia += 1;
      for (const sub of item.substituicoes) grupo.substitutos.add(sub.nome);
    }
  }

  const porCategoria = new Map<string, ItemListaCompras[]>();
  function adicionar(categoria: string, item: ItemListaCompras) {
    const lista = porCategoria.get(categoria);
    if (lista) lista.push(item);
    else porCategoria.set(categoria, [item]);
  }

  for (const grupo of grupos.values()) {
    const categoria =
      (grupo.tacoId != null ? categoriaPorTacoId[grupo.tacoId] : undefined) ??
      categoriaPorNome(grupo.nome) ??
      CATEGORIA_ITENS_LIVRES;

    let quantidade: string;
    let mediaPorPorcao: string | undefined;
    if (grupo.totalPorDia !== null && grupo.unidade) {
      quantidade = formatarQuantidade(grupo.totalPorDia * dias, grupo.unidade);
      if (grupo.ocorrenciasPorDia > 1) {
        mediaPorPorcao = `≈ ${formatarQuantidade(grupo.totalPorDia / grupo.ocorrenciasPorDia, grupo.unidade)} por porção`;
      }
    } else {
      quantidade = grupo.quantidadeOriginal.trim() || 'a gosto';
    }

    adicionar(categoria, {
      nome: grupo.nome,
      quantidade,
      mediaPorPorcao,
      substitutos: grupo.substitutos.size ? [...grupo.substitutos] : undefined,
    });
  }

  return [...porCategoria.entries()]
    .map(([categoria, itens]) => ({
      categoria,
      itens: itens.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    }))
    .sort((a, b) => {
      if (a.categoria === CATEGORIA_ITENS_LIVRES) return 1;
      if (b.categoria === CATEGORIA_ITENS_LIVRES) return -1;
      return a.categoria.localeCompare(b.categoria, 'pt-BR');
    });
}

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
