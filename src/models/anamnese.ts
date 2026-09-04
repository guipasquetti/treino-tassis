/**
 * Schema do formulário de anamnese — respondido DENTRO do app, autenticado, no onboarding
 * (`OnboardingAnamnese`, ver `aluno/_layout.tsx`), não mais num link público (§12, 04/set).
 *
 * Fiel ao protótipo (`prototype/index.html`, array `PERGUNTAS_ANAMNESE`): mesmas seções,
 * mesmos campos, mesmo `id` — o `id` de cada campo é a chave gravada no JSONB
 * `anamnese.respostas_completas`, e a RPC `submeter_anamnese_autenticado` lê algumas dessas
 * chaves por nome exato (`nome_completo`, `telefone`, `data_nascimento`, `altura_cm`,
 * `peso_atual`, `objetivo_principal`, `pratica_atividade`, `limitacao_fisica`, `patologias`,
 * `medicamentos`, `cirurgias`, `historico_familiar`, `nao_consome`,
 * `intolerancias_alergias`, `observacoes_finais`). Não renomear sem atualizar a função SQL.
 *
 * Decisões de produto já tomadas no protótipo, preservadas aqui: sem paginação/wizard (uma
 * tela só, com scroll), sem campo obrigatório, sem lógica condicional entre perguntas.
 */

export type TipoCampoAnamnese = 'texto' | 'numero' | 'data' | 'area';

export type CampoAnamnese = {
  id: string;
  label: string;
  tipo: TipoCampoAnamnese;
  placeholder?: string;
};

export type SecaoAnamnese = {
  titulo: string;
  campos: CampoAnamnese[];
};

export const SECOES_ANAMNESE: SecaoAnamnese[] = [
  {
    titulo: 'Identificação',
    campos: [
      { id: 'nome_completo', label: 'Nome completo', tipo: 'texto' },
      { id: 'data_nascimento', label: 'Data de nascimento', tipo: 'data' },
      { id: 'idade', label: 'Idade', tipo: 'texto' },
      { id: 'sexo', label: 'Sexo', tipo: 'texto' },
      { id: 'telefone', label: 'Telefone', tipo: 'texto' },
      { id: 'profissao', label: 'Profissão', tipo: 'texto' },
      { id: 'rotina_trabalho', label: 'Rotina de trabalho (horários, trabalho físico ou sedentário)', tipo: 'area' },
    ],
  },
  {
    titulo: 'Dados antropométricos',
    campos: [
      { id: 'peso_atual', label: 'Peso atual (kg)', tipo: 'numero' },
      { id: 'altura_cm', label: 'Altura (cm)', tipo: 'numero' },
      { id: 'peso_habitual', label: 'Peso habitual', tipo: 'texto' },
      { id: 'maior_peso', label: 'Maior peso já atingido', tipo: 'texto' },
      { id: 'menor_peso_adulto', label: 'Menor peso na vida adulta', tipo: 'texto' },
      { id: 'mudancas_peso', label: 'Mudanças recentes de peso (ganho/perda, quanto e em quanto tempo)', tipo: 'area' },
    ],
  },
  {
    titulo: 'Histórico de saúde',
    campos: [
      { id: 'patologias', label: 'Possui alguma patologia diagnosticada? Se sim, qual(is)?', tipo: 'area', placeholder: 'Ex.: Não' },
      { id: 'historico_familiar', label: 'Histórico familiar de doenças (diabetes, hipertensão, dislipidemia, obesidade, cardiovasculares, tireoide etc.)', tipo: 'area' },
      { id: 'cirurgias', label: 'Já realizou cirurgias? Quais e quando?', tipo: 'area', placeholder: 'Ex.: Não' },
      { id: 'intolerancias_alergias', label: 'Possui intolerâncias ou alergias alimentares?', tipo: 'area' },
      { id: 'sintomas_gastro', label: 'Sintomas gastrointestinais frequentes (azia, refluxo, constipação, diarreia, gases)?', tipo: 'area', placeholder: 'Ex.: Não' },
    ],
  },
  {
    titulo: 'Medicamentos e suplementos',
    campos: [
      { id: 'medicamentos', label: 'Faz uso de algum medicamento? Qual(is), dose e horário', tipo: 'area', placeholder: 'Ex.: Não' },
      { id: 'suplementos', label: 'Utiliza suplementos alimentares? (proteína, creatina, vitaminas, termogênicos, outros)', tipo: 'area', placeholder: 'Ex.: Não' },
      { id: 'fitoterapicos', label: 'Uso de fitoterápicos ou chás com frequência', tipo: 'area' },
    ],
  },
  {
    titulo: 'Hábitos alimentares',
    campos: [
      { id: 'refeicoes_por_dia', label: 'Quantas refeições faz por dia?', tipo: 'texto' },
      { id: 'horarios_refeicoes', label: 'Horários habituais das refeições', tipo: 'texto' },
      { id: 'cafe_manha', label: 'Café da manhã — o que costuma comer', tipo: 'area' },
      { id: 'lanche_manha', label: 'Lanche da manhã — o que costuma comer', tipo: 'area' },
      { id: 'almoco', label: 'Almoço — o que costuma comer', tipo: 'area' },
      { id: 'lanche_tarde', label: 'Lanche da tarde — o que costuma comer', tipo: 'area' },
      { id: 'jantar', label: 'Jantar — o que costuma comer', tipo: 'area' },
      { id: 'ceia', label: 'Ceia — o que costuma comer', tipo: 'area' },
      { id: 'beliscar', label: 'Costuma beliscar entre as refeições?', tipo: 'texto' },
      { id: 'freq_ultraprocessados', label: 'Frequência de consumo de alimentos ultraprocessados', tipo: 'texto' },
      { id: 'freq_doces_alcool', label: 'Frequência de doces, refrigerantes e bebidas alcoólicas', tipo: 'texto' },
      { id: 'consumo_agua', label: 'Consumo diário de água (aproximado)', tipo: 'texto' },
    ],
  },
  {
    titulo: 'Preferências alimentares',
    campos: [
      { id: 'alimentos_gosta', label: 'Alimentos que gosta', tipo: 'area' },
      { id: 'alimentos_nao_gosta', label: 'Alimentos que não gosta', tipo: 'area' },
      { id: 'nao_consome', label: 'Alimentos que não consome por opção (vegetarianismo, veganismo, religião, cultura)', tipo: 'area', placeholder: 'Ex.: Nenhum' },
      { id: 'facilidade_cozinhar', label: 'Facilidade para cozinhar em casa', tipo: 'texto' },
      { id: 'refeicoes_fora', label: 'Realiza refeições fora de casa com frequência? Onde?', tipo: 'texto' },
    ],
  },
  {
    titulo: 'Atividade física',
    campos: [
      { id: 'pratica_atividade', label: 'Pratica atividade física? Qual(is) modalidade(s)?', tipo: 'area', placeholder: 'Ex.: Não' },
      { id: 'tempo_treino', label: 'Tempo de treino (meses/anos)', tipo: 'texto' },
      { id: 'freq_musculacao', label: 'Frequência semanal de treino de força/musculação', tipo: 'texto' },
      { id: 'freq_cardio', label: 'Frequência semanal de cardio', tipo: 'texto' },
      { id: 'duracao_treinos', label: 'Duração média dos treinos', tipo: 'texto' },
      { id: 'intensidade', label: 'Intensidade percebida (leve, moderada, intensa)', tipo: 'texto' },
      { id: 'limitacao_fisica', label: 'Possui alguma limitação física, dor ou lesão?', tipo: 'area', placeholder: 'Ex.: Não' },
    ],
  },
  {
    titulo: 'Sono e rotina',
    campos: [
      { id: 'horario_dormir', label: 'Horário que costuma dormir', tipo: 'texto' },
      { id: 'horario_acordar', label: 'Horário que costuma acordar', tipo: 'texto' },
      { id: 'horas_sono', label: 'Média de horas de sono por noite', tipo: 'texto' },
      { id: 'qualidade_sono', label: 'Qualidade do sono (boa, regular, ruim)', tipo: 'texto' },
      { id: 'acorda_descansado', label: 'Acorda descansado?', tipo: 'texto' },
    ],
  },
  {
    titulo: 'Objetivo com o acompanhamento',
    campos: [
      { id: 'objetivo_principal', label: 'Objetivo principal (emagrecimento, ganho de massa, saúde, desempenho esportivo, outro)', tipo: 'texto' },
      { id: 'prazo_objetivo', label: 'Prazo esperado para atingir o objetivo', tipo: 'texto' },
      { id: 'dieta_anterior', label: 'Já fez dieta antes? Qual foi a experiência?', tipo: 'area' },
      { id: 'dificuldade_seguir_dieta', label: 'Principal dificuldade em seguir um plano alimentar', tipo: 'area' },
    ],
  },
  {
    titulo: 'Observações finais',
    campos: [
      { id: 'observacoes_finais', label: 'Algo mais que considere importante informar', tipo: 'area' },
      { id: 'expectativas', label: 'Expectativas em relação ao acompanhamento', tipo: 'area' },
    ],
  },
];

export type RespostasAnamnese = Record<string, string>;
