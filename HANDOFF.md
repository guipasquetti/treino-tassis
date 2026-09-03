# App Treino — Handoff

> Documento de contexto para replicar o estado do projeto em outro chat.
> Última atualização: 02/Setembro/2026.

> **Fonte canônica:** este arquivo, na raiz do repositório. Todo agente (Codex ou Claude) deve lê-lo antes de alterar o projeto e atualizá-lo ao concluir mudanças relevantes, decisões, migrações, configuração de infraestrutura ou bloqueios.

---

## 1. Visão geral

**App Treino** nasceu como app de personal trainer pro Tassis (treinador monta plano de
treino/nutrição, aluno executa e registra), mas a reunião de kickoff (31/ago) elevou a
ambição: é pra virar **plataforma SaaS white-label** — Tassis é o primeiro cliente/piloto,
não o único usuário final. Ver §2 pros detalhes de negócio.

✅ **Multi-tenant aplicado no banco (02/set).** Decisão do Tassis: obrigatório desde a v1,
não é evolução futura — cada treinador e cada nutricionista tem sua própria base de
pacientes/clientes, isolada. Migração `20260902_multi_tenant_professionals_subscriptions.sql`
já rodou em produção: criou `professionals`, `professional_plans`, `subscriptions`,
reescreveu todas as RLS (antes `is_trainer()` dava acesso global a qualquer trainer sobre
qualquer cliente; agora é escopado por assinatura ativa via `is_professional_of()` /
`is_client_of()`), e fez backfill dos dados reais existentes (Tassis → `professionals`,
cliente atual → `subscriptions` ativa). Detalhe completo em §5.

Relação paciente↔profissional confirmada como **N:N**, cada par com **assinatura própria
e independente** — cada profissional cobra do seu jeito, sem plano compartilhado. Exemplo
do Tassis: ele pode vender um plano "só dieta" e outro "dieta + treino" — um profissional
pode ter **vários planos/produtos** (`professional_plans`), não preço fixo único.

**Ideia futura, explicitamente fora de escopo agora** (palavras do Tassis: "mais uma
ideia a ser explorada"): quando o app ganhar escala, um marketplace/diretório de
profissionais dentro do app pra indicação. Não construir pra isso agora, mas não
desenhar o N:N de um jeito que trave adicionar essa camada de descoberta depois.

Projeto irmão de referência (mesma stack, mesmo padrão de pastas): **OLIHealthHub**
(`../OLIHealthHub`), usar como benchmark de organização quando houver dúvida.

⚠️ **Existe um protótipo funcional anterior a este projeto**, preservado em
[`prototype/`](prototype/) — HTML/JS puro, conectado ao mesmo Supabase, com login,
convite+anamnese, execução de treino (histórico de cargas, cores push/pull/legs) e
montagem de dieta com busca TACO já implementados informalmente. Consultar antes de
desenhar as telas equivalentes no Expo — várias decisões de UX/produto já foram
tomadas ali. Era o conteúdo original do repo GitHub `treino-tassis` (histórico git
substituído em 02/set quando conectamos este projeto Expo ao mesmo repo).

**Identidade visual:** referência escolhida pelo Guilherme (02/set) é o app nativo
**Apple Fitness** (dark theme, cores saturadas por categoria, números grandes, cards
arredondados) — screenshots em [`docs/design-inspiration/`](docs/design-inspiration/).
✅ Já aplicada em [`src/theme/index.ts`](src/theme/index.ts). Escopo explícito do
Guilherme: **só a identidade visual**, não as funcionalidades do Apple Fitness —
HealthKit/Apple Watch ficam de fora, no máximo como captura de dado pro módulo de
exercício mais pra frente. Marca própria (nome/cores do Tassis) segue pendente no §7.

## 2. Modelo de negócio e visão de produto (reunião com Tassis, 31/ago)

**Dor atual do Tassis:** ferramentas fragmentadas — Live Clean (gestão/check-ins
quinzenais, bom histórico de paciente), WebDiet (prescrição de dieta, **odiado**: UX ruim
em mobile, tabela de alimentos superestima calorias), Asaas (cobrança). Cobrança hoje é
manual: profissional marca "pago" à mão pra liberar 30 dias — sem recorrência automática.

**3 perfis de usuário previstos:** paciente, nutricionista, educador físico (personal
trainer). Cada profissional poderia usar a plataforma com marca própria (white-label).

**Monetização:**
- Paciente: mensal ~R$350, trimestral ~R$800 (~R$267/mês); semestral/anual TBD. Acesso
  cortado se pagamento parar → precisa cobrança recorrente automática.
- Profissional (SaaS): assinatura mensal ~R$250.

**Referências de concorrência:**
- **Elite Pro** — concorrente direto, fluxo de planejamento chamado "Bússola" (Tassis vai
  mandar prints pra referência de UX — pendente, ver §7).
- WebDiet = benchmark negativo (o que não fazer em UX mobile).
- Live Clean = bom em base/histórico de paciente e follow-up de não-respondentes.

**Módulo dieta — fórmulas de gasto energético:** Mifflin-St Jeor (treinados),
Harris-Benedict (atletas), Cunningham (baixo % gordura). Integra tabelas TACO (já em
`alimentos_taco`, 597 linhas) + TBCA (ainda não temos — pendente, ver §7).

**Funcionalidades combinadas na reunião (nenhuma implementada ainda):**
- Lista de compras dinâmica (recalcula ao editar a dieta)
- Fator de cocção (peso do alimento cru vs. cozido)
- Notificações inteligentes de hidratação/alimentação baseadas no horário de
  acordar/dormir do paciente
- Dashboard pro profissional sinalizando picos de ansiedade/fome via notificações
- Módulo treino: histórico de cargas + vídeos curtos (15s) de execução gravados pelo
  próprio Tassis/parceira (Gabi) — não genéricos

**Fluxo de onboarding (vendas, não só técnico):** Instagram/indicação → call de
sensibilização → link de pagamento + anamnese → anamnese preenchida gera cadastro
automático → dieta/treino montados em 2–4 dias → entrega via vídeo pessoal no WhatsApp
com link do app. Já bate com o fluxo técnico existente (`convites` →
`submeter_anamnese` → `finalizar_cadastro_convite`), mas **falta a etapa de pagamento**
no meio do funil.

**Compliance:** precisa termo de consentimento/contrato cobrindo LGPD + uso de imagem +
isenção de responsabilidade por resultado. Nada disso existe no projeto ainda.

**Estratégia de lançamento:** migrar pacientes atuais do Tassis pra uma **v1.0 Web**
primeiro (validação/prova social), só depois subir pra App Store/Play Store. Marketing via
Reels/TikTok.

## 3. Stack

| Camada | Tecnologia |
|---|---|
| App | React Native + Expo SDK 57, Expo Router, TypeScript |
| Estado | Zustand (`src/store/authStore.ts`) |
| UI | Design system próprio (`src/theme`) + `@expo/vector-icons` — **sem lib de componentes** |
| Persistência local | AsyncStorage + Expo SecureStore |
| Backend | Supabase (Postgres + Auth + RLS) |
| Hospedagem web | EAS Hosting — https://app-treino.expo.app (ver §4) |
| Build nativo (iOS/Android) | não configurado ainda — sem EAS Build, sem conta Apple |

**Decisão de stack (02/set):** avaliado usar Xcode/SwiftUI em paralelo, **descartado**.
Motivos: contradiz o go-to-market de web-primeiro (§2), cortaria Android (maior parte do
mercado do Tassis), e dois codebases com um dev só é insustentável. Nada dos problemas
enfrentados até aqui (SMTP, RLS, telas placeholder) vinha do Expo. Se um dia HealthKit/
Apple Watch virar core, dá pra fazer via módulo nativo sem trocar de stack.

## 4. Infra — IDs e ambientes

| Item | Valor |
|---|---|
| Supabase project | `treino-tassis` |
| Supabase project ref | `fshwcaxcbnudvoyyqaxy` |
| Supabase região | `us-east-1` |
| Supabase URL | `https://fshwcaxcbnudvoyyqaxy.supabase.co` |
| App scheme (deep link) | `apptreino://` |
| Bundle iOS/Android | não definido ainda |
| Repo git | `github.com/guipasquetti/treino-tassis` (público) |
| Pasta local | `/Users/guilhermepasquetti/Developer/App Treino` |
| **App no ar (web)** | **https://app-treino.expo.app** — EAS Hosting, produção |
| EAS project | `@guipasquetti/app-treino` (`f37244c8-045f-4fff-89de-ecf05f7872ce`) |

**Deploy web** (é assim que o Tassis acessa hoje — é a "v1.0 Web" do §2):
```bash
npx expo export --platform web && eas deploy --prod
```
`eas deploy` sem `--prod` gera uma URL de preview sem mexer na produção. Dashboard:
`https://expo.dev/projects/f37244c8-045f-4fff-89de-ecf05f7872ce/hosting/deployments`.

⚠️ As chaves `EXPO_PUBLIC_*` são **embutidas no bundle** no momento do export — é o
esperado (a publishable key é pública por design, quem protege o dado é a RLS). Nunca
colocar chave de service role em variável `EXPO_PUBLIC_*`.

`.env` local (gitignored) já populado com `EXPO_PUBLIC_SUPABASE_URL` +
`EXPO_PUBLIC_SUPABASE_ANON_KEY` (publishable key, não a legacy anon). `.env.example`
versionado como referência.

## 5. Modelo de dados (Supabase — já em produção com dados reais)

| Tabela | Papel | Linhas (02/set) |
|---|---|---|
| `profiles` | conta (trainer/client), dados físicos (peso/altura) | 2 |
| `professionals` | tenant — profile que virou profissional (`especialidade`) | 1 |
| `professional_plans` | produtos que um profissional vende (`inclui_dieta`/`inclui_treino`, preço) | 1 (backfill "Padrão (migração)") |
| `subscriptions` | vínculo real paciente↔profissional↔plano, com `status` | 1 |
| `plans` | plano de treino por período (`dias` jsonb), agora com `professional_id` | 1 |
| `workout_logs` | séries executadas e finalizadas por dia/exercício | 21 |
| `workout_drafts` | autosave do treino em andamento antes de virar log | 2 |
| `anamnese` | questionário de saúde, 1:1 por cliente, **compartilhado entre profissionais** (decisão 02/set) | 1 |
| `planos_alimentares` | plano alimentar (metas de macro + `refeicoes` jsonb), agora com `professional_id` | 1 |
| `alimentos_taco` | tabela TACO de composição de alimentos (referência, seed) | 597 |
| `convites` | onboarding: token → aluno responde → vira profile | 0 |

**RLS reescrita (02/set):** todas as policies que usavam `is_trainer()` (acesso global a
qualquer trainer) foram trocadas por checks escopados por assinatura ativa:
`is_professional_of(patient_id)` (sou profissional ativo desse paciente?) e
`is_client_of(professional_id)` (sou paciente ativo desse profissional?). `is_trainer()`
continua existindo no banco mas não é mais usada em nenhuma policy — candidata a remover
depois que confirmarmos que nada mais depende dela.

**Ainda não existe no banco** (necessário pra visão de negócio do §2): cobrança recorrente
de verdade (`subscriptions.status` existe mas nada automatiza a mudança de status ainda),
termo de consentimento/contrato, TBCA, lista de compras, fator de cocção, notificações
inteligentes, papéis `nutricionista`/`educador_fisico` explícitos (hoje `professionals.especialidade`
é só texto livre, sem enum).

**RPCs:**
- `is_trainer()` — legado, não usado mais em policy nenhuma (ver acima)
- `is_professional_of(p_patient_id)` / `is_client_of(p_professional_id)` / `is_professional()` — novas, usadas nas RLS
- `obter_convite(p_token)` — lê convite pelo token
- `submeter_anamnese(p_token, p_respostas)` — aluno responde anamnese via convite
- `finalizar_cadastro_convite(p_token)` — fecha convite → vira `profiles`

Advisor de segurança do Supabase aponta que `is_professional_of`/`is_client_of`/
`is_professional` (e as antigas) são `SECURITY DEFINER` chamáveis via RPC por `anon`/
`authenticated` — inofensivo aqui porque todas dependem de `auth.uid()` e retornam `false`
sem sessão, mas é warning aberto, mesmo padrão de antes da migração.

Types TS gerados do schema real em [`src/models/database.types.ts`](src/models/database.types.ts)
(gerar de novo com `generate_typescript_types` do MCP Supabase sempre que a migration mudar).

## 6. Estrutura de pastas

Scaffold do Expo foi **removido por completo** em 02/set — nada de `themed-text`,
`animated-icon`, `hint-row`, aba "Explore" etc. O que existe hoje é só código do produto.

```
src/
  app/                        expo-router — rotas = telas
    _layout.tsx               Stack raiz: auth, tema dark, correção de área por papel
    index.tsx                 rota "/": decide login vs /aluno vs /pro (declarativo)
    login.tsx
    aluno/                    área do ALUNO (abas: Treino · Dieta · Perfil)
      _layout.tsx  index.tsx (treino)  dieta.tsx  perfil.tsx
    pro/                      área do PROFISSIONAL (abas: Alunos · Planos · Perfil)
      _layout.tsx  index.tsx (alunos)  planos.tsx  perfil.tsx
  theme/index.ts              design system (paleta, spacing, radius, cores por treino)
  components/
    ui/index.tsx              Screen, Card, Button, Pill, Stat, Stepper, Caption...
    perfil-screen.tsx         perfil compartilhado pelos dois papéis
  models/
    database.types.ts         gerado do schema Supabase
    domain.ts                 tipos dos jsonb + helpers (formatarSet, somaMacros...)
  services/                   1 arquivo por domínio
    authService.ts  workoutService.ts  nutritionService.ts  professionalService.ts
  store/authStore.ts          zustand (sessão, profile, isProfessional)
  lib/supabase.ts             client tipado (com guard de SSR, ver §8)
```

**Rotas são segmentos explícitos (`/aluno`, `/pro`), não route groups.** Foi tentado com
grupos `(client)`/`(pro)` e os dois `index.tsx` disputavam a rota `/` — resultado era
"Unmatched Route". Não voltar pra grupos sem resolver essa colisão.

## 7. Pendências do Tassis (bloqueiam trabalho downstream)

- Tabelas TACO/TBCA em Excel/PDF (já temos TACO seedado por fonte própria — conferir se bate).
  TBCA não tem export em massa nem API oficial (só busca alimento a alimento no site);
  Tassis vai contatar `tbca.contato@usp.br` pra pedir acesso aos dados pra uso comercial.
- Escopo detalhado + dados necessários do paciente pra estruturar o banco
- Termo de consentimento/contrato (LGPD + uso de imagem)
- Prints do fluxo "Bússola" do Elite Pro (referência de UX)
- Pesquisa de mercado de concorrentes (preços/features)
- Identidade visual (nome da marca + cores) — hoje o projeto só existe como "App Treino"/
  slug `app-treino`, sem marca definida
- Vídeos curtos de exercícios (15s)

⚠️ **Urgente, achado em 02/set:** o projeto Supabase não tem SMTP customizado — o
provedor de e-mail padrão é rate-limited e já falha (`connection_failed` no reset de
senha, `over_email_send_rate_limit` até em `signUp` novo). Isso **vai travar o fluxo real
de convite/onboarding** (§2/§9), que depende de confirmação de e-mail. Configurar SMTP
próprio (Resend tem free tier, é o mais comum com Supabase) antes de implementar as
telas de convite — sem isso o cadastro de aluno novo simplesmente não funciona em
produção. Dashboard: Authentication → Settings → SMTP Settings.

## 8. Estado atual

- Scaffold Expo padrão (SDK 57) renomeado de `app-treino-scaffold` → `app-treino`,
  ainda com as telas de exemplo (`src/app/index.tsx`, `explore.tsx`) — **nada de
  domínio implementado ainda**.
- Supabase conectado e tipado; schema multi-tenant aplicado (§5) e `database.types.ts`
  regenerado batendo com ele — banco já reflete a visão white-label do §2, o app ainda não.
- `git`: 2 commits, sem remote configurado — decidir onde hospedar (GitHub) antes do
  próximo handoff.
- ✅ Auth flow básico implementado e testado (Expo web, `expo start --web`): `src/app/login.tsx`,
  `src/store/authStore.ts`, `src/services/authService.ts`. Root layout (`src/app/_layout.tsx`)
  redireciona sem sessão → `/login`, com sessão → `/(app)` (área autenticada única por
  enquanto, ainda sem split trainer/client de telas — `authStore.isProfessional` já
  identifica o papel, falta usar isso pra rotear diferente).
- Rotas reorganizadas: telas antigas do scaffold (`index.tsx`, `explore.tsx`, tabs)
  viraram grupo `src/app/(app)/`; `login.tsx` fica solto na raiz de `src/app/`.
- ⚠️ **Gotcha real encontrado e corrigido:** Expo Router faz SSR até no `expo start --web`
  (renderiza em Node, sem `window`). O client Supabase com `AsyncStorage` batia nisso e
  derrubava o servidor inteiro (`ReferenceError: window is not defined`). Corrigido em
  [`src/lib/supabase.ts`](src/lib/supabase.ts) com um `webSafeStorage` guardado por
  `typeof window`, mesmo padrão já usado no `OLIHealthHub/src/services/supabase.ts`.
- ✅ **V1 utilizável implementada (02/set)** — telas reais, dados reais, scaffold zerado:
  - **Aluno · Treino** ([`src/app/aluno/index.tsx`](src/app/aluno/index.tsx)): abas por dia
    (A/B/C…) coloridas por tipo, card por exercício com prescrição (warm/feeder/working),
    última sessão, leitura de progressão, steppers de carga/reps, registro de série e
    histórico. Grava via draft→log igual ao protótipo (ver §11).
  - **Aluno · Dieta** ([`dieta.tsx`](src/app/aluno/dieta.tsx)): totais do dia vs. metas de
    macro, refeições, itens com quantidade/macros e substituições.
  - **Profissional · Alunos** ([`src/app/pro/index.tsx`](src/app/pro/index.tsx)): contagem
    total/ativos/inativos e card por aluno com plano, status e dias desde o último treino
    (sinaliza quem sumiu há 7+ dias — a dor de "quem não responde" do §2).
  - **Profissional · Planos** ([`planos.tsx`](src/app/pro/planos.tsx)): lista, criação e
    ativar/desativar dos `professional_plans` (nome, preço, periodicidade, módulos).
  - **Perfil** (ambos): dados do profile, vínculos e sair.
- Design system em [`src/theme/index.ts`](src/theme/index.ts) — preto real, cards
  elevados, cores saturadas por categoria, seguindo a referência Apple Fitness do §1.
  As cores push/pull/leg mantêm a semântica que o protótipo já usava.
- ✅ **RLS verificada de verdade (02/set)**, por simulação de JWT no SQL
  (`set local role authenticated` + `request.jwt.claims`):
  - usuário autenticado aleatório → **0 linhas** em profiles, anamnese, logs, dieta,
    assinaturas e planos;
  - aluno → só o próprio dado + o profile do profissional dele;
  - Tassis → só o dado do aluno vinculado + o próprio.
  Isso foi checado **antes** de publicar, porque a `anamnese` tem dado de saúde
  (condições médicas, medicamentos, cirurgias) numa URL pública.
- ⚠️ **Telas ainda não vistas com login real**: quem construiu não tinha credencial.
  Validado por typecheck + render SSR das rotas (200, sem "Unmatched Route") + as
  verificações de RLS acima. **Conferir visualmente.**
- ✅ **Editor de plano de treino** ([`src/app/pro/aluno/[id].tsx`](src/app/pro/aluno/%5Bid%5D.tsx)):
  tocar num aluno na lista abre o editor — dias (tipo, grupos musculares), exercícios,
  séries, faixa de reps, warm/feeder, flags cronometrado/ombro. Preserva ids (ver §11).
- ✅ **Editor de dieta** ([`src/app/pro/aluno/[id]/dieta.tsx`](src/app/pro/aluno/%5Bid%5D/dieta.tsx)):
  metas de macro do dia, refeições, itens vindos da busca TACO (macros calculados a partir
  do valor por 100g) ou item livre. Detalhe do aluno agora tem duas telas com alternador
  (Treino | Dieta).
- Ainda falta **editar** um `professional_plans` existente (hoje só cria novo e
  liga/desliga) e o editor de substituições de alimento (as existentes são preservadas e
  exibidas, mas não dá pra criar/remover pela tela).
- Sem pagamento/cobrança automática ainda (schema tem `subscriptions.status`, mas nada
  muda esse status sozinho), sem contrato/LGPD.
- Migração de schema versionada em [`supabase/migrations/20260902_multi_tenant_professionals_subscriptions.sql`](supabase/migrations/20260902_multi_tenant_professionals_subscriptions.sql)
  (aplicada manualmente via SQL Editor do Supabase — apply automático via MCP foi bloqueado
  pelo classificador de auto mode do Claude Code).

## 9. Escopo funcional v1 (proposto, não implementado)

Tabela abaixo é por par paciente↔profissional (já reflete o modelo N:N do §1/§5).

| Módulo | Aluno | Treinador |
|---|---|---|
| Onboarding | aceita convite, anamnese, cadastro | gera convite, acompanha status |
| Treino | vê plano do dia, registra séries (draft→log), histórico | monta plano por período, edita dias/exercícios |
| Nutrição | vê plano alimentar, busca alimento TACO | monta plano, define metas macro |
| Perfil | dados pessoais, peso/altura | lista de alunos, progresso agregado |

## 10. Próximos passos

1. **Configurar SMTP customizado** (ver alerta no §7) — bloqueia qualquer fluxo de
   cadastro/convite real, prioridade antes do item 3 abaixo.
2. Confirmar visualmente a home (`ClientHome`/`ProfessionalHome`) com login real —
   feita nesta sessão mas não vista rodando com dados de verdade.
3. Telas de treino/nutrição além da home: registrar série (draft→log), montar/editar
   plano (treinador), ver plano alimentar completo, buscar TACO.
4. `src/services/professionalService.ts` (CRUD de `professional_plans`, gestão de
   `subscriptions`) — hoje `homeService.ts` só lê, não tem mutação nenhuma.
5. Telas de onboarding por convite (RPCs do §5) — falta decidir onde no funil entra a
   escolha de plano/assinatura (§2 aponta que hoje é manual, sem cobrança recorrente).
6. Tela de cadastro (`signUp`) — hoje só existe login; cadastro real nasce do fluxo de
   convite (item 5), mas vale conferir se falta um cadastro direto também.
7. Remover a tela de exemplo restante do scaffold (`(app)/explore.tsx`) quando o fluxo
   real substituir.
8. Configurar EAS quando for hora de buildar pra iOS/Android de verdade (hoje só roda
   via `expo start --web`/Expo Go).
9. Cobrar do Tassis os itens do §7 — vários bloqueiam decisões de schema/UX.
10. Avaliar se `is_trainer()` pode ser removida (não é mais usada em nenhuma RLS, ver §5).

## 11. Formas dos campos jsonb (extraídas da produção — não inventar)

Estas estruturas já existem nos dados reais e o protótipo grava nelas. Mudar qualquer uma
quebra os dados do Tassis e do aluno. Tipadas em [`src/models/domain.ts`](src/models/domain.ts).

**`plans.dias`** — array de dias de treino:
```jsonc
[{ "id": "A", "nome": "Push", "desc": "Peito · Ombro · Tríceps", "tipo": "push",
   "ex": [{ "id": "a1", "nome": "Crucifixo máquina", "sets": 2, "min": 12, "max": 15,
            "warm": "8-10 (2x)", "feeder": "4 reps (2x)",
            "nota": "…", "tempo": true, "ombro": true }] }]
```
`tipo` ∈ `push|pull|leg` (define a cor). `tempo: true` = exercício por segundos (prancha),
aí `min`/`max` são segundos, não repetições. `warm`/`feeder` são texto livre ("—" quando não tem).

**`workout_logs.sets` e `workout_drafts.sets`** — array de séries: `[{"p": 40, "r": 12}]`
(`p` = peso em kg, `r` = repetições ou segundos).

**`planos_alimentares.refeicoes`**:
```jsonc
[{ "nome": "Café da manhã",
   "itens": [{ "nome": "Ovo inteiro", "quantidade": "2 unidades médias (100g)",
               "macros": { "kcal": 145.7, "proteina_g": 13.3, "carboidrato_g": 0.6, "lipideos_g": 9.5 },
               "obs": "…",
               "substituicoes": [{ "nome": "…", "quantidade": "…", "macros": {…} }] }] }]
```
`macros` é `null` quando o alimento não tem referência na TACO — sempre tratar o nulo.

### Regra de registro de série (draft → log)

Replicada do protótipo em [`workoutService.ts`](src/services/workoutService.ts); não
simplificar sem entender:
1. Enquanto `séries registradas < ex.sets`, o progresso fica em **`workout_drafts`**
   (chave: client_id + exercise_id + session_date).
2. Ao completar a última série, faz upsert em **`workout_logs`**
   (`onConflict: client_id,exercise_id,session_date`) e **apaga o draft**.
3. "Corrigir última série" desfaz: se já estava em log, apaga o log e devolve as séries
   restantes pro draft; a série removida volta pros steppers pra ser reinformada.

A sugestão de carga/reps da próxima série também veio do protótipo: se na última sessão o
aluno bateu o topo da faixa (`max`) em todas as séries com a mesma carga → sugere subir
(passo de 2,5kg acima de 20kg, 1kg abaixo); senão mantém a carga e pede +1 repetição.

### ⚠️ `Exercicio.id` é chave de histórico — nunca reatribuir

`workout_logs.exercise_id` e `workout_drafts.exercise_id` referenciam o `id` do exercício
dentro de `plans.dias`. Não há FK: é um acoplamento por convenção. Se um id for reatribuído
a outro exercício, o histórico de carga do aluno passa a apontar pro exercício errado, **sem
erro nenhum**.

O protótipo tem esse bug: `dadosDoBuilder()` regenera todos os ids por posição
(`String.fromCharCode(97+i)+(j+1)`) a cada save, então apagar/reordenar exercício lá
embaralha o histórico. **Não copiar esse comportamento.**

O editor do app ([`src/services/planEditor.ts`](src/services/planEditor.ts)) faz o certo:
exercício existente mantém o id; exercício novo recebe o menor id livre conferido contra o
plano inteiro. A tela avisa quais ids sairão do plano antes de salvar.

### Restrição em aberto: um plano de treino por aluno

`plans` tem UNIQUE em `client_id` (`plans_client_id_key`), herdado do protótipo — e o
editor usa `upsert onConflict: 'client_id'`. Isso conflita com o modelo N:N do §1: se um
aluno tiver dois treinadores, os dois disputam a mesma linha. Com o Tassis sozinho não dá
problema. Antes de entrar o segundo profissional, decidir: trocar o UNIQUE para
`(client_id, professional_id)` e ajustar o upsert + as telas que assumem "o plano" no
singular.

### RLS de escrita verificada (02/set)

Por simulação de JWT: upsert em `plans` pelo profissional dono **passa**; update do aluno
no próprio plano é **filtrado** (0 linhas, sem erro — comportamento normal de RLS).

### Dieta: macros são absolutos, e substituições não podem ser perdidas

Os `macros` de um item em `planos_alimentares.refeicoes` são **absolutos** (já na
quantidade daquele item), não por 100g. A TACO (`alimentos_taco`) é que guarda por 100g —
o editor escala na hora de adicionar ([`macrosPorGramas`](src/models/domain.ts)).

A dieta real do aluno tem **31 substituições e 8 observações escritas à mão**. O editor
grava com spread do item existente (`{...item, nome, quantidade}`) justamente pra não
reconstruir e perder esses campos. Round-trip do JSON de produção conferido: contagens
iguais e documento byte-idêntico. **Se for refatorar o save, refazer essa verificação.**

Itens criados pelo editor ganham `taco_id` e `quantidade_g` (campos opcionais, ignorados
por leitores antigos) pra permitir recalcular os macros quando a gramagem muda. Item sem
`taco_id` é "livre" — o profissional digita quantidade em texto e os macros não são
calculados.

## 12. Fluxo de entrada do paciente (desenho fechado com o Guilherme, 02/set)

Roadmap completo publicado como artifact: `https://claude.ai/code/artifact/683aa212-bdbf-4824-924d-52c268739d95`

O funil real do Tassis (e da maioria dos nutricionistas), na ordem:

1. **Consulta de sensibilização** — dentro do app. Ele explica a consultoria e entende a pessoa
   (hábitos, expectativa, contexto, objeções) e registra num **atendimento**. Pode não virar venda:
   nesse caso a pessoa fica como **lead** com histórico e data de retomada.
2. **Gera o link** a partir do lead, escolhendo qual `professional_plans` está vendendo.
3. **Paciente paga** — hoje manual, automatizado na Fase 2 do roadmap.
4. **Anamnese** — formulário público por token, sem login. As seções mudam conforme o plano
   (nutrição / treino / ambos).
5. **App cria a conta** — perfil + anamnese + **assinatura** + costura do lead/atendimentos.
6. **Espera de ~2 dias** — a home tem que dizer isso, não mostrar vazio.
7. **Profissional monta** treino e dieta, vendo anamnese + suas notas da consulta.
8. **Publica** — só então o paciente vê.

### Sensibilização ≠ anamnese

São dois formulários distintos, não um partido em dois. Sensibilização é qualitativa e serve pra
vender/conhecer; anamnese é dirigida e alimenta o cálculo do plano. Na tela do profissional as duas
aparecem juntas.

### ✅ Corrigido em 03/set: convite agora cria a assinatura

`finalizar_cadastro_convite()` criava `profiles` + `anamnese` e fechava o convite, mas **não
inseria em `subscriptions`** — e como a RLS multi-tenant exige assinatura ativa
(`is_professional_of`), o profissional não enxergava o paciente que acabou de cadastrar.

Migração `20260903_convite_cria_assinatura.sql`:
- adiciona `convites.plan_id` (FK → `professional_plans`) — o convite passa a carregar qual produto
  foi vendido, que é o que vai definir as seções da anamnese e os módulos liberados;
- a função passa a inserir em `subscriptions` (paciente, `created_by` do convite, plano, `'ativa'`).

**Detalhe que não pode ser "simplificado" depois:** a proteção contra duplicata usa
`not exists (patient_id, professional_id)` em vez de `ON CONFLICT`. O índice único inclui `plan_id`
e no Postgres NULLs são distintos entre si — com plano nulo, `ON CONFLICT` deixaria chamadas
repetidas empilharem assinaturas.

Verificado por simulação completa em transação com rollback (auth user novo → convite → RPC):
assinatura criada com plano, perfil preenchido, anamnese gravada, convite concluído, o profissional
enxerga tudo (`is_professional_of` = true) e a segunda chamada não duplica.

⚠️ O status nasce `'ativa'` porque hoje o pagamento é confirmado manualmente antes do link ser
enviado. Quando a Fase 2 (cobrança) entrar, quem define o status é a integração.

### Restrições do banco que moldam esse desenho

- `profiles.id` é **FK para `auth.users`** e a policy de insert exige `id = auth.uid()` → é
  impossível o profissional criar o registro do paciente antes da conta existir. Por isso lead e
  atendimento precisam de tabelas próprias, com `client_id` nulo até a conta nascer.
- `profiles.role` tem CHECK que só aceita `client` | `trainer` → separar nutricionista de educador
  físico (Fase 5) exige alterar a constraint.
- `plans` e `planos_alimentares` não têm estado de publicação → hoje o aluno vê o plano no instante
  em que é salvo. Precisa de rascunho vs. publicado antes do primeiro paciente real entrar.

## 13. Check-in recorrente (prints do Live Clean, 03/set)

Prints em [`docs/referencias/`](docs/referencias/) — 5 das 23 perguntas do check-in que o Tassis
usa hoje no Live Clean (`patient.liveclin.com`).

**Correção de modelagem:** o §12 tratava atendimento e check-in como a mesma coisa. Não são.

| | Quem preenche | Formato | Natureza do dado |
|---|---|---|---|
| **Atendimento** | o profissional | notas da consulta | evento, texto |
| **Check-in** | o paciente | questionário de 23 perguntas | **série temporal** |

### Perguntas mapeadas (8 de 23)

| # | Categoria | Tipo |
|---|---|---|
| 1 | Peso corporal | número (kg, em jejum) |
| 2 | Disposição durante o dia | escolha, 5 opções com emoji |
| 3 | Desempenho em exercícios | escolha, 5 opções com emoji |
| 4 | Horas de sono | escala 1–10 ("Pouco" → "Muito") |
| 5 | Qualidade do sono | escolha, 5 opções com emoji |
| 6 | Aderência ao plano | escolha, 4 opções + **follow-up condicional** |
| 7 | Refeições fora do plano | escala **0–9** ("Nenhuma" → "9 ou mais") |
| 8 | Pular refeições | escolha, 3 opções sem emoji |

### O template não é uma lista plana

A pergunta 6 revela um campo de texto quando o paciente escolhe certas opções
("Perfeito! Quais são as suas dificuldades?"). O motor precisa suportar **revelação
condicional por opção**, não só uma sequência. Construir como lista plana obriga a refazer.

Outras variações que o modelo tem que cobrir:
- **Escalas não são padronizadas**: sono é 1–10, refeições fora do plano é 0–9. Mínimo, máximo e
  rótulos das pontas são configuráveis por pergunta.
- **Emoji é opcional por opção**: perguntas 6 e 8 são texto puro.

### Aderência é o eixo, não um detalhe

Três das oito perguntas vistas (6, 7, 8) medem se o plano está sendo seguido. O check-in é
principalmente instrumento de aderência. A tela do profissional deve tratar aderência como métrica
de primeira ordem — não enterrada no meio das 23 respostas.

### Guardar como ordinal, não como texto

As escalas precisam ser gravadas pela **posição** (1–5, 1–10). Rótulo ("Geralmente disposto(a)") e
emoji são apresentação. Se gravar o texto, perde-se a possibilidade de plotar tendência entre
check-ins — e a tendência é o produto todo: é ela que sustenta o dashboard de acompanhamento
previsto no §2.

### Padrão de UX que faz o paciente terminar

Uma pergunta por cartão, contador de progresso (`4/23`), categoria nomeada com ícone, foto e nome do
profissional no topo, resposta em um toque. Vinte e três campos numa página única seriam
abandonados — o formato de cartão é o que faz o volume de perguntas caber. Copiar o formato, não o
visual (a identidade é a do §1).

**Pendente do Tassis:** as outras 18 perguntas.
