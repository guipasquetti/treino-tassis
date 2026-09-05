# App Treino — Handoff

> Documento de contexto para replicar o estado do projeto em outro chat.
> Última atualização: 05/Setembro/2026.

> **Fonte canônica:** este arquivo, na raiz do repositório. Todo agente (Codex ou Claude) deve lê-lo antes de alterar o projeto e atualizá-lo ao concluir mudanças relevantes, decisões, migrações, configuração de infraestrutura ou bloqueios.

---

## 0. Princípio obrigatório: segurança e LGPD

⚠️ **Decisão do Guilherme (04/set), inegociável:** segurança e conformidade LGPD são lente
padrão em **toda** decisão de arquitetura/escopo deste projeto — não só quando alguém pedir
explicitamente. O banco guarda dado sensível de saúde (anamnese: condição médica,
medicamento, cirurgia, alergia; fotos de corpo previstas no check-in do §13; métricas
corporais). Antes de propor ou construir qualquer feature/tabela/RPC nova, checar:

- **Quem lê esse dado?** RLS cobre o caso, ou fica exposto a mais gente que deveria?
- **Cria superfície pública nova?** (ex.: link de anamnese por token, hoje sem login —
  já é um risco conhecido, ver §14)
- **Tem base legal?** Lead/atendimento capturando nota de saúde antes de qualquer
  consentimento é exatamente o tipo de lacuna que já foi identificada no funil (§12/§14) —
  não introduzir uma nova sem perceber.
- **Cruza fronteira?** Residência de dados em `us-east-1` já é transferência internacional
  sob a LGPD — decisão registrada em §14, não reabrir sem novo cálculo de custo.

Isso não significa travar todo trabalho de feature até existir termo/advogado — significa que
toda mudança relevante anota o ângulo de segurança/LGPD aqui no handoff, pra não ficar
esquecido em silêncio.

✅ **Primeira aplicação prática (04/set):** rodado `get_advisors(security)` do Supabase como
baseline. Achado real corrigido: `handle_new_user()` — o trigger interno que cria o profile
no signup — estava exposto como RPC pública (`anon`/`authenticated`/`PUBLIC` tinham
`EXECUTE`), sem necessidade nenhuma (é `RETURNS trigger`, só roda via `on_auth_user_created`).
`REVOKE EXECUTE` de `anon`, `authenticated` e `PUBLIC`; sobrou só `postgres`/`service_role`.
Também revogado `EXECUTE` de `anon` (mantido pra `authenticated`, que a RLS usa de verdade)
nos 4 helpers `is_trainer()`/`is_professional()`/`is_professional_of()`/`is_client_of()` —
não são chamados por nenhuma função pública (`obter_convite`/`submeter_anamnese`/
`finalizar_cadastro_convite`, conferido no código-fonte) e `anon` não tem motivo pra invocar.
Verificado depois: app recarregado com sessão real (Tassis) continua lendo dado normal — RLS
pra usuário autenticado não foi afetada, porque `REVOKE` em função não interfere na execução
de trigger nem na avaliação de policy pelo dono/definer.

⚠️ **Ainda aberto no advisor** (aceito, já era conhecido): os 3 RPCs do fluxo de convite
(`obter_convite`, `submeter_anamnese`, `finalizar_cadastro_convite`) continuam
`anon`-chamáveis por design — é o fluxo de token sem login. E os 4 helpers continuam
`authenticated`-chamáveis por design — é o que a RLS usa. **Novo, não corrigido:** "Leaked
Password Protection" desligada no Auth — Supabase checaria senha contra HaveIBeenPwned.
Fica de fora do MCP (é config de dashboard); ligar em Authentication → Policies → Password
Security quando alguém for mexer lá.

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
- Dashboard pro profissional sinalizando picos de ansiedade/fome via notificações — a versão
  de check-in disso ainda não existe; um painel de gestão mais simples (sem esse sinal
  específico) já existe, ver §8
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
| Backend | Supabase (Postgres + Auth + RLS + Storage, desde 04/set — bucket privado `documentos-profissionais`) |
| Upload de arquivo | `expo-document-picker` (desde 04/set — carteirinha de CREF/CRN) |
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

| Tabela | Papel | Linhas (04/set) |
|---|---|---|
| `profiles` | conta (trainer/client), dados físicos (peso/altura) | 2 |
| `professionals` | tenant — profile que virou profissional (`especialidade`) | 1 |
| `professional_plans` | produtos que um profissional vende (`inclui_dieta`/`inclui_treino`, preço) | 1 (backfill "Padrão (migração)") |
| `subscriptions` | vínculo real paciente↔profissional↔plano, com `status`; `plan_id` (confirmado pelo profissional) e `plano_solicitado_id` (pedido pelo paciente, 04/set) | 1 |
| `plans` | plano de treino por período (`dias` jsonb), agora com `professional_id` | 1 |
| `workout_logs` | séries executadas e finalizadas por dia/exercício | 32 |
| `workout_drafts` | autosave do treino em andamento antes de virar log | 2 |
| `anamnese` | questionário de saúde, 1:1 por cliente, **compartilhado entre profissionais** (decisão 02/set) | 1 |
| `planos_alimentares` | plano alimentar (metas de macro + `refeicoes` jsonb), agora com `professional_id` | 1 |
| `alimentos_taco` | tabela TACO de composição de alimentos (referência, seed) | 597 |
| `convites` | onboarding: token → aluno responde → vira profile (§16, §8) | 0 |
| `teleconsultas` | agenda de teleconsultas por Google Meet, RLS própria (§8) — 04/set | 0 |
| `leads` | passo 1 do funil (§12): pré-conta, sem `profiles.id` ainda | 0 |
| `atendimentos` | registro de cada consulta (pendura em lead ou em cliente já existente) | 0 |
| `professional_verificacoes` | CPF/CREF-CRN/documento/status de verificação — nunca em `professionals`, que já é lido pelos pacientes (04/set) | 0 |

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
- `obter_convite(p_token)` — lê nome/e-mail/status do convite pelo token
- `submeter_anamnese(p_token, p_respostas)` — **legado desde 04/set**: gravava anamnese
  ANTES da conta existir; ninguém mais chama isso no client (anamnese agora é pós-login,
  ver `submeter_anamnese_autenticado`), mas a função continua no banco, inofensiva
- `finalizar_cadastro_convite(p_token)` — fecha convite → cria `profiles` + `subscriptions`
  (`plan_id` nulo); desde 04/set não lê mais `convites.respostas` (anamnese saiu daqui)
- `submeter_anamnese_autenticado(p_respostas, p_plano_id)` — **novo, 04/set**: paciente
  autenticado grava a própria anamnese + `subscriptions.plano_solicitado_id`, dentro do app

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
    _layout.tsx               Stack raiz: auth, tema dark, correção de área por papel,
                               exceção pra rota pública /convite (não é redirecionada)
    index.tsx                 rota "/": decide login vs /aluno vs /pro (declarativo)
    login.tsx                 tem link pra /cadastro-profissional (04/set)
    cadastro-profissional.tsx PÚBLICA, top-level — cadastro de profissional com verificação
                               de CREF/CRN (04/set, ver §8)
    admin.tsx                 fila de verificação — só pra quem tem profiles.is_admin (04/set)
    convite/[token].tsx       PÚBLICA, sem login — só criação de conta (04/set; anamnese
                               saiu daqui, ver §8/§12)
    aluno/                    área do ALUNO (abas: Treino · Dieta · Perfil)
      _layout.tsx              gate de onboarding (sem anamnese → OnboardingAnamnese, com
                               anamnese → Tabs) + index.tsx (treino)  dieta.tsx  perfil.tsx
    pro/                      área do PROFISSIONAL (abas: Painel · Leads · Planos · Perfil)
      _layout.tsx
      index.tsx               Painel: placar, pedidos de plano, alertas, agenda de
                               teleconsultas, lista de alunos — tudo numa tela (§8)
      leads.tsx                leads + atendimentos (§12) — aba, 04/set
      planos.tsx               CRUD de professional_plans
      perfil.tsx
      convite.tsx              gera link de convite a partir de um lead (não é aba — href:null)
      aluno/[id]/index.tsx     editor de plano de treino (não é aba — href:null)
      aluno/[id]/dieta.tsx     editor de plano alimentar (não é aba — href:null)
  theme/index.ts              design system (paleta, spacing, radius, cores por treino)
  components/
    ui/index.tsx              Screen, Card, Button, Field, Pill, Stat, Caption...
    perfil-screen.tsx         perfil compartilhado pelos dois papéis
    onboarding-anamnese.tsx   anamnese + escolha de plano, dentro do app (04/set, §12)
  models/
    database.types.ts         gerado do schema Supabase
    domain.ts                 tipos dos jsonb + helpers (formatarSet, somaMacros,
                               formatarDataHora...)
    anamnese.ts                schema do formulário de anamnese (10 seções, 56 campos) —
                               respondido dentro do app desde 04/set, não mais por token
  services/                   1 arquivo por domínio
    authService.ts  workoutService.ts  nutritionService.ts  professionalService.ts
    conviteService.ts  teleconsultaService.ts  gestaoService.ts  leadsService.ts
    solicitacoesService.ts   pedido de acesso pra quem já tem conta (04/set)
    onboardingService.ts      anamnese + plano pós-login (04/set)
    verificacaoService.ts     cadastro/upload/aprovação de profissional (04/set)
  store/authStore.ts          zustand (sessão, profile, isProfessional)
  lib/supabase.ts             client tipado (com guard de SSR, ver §8)
```

**Rotas são segmentos explícitos (`/aluno`, `/pro`), não route groups.** Foi tentado com
grupos `(client)`/`(pro)` e os dois `index.tsx` disputavam a rota `/` — resultado era
"Unmatched Route". Não voltar pra grupos sem resolver essa colisão.

**Todo arquivo novo em `src/app/pro/` vira aba automaticamente**, a menos que ganhe
`<Tabs.Screen name="..." options={{ href: null }} />` explícito em `pro/_layout.tsx` — já
mordeu duas vezes (`convite.tsx`, extinto `agenda.tsx`), ver §8.

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

⚠️ **E-mail: a causa raiz não é rate limit** (investigado em 03/set, corrige o diagnóstico
anterior). A [documentação do Supabase](https://supabase.com/docs/guides/auth/auth-smtp)
diz que o SMTP padrão **só entrega para endereços que são membros da organização**:

> *"Unless you configure a custom SMTP server for your project, Supabase Auth will refuse to
> deliver messages to addresses that are not part of the project's team."*

Ou seja, o provedor padrão **nunca** entregaria e-mail a um paciente, nem com volume baixo.
Os erros que vimos (`connection_failed` no reset de senha, `over_email_send_rate_limit` no
signup) eram sintoma; a causa é que essa via não serve para o caso de uso. Ver §16.

## 8. Estado atual

- Histórico do início do projeto (scaffold Expo renomeado, rotas provisórias em grupo
  `(app)`, primeiros commits sem remote) — tudo isso foi substituído já na v1 utilizável
  (02/set, ver abaixo) e não descreve mais o estado do código. Mantido só o gotcha real:
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
  - **Profissional · Alunos** — tela original, contagem total/ativos/inativos e card por
    aluno com plano/status/dias desde o último treino (sinaliza quem sumiu há 7+ dias — a
    dor de "quem não responde" do §2). ⚠️ **Fundida no Painel em 04/set** — o conteúdo desse
    bullet hoje mora em [`src/app/pro/index.tsx`](src/app/pro/index.tsx) junto com Agenda,
    ver a entrada "Painel de gestão" mais abaixo, que é a descrição atual.
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
- ✅ **Os dois lados vistos com login real (03–04/set)**: `expo start --web`, conta do
  Guilherme (aluno do Tassis) e conta do próprio Tassis (profissional) — as 6 telas
  (Treino/Dieta/Perfil do aluno, Alunos/Planos/Perfil do profissional) renderizam com dado
  de produção batendo com §5/§11.
- ✅ **Bug encontrado e corrigido (04/set):** [`src/app/aluno/index.tsx`](src/app/aluno/index.tsx)
  e [`src/app/pro/planos.tsx`](src/app/pro/planos.tsx) usavam `user!.id` direto no JSX sem
  guardar contra `user` nulo. Se a sessão trocar (sign-out → sign-in de outro papel) com a
  tela ainda montada na mesma aba, o estado local (`data`/`planos`) ficava com o resultado
  antigo enquanto `user` já tinha virado `null` por um instante — quebrava com
  `Cannot read properties of null (reading 'id')`. Reproduzido ao logar como aluno, depois
  como Tassis, sem reload de página. Não afetava login direto (a rota `/` só redireciona
  depois de `profileLoaded`), mas era risco real em device compartilhado ou troca de conta
  na mesma aba. Corrigido nas duas telas: `useEffect` reseta o estado quando `user` vira
  `null`, e o guard de render (`if (loading || !user) return <Loading />`) cobre o resto.
  Verificado: typecheck limpo (`npx tsc --noEmit`) + 4 reloads seguidos sem erro no console.
- ✅ **Editor de plano de treino** ([`src/app/pro/aluno/[id].tsx`](src/app/pro/aluno/%5Bid%5D.tsx)):
  tocar num aluno na lista abre o editor — dias (tipo, grupos musculares), exercícios,
  séries, faixa de reps, warm/feeder, flags cronometrado/ombro. Preserva ids (ver §11).
- ✅ **Formulário público de anamnese por token** ([`src/app/convite/[token].tsx`](src/app/convite/%5Btoken%5D.tsx),
  04/set): sem login, uma página só (sem wizard, sem campo obrigatório) — fiel ao protótipo
  (`prototype/index.html`, `PERGUNTAS_ANAMNESE`), 10 seções, 56 campos, mesmos `id`s exatos
  (schema em [`src/models/anamnese.ts`](src/models/anamnese.ts), porque `finalizar_cadastro_convite`
  lê algumas chaves por nome). Fluxo: `obter_convite` → formulário → `submeter_anamnese` →
  tela de criar senha → `signUp` → `finalizar_cadastro_convite` → `/aluno`. RPCs embaladas em
  [`conviteService.ts`](src/services/conviteService.ts). `src/app/_layout.tsx` ganhou exceção
  pra rota `/convite` não ser redirecionada pelo guard de auth (ela cuida da própria
  navegação, inclusive no instante entre `signUp` e `finalizar_cadastro_convite`).
  **Testado ponta a ponta até a etapa de senha** com convite de QA criado via SQL e apagado
  depois — carrega convite real, grava respostas (só as preenchidas, confirmado no banco),
  avança pra tela de senha com e-mail certo, e trata token inexistente ("Link indisponível").
  **Não testado a criação de conta em si** (`signUp`/`finalizar_cadastro_convite`) — entra na
  regra de não criar contas mesmo em ambiente de teste; confere quando o Tassis mandar um
  convite de verdade.
  ⚠️ Lente de segurança/LGPD (§0) aplicada: nada das respostas é persistido fora do Supabase
  (sem AsyncStorage) — só o necessário roda no estado do componente. Senha mínima subida pra
  8 caracteres (era 6 no protótipo). Mantido como risco aceito e já documentado (§16): RPCs
  públicas sem CAPTCHA/rate limit, token sem TTL — não é bloqueador pro piloto, mas fica
  registrado.
- ✅ **Tela do profissional que gera o convite** ([`src/app/pro/convite.tsx`](src/app/pro/convite.tsx),
  04/set): nome + e-mail + escolha de `professional_plans` ativo (Pill), acessível pelo botão
  "+ Convidar" em Alunos. `criarConvite()` em [`professionalService.ts`](src/services/professionalService.ts)
  insere direto em `convites` (RLS já cobre: `created_by = auth.uid()`), sem precisar de RPC.
  **Token passou a ser gerado no banco**, não no client — migração
  [`20260904_convite_token_default.sql`](supabase/migrations/20260904_convite_token_default.sql)
  (`gen_random_uuid()` como default da coluna `token`); motivo: `crypto.randomUUID()` não é
  garantido em todo runtime React Native, gerar no Postgres é mais forte e não depende do
  client. `database.types.ts` regenerado depois da migration (sempre necessário, ver §5).
  ⚠️ Gotcha de roteamento encontrado: qualquer arquivo dentro de `src/app/pro/` vira aba
  automaticamente no `<Tabs>` do `pro/_layout.tsx` — `convite.tsx` apareceu como 4ª aba até eu
  adicionar `<Tabs.Screen name="convite" options={{ href: null }} />`, mesmo padrão já usado
  pra `aluno/[id]`. **Testado ponta a ponta com dado real** (convite de QA criado pela própria
  tela, aberto o link gerado, chegou na anamnese certa, depois apagado do banco).
- ✅ **Agenda de teleconsultas por Google Meet** (04/set — nasceu em `pro/agenda.tsx`, depois
  fundida em [`src/app/pro/index.tsx`](src/app/pro/index.tsx), ver entrada do Painel abaixo).
  Escolhe aluno, data, hora, cola o link do Meet (gerado à
  parte em `meet.google.com/new` — decisão explícita de não integrar via OAuth com Google
  Calendar por ora, ver abaixo) e observações opcionais; marca depois como realizada/cancelada
  (sem policy de delete — histórico preservado, mesma lógica de nunca sobrescrever do §14).
  Tabela `teleconsultas` + RLS em
  [`20260904_teleconsultas.sql`](supabase/migrations/20260904_teleconsultas.sql) (paciente lê
  a própria, profissional lê/edita as que criou, `is_professional_of` barra agendar pra
  paciente de outro profissional). `teleconsultaService.ts` novo. Aluno vê a próxima consulta
  (data/hora + botão "Entrar na chamada") no [`perfil-screen.tsx`](src/components/perfil-screen.tsx)
  compartilhado. **Testado ponta a ponta**: criado, apareceu na agenda, RLS simulada por JWT
  confirma que o paciente certo vê e um usuário aleatório não vê nada — depois apagado do
  banco. `get_advisors(security)` rodado depois da migration: nenhum warning novo.
  ⚠️ Gotcha de roteamento repetido: `agenda.tsx` também precisou de `<Tabs.Screen>` explícito
  em `pro/_layout.tsx` (mesmo motivo do `convite.tsx` acima) — **todo arquivo novo em
  `src/app/pro/` que não for uma aba de verdade precisa de `href: null` no layout, ou vira
  aba fantasma sozinho.**
  📌 **Decisão registrada (04/set):** vídeo em si nunca passa pelo Supabase/app — só a URL do
  Meet é armazenada, gerada fora do app pelo profissional. Integração real com Google Calendar
  (OAuth por profissional, evento + link automáticos) foi avaliada e adiada de propósito:
  exigiria projeto Google Cloud, tela de consentimento OAuth e guardar `refresh_token` com
  segurança (dado de credencial, novo tipo de risco) — descartado por ora em favor da versão
  mais simples e com menos superfície de segurança nova (§0).
- ✅ **Painel de gestão** ([`src/app/pro/index.tsx`](src/app/pro/index.tsx), 04/set). Resposta
  a "existe uma visão consolidada dos pacientes?" — não existia, estava fragmentada em §2
  (dashboard de ansiedade/fome, F4, não iniciada) e F1b (tendência do check-in, também não
  iniciada). Esta é a versão que dá pra construir agora, **sem tabela nova** — só agrega o que
  já existe: placar (total/ativos/sem plano/sem treino 7d+/convites pendentes), "Atenção
  necessária" (sem treino há 7+ dias, sem nenhum plano montado, sinal de saúde não-vazio na
  anamnese — `condicoes_medicas`/`lesoes_dores`), agenda de teleconsultas completa (com ações
  Entrar/Realizada/Cancelar + form de agendar) e lista de todos os alunos com indicador
  Treino/Dieta montados ou não. `gestaoService.ts` (`obterPainelGestao`), reaproveita
  `listarAlunos` e `listarAgenda` já existentes.
  ✅ **Fundido em uma tela só (04/set, mesmo dia):** o Painel nasceu como 5ª aba separada de
  Alunos e Agenda; a pedido do Guilherme, as três foram **unificadas em `pro/index.tsx`** —
  "por enquanto", ele mesmo marcou, então pode voltar a separar se a lista de alunos ou a
  agenda crescerem demais pra caber numa tela só. `pro/painel.tsx` e `pro/agenda.tsx` foram
  apagados (conteúdo migrado, nada ficou duplicado); o app do profissional agora tem **3
  abas**: Painel, Planos, Perfil. `pro/_layout.tsx` simplificado de volta.
  `PainelGestao.proximasConsultas` (top 5, só agendadas) virou `PainelGestao.agenda` (lista
  completa, todos os status) porque a tela fundida precisa das ações de status, não só leitura.
  **Testado com dado real** do Tassis nas duas versões (separada e depois fundida): placar
  bateu (1/1/0/0/0), contador de convites pendentes reagiu a um convite de teste criado e
  apagado via SQL (0→1→0), form de agendar teleconsulta abre inline sem sair da tela, zero
  erro de console numa aba nova e limpa. RLS não muda — cada query já usa as policies
  existentes (`is_professional_of`, `professional_id = auth.uid()`), o painel só lê o que o
  profissional já podia ver espalhado nas outras telas.
- ✅ **Editor de dieta** ([`src/app/pro/aluno/[id]/dieta.tsx`](src/app/pro/aluno/%5Bid%5D/dieta.tsx)):
  metas de macro do dia, refeições, itens vindos da busca TACO (macros calculados a partir
  do valor por 100g) ou item livre. Detalhe do aluno agora tem duas telas com alternador
  (Treino | Dieta).
- ✅ **Editar `professional_plans` existente (04/set)**: `atualizarPlano()` em
  [`professionalService.ts`](src/services/professionalService.ts) + botão "Editar" no card
  em [`pro/planos.tsx`](src/app/pro/planos.tsx), reaproveitando o form de criação
  (`PlanoForm` compartilhado). Testado ponta a ponta com a conta real do Tassis: editou
  preço, salvou, refletiu no card — depois revertido via SQL pra não deixar dado de teste
  em produção. Falta ainda o editor de substituições de alimento (as existentes são
  preservadas e exibidas, mas não dá pra criar/remover pela tela).
- ✅ **Leads e atendimentos** ([`src/app/pro/leads.tsx`](src/app/pro/leads.tsx), 04/set) — passo 1
  do funil (§12), a consulta de sensibilização antes de qualquer convite. Nova aba "Leads" no
  `pro/_layout.tsx`. `leads` (nome/telefone/email, `status` lead|convertido|perdido,
  `data_retomada`, `observacoes`) e `atendimentos` (nota de cada consulta, pendurada em
  `lead_id` ou `client_id` — `atendimentos_alvo_check` exige pelo menos um) em
  [`20260904_leads_atendimentos.sql`](supabase/migrations/20260904_leads_atendimentos.sql),
  `leadsService.ts` novo. RLS igual a `professional_plans_write`: só o dono
  (`professional_id = auth.uid()`) mexe — não usa `is_professional_of()` porque, por
  definição, ainda pode não existir assinatura nenhuma. Restrição do §12 respeitada: lead
  não tem `profiles.id`, por isso vive em tabela própria com `client_id` nulo até converter.
  **"Gerar convite" a partir de um lead** pré-preenche nome/e-mail
  (`pro/convite.tsx?leadId=...`) e grava `convites.lead_id`; `finalizar_cadastro_convite`
  (mesma RPC) ganhou um passo a mais: se o convite tem `lead_id`, marca o lead
  `convertido` e amarra o `client_id` recém-criado — sem isso o lead ficaria "aberto" pra
  sempre mesmo já sendo paciente pagante. `get_advisors(security)` rodado depois da
  migration: nenhum warning novo (mesma lista já aceita do §0).
  **Testado ponta a ponta com dado real** do Tassis: lead criado pela tela, atendimento
  registrado e listado com data/hora, convite gerado a partir do lead com nome/e-mail
  prefill confirmado via DOM (`value` do input, não só o texto), `convites.lead_id` ↔
  `leads.convite_id` batendo nos dois sentidos no banco. **A sincronização de conversão**
  (`finalizar_cadastro_convite` marcando o lead como `convertido`) foi verificada por
  simulação completa em transação com rollback (auth user novo → convite com `lead_id` →
  RPC → lead virou `convertido` com `client_id` certo → rollback), mesmo método já usado
  em 03/set pro `convites_cria_assinatura` — não criei conta de verdade, só simulei
  dentro de uma transação desfeita. Tudo o que passou pela tela (lead, atendimento,
  convite real) foi apagado do banco depois via SQL, nada de teste ficou em produção.
- ⚠️ **Tentativa revertida no mesmo dia: etapa de "contratação" com link de pagamento
  dentro do convite.** Implementei uma tela "Seu plano" (preço + botão "Pagar agora" com
  link de pagamento pasteado pelo profissional) antes da anamnese — **errado**, corrigido
  pelo Guilherme na hora: não existe link de pagamento nesse ponto do fluxo, e o convite
  ainda podia nascer "frio" (direto do Painel, sem ter passado pela call), quando na
  vida real o profissional não tem nome/e-mail/plano de ninguém antes da conversa
  acontecer. Revertido por completo: `20260904_reverter_convite_contratacao.sql` (dropa
  `convites.link_pagamento`, `obter_convite` volta a devolver só nome/e-mail/status).
  Migração `20260904_convite_contratacao.sql` fica no histórico só como registro do que
  foi tentado e desfeito — não aplicar de novo sem repensar.
- ✅ **Convite só nasce de um lead** (04/set, correção do ponto acima). Fluxo real, nas
  palavras do Guilherme: (1) lead recebe o link/convite **da call de sensibilização**
  (fora do app — Meet/WhatsApp, nada a persistir aqui, é antes de qualquer registro
  existir); (2) **durante** a call, profissional cria o lead + atendimento no sistema,
  já com o plano decidido na conversa (isso já existia, ver bullet de Leads acima); (3)
  se o cliente topa continuar, profissional gera **um único link** a partir do lead —
  só anamnese, sem etapa extra, sem pagamento em tela. `pro/convite.tsx` agora **exige**
  `?leadId=` — sem ele mostra "o convite parte de um lead" + botão pra Leads, não deixa
  preencher nome/e-mail às cegas. `criarConvite()` em
  [`professionalService.ts`](src/services/professionalService.ts) tornou `leadId`
  obrigatório (não é mais opcional). O atalho "+ Convidar" do Painel agora aponta pra
  `/pro/leads` (era `/pro/convite` direto) — não existe mais porta lateral que pule o
  lead.
  **Testado ponta a ponta**: `/pro/convite` sem lead mostra o aviso certo; lead criado →
  "Gerar convite" prefila nome/e-mail → convite salvo com `lead_id` correto no banco →
  link público abre direto na senha (sem tela de plano/pagamento no meio).
  `get_advisors(security)` conferido depois do revert: warnings idênticos aos de antes
  desse dia, nada novo. Tudo de teste apagado do banco depois.
  ⚠️ **Corrigido de novo, mesmo dia, ver bullet seguinte**: nem plano na tela de convite
  ficou certo — o Guilherme esclareceu que plano é escolhido pelo PACIENTE, dentro do
  app, depois de logar — não pelo profissional na hora de gerar o link.
- ✅ **Anamnese e escolha de plano migram pra dentro do app autenticado** (04/set, terceira
  correção do funil no mesmo dia). Descrição do Guilherme do fluxo real: o lead recebe o
  link **depois** da call de sensibilização já com conta pra criar (não anamnese pra
  preencher às cegas); cria a conta, entra, e SÓ ENTÃO responde a anamnese e escolhe o
  plano que quer comprar — tudo dentro do app, sem sair dele. O profissional revisa e
  decide se libera.
  - `pro/convite.tsx` voltou a ser só nome/e-mail (plano saiu de vez daqui).
  - `convite/[token].tsx` (link público) virou só "criar conta" — sem anamnese, sem
    formulário nenhum. `finalizar_cadastro_convite` foi simplificado: não lê mais
    `convites.respostas`/anamnese, só cria a `subscriptions` (`plan_id` nulo) e fecha o
    convite/lead.
  - **Onboarding novo dentro do app**: [`aluno/_layout.tsx`](src/app/aluno/_layout.tsx)
    checa se o cliente já tem `anamnese` (`possuiAnamnese`); se não tiver, mostra
    [`OnboardingAnamnese`](src/components/onboarding-anamnese.tsx) no lugar das abas —
    mesmas seções de sempre ([`models/anamnese.ts`](src/models/anamnese.ts)) + escolha de
    plano (`professional_plans` do profissional vinculado), tudo num envio só.
  - `subscriptions.plano_solicitado_id` (coluna nova) guarda o que o PACIENTE pediu —
    soft, não libera nada sozinho. `subscriptions.plan_id` continua sendo o que vale de
    verdade (hard) — só o profissional muda isso, confirmando no Painel
    ([`PedidoPlanoCard`](src/app/pro/index.tsx), seção "Pedidos de plano" — nova stat +
    lista com botão "Confirmar").
  - **RPC nova** `submeter_anamnese_autenticado(p_respostas, p_plano_id)`
    (`SECURITY DEFINER`, escopada em `auth.uid()`) grava a anamnese e o
    `plano_solicitado_id` — RLS **não deixa** paciente escrever direto em `anamnese` nem
    `subscriptions` (conferido antes de construir: só existe
    `anamnese_insert_professional`/`anamnese_update_professional` e `subscriptions_write`
    com `professional_id = auth.uid()`), então sem essa RPC o paciente poderia tentar
    setar o próprio `plan_id` e se auto-liberar — exatamente o que essa RPC evita ao só
    tocar em `plano_solicitado_id`, nunca em `plan_id`.
  - **RLS ajustada**: `professional_plans_select` não deixava o paciente ver os planos do
    próprio profissional antes de já ter um `plan_id` setado (ovo-e-galinha — precisava
    ver o plano pra pedir, mas só via depois de confirmado). Adicionado
    `is_client_of(professional_id)` como alternativa — mesmo critério já usado em outras
    tabelas, sem RLS nova de verdade.
  - Migrações: [`20260904_anamnese_pos_login.sql`](supabase/migrations/20260904_anamnese_pos_login.sql)
    (coluna + RPCs) e
    [`20260904_paciente_ve_planos_do_profissional.sql`](supabase/migrations/20260904_paciente_ve_planos_do_profissional.sql)
    (RLS). `get_advisors(security)` conferido depois de cada uma: só o warning padrão
    (RPC nova anon-chamável, mesma classe já aceita das outras) — nenhuma categoria nova.
  - **Testado ponta a ponta com dado real do Tassis**: lead → convite (só nome/e-mail) →
    link público → criar conta → onboarding aparece automaticamente (não as abas) →
    anamnese + plano enviados → `subscriptions.plano_solicitado_id` gravado certo →
    Treino/Dieta mostram "Aguardando confirmação do profissional" → confirmação simulada
    via transação com JWT do Tassis (mesma técnica de verificação já usada antes,
    `subscriptions_write` permitiu o update) → `plan_id` setado → reload → Treino/Dieta
    voltam a mostrar o estado normal ("ainda não montou plano"). Conta de teste e todo o
    resto apagados do banco depois — o lead real "Guilherme" (criado pelo próprio
    Guilherme) não foi tocado.
  - ⚠️ **Observado, não corrigido**: no primeiro carregamento do onboarding logo após o
    `signUp`, a lista de planos apareceu vazia por um instante (sessão ainda propagando
    pro client Supabase) — um reload resolveu, e o mesmo padrão de corrida já é conhecido
    (comentário em `authStore.ts` sobre por que o profile é carregado via `setTimeout`).
    Não implementei retry — se aparecer de novo em uso real, vale revisitar.
  - **Não testado pela UI**: o clique do botão "Confirmar" no Painel (`PedidoPlanoCard`)
    em si — a sessão do browser virou a do paciente de teste durante o teste (mesmo
    localStorage), e eu não tenho a senha real do Tassis pra logar de volta como
    profissional. A escrita subjacente (`update subscriptions set plan_id = ...`) foi
    verificada via simulação de JWT do Tassis, e o botão chama exatamente essa mesma
    chamada (`confirmarPlanoSolicitado`), no mesmo padrão já usado por
    `alternarPlanoAtivo`/`atualizarPlano`. Vale um clique manual de verificação quando o
    Tassis testar de novo.
  - **Simplificação aceita**: o gate de Treino/Dieta é tudo-ou-nada (`plan_id` nulo bloqueia
    os dois) — não olha `inclui_treino`/`inclui_dieta` do plano confirmado pra liberar só
    um dos dois. Registrado como gap, não implementado agora.
- ✅ **Convite reconhece conta existente** (04/set — resposta a "e se o paciente já for
  usuário do app, de outro profissional ou de antes?", com **duas correções de desenho no
  mesmo dia** antes de chegar na versão que ficou).
  - Cogitado busca por nome na base de usuários e **descartado** pela lente de segurança/
    LGPD (§0): exporia "essa pessoa é paciente do app" pra qualquer profissional, mesmo sem
    relação nenhuma com ela — vira diretório navegável de quem usa a plataforma.
  - Primeira tentativa: o link mostraria "Entrar" com a senha real de quem já tem conta.
    **Revertida no mesmo dia** — pedir a senha de uma conta existente dentro de um link
    mandado por outra pessoa tem exatamente a cara de phishing, e eu nunca testei essa parte
    (recuso terminantemente digitar senha de qualquer conta, inclusive a do próprio
    Guilherme, em qualquer campo — ver regras de segurança da sessão).
  - Segunda ideia (código alfanumérico gerado pelo profissional, trocado por sessão via
    `admin.generateLink`/`verifyOtp`) foi **cogitada e não implementada** — exigiria Edge
    Function nova (primeira do projeto) segurando a `service_role key`. Descartada pela
    ideia seguinte, mais simples e sem infra nova.
  - **Versão que ficou**: profissional não pede senha nem código de ninguém. Se o e-mail já
    tem conta, a pessoa simplesmente entra no app do jeito de sempre (login normal) e vê
    **dentro do app** um pedido pendente do novo profissional — aceita ou recusa, sem
    reautenticar nada. `convite/[token].tsx`, quando `contaExistente`, só diz "você já tem
    conta, entra pelo login" com um botão pra `/login` — nunca mostra campo de senha pra
    conta existente.
  - **RPCs novas** (`SECURITY DEFINER`, mesmo padrão de sempre): `obter_solicitacoes_pendentes()`
    devolve os convites `pendente` endereçados ao e-mail autenticado (`auth.uid()` →
    `auth.users.email`) — não é busca, só responde sobre o próprio e-mail de quem chama;
    `recusar_convite(p_token)` fecha o convite como `recusado` (checou que o e-mail bate,
    igual `finalizar_cadastro_convite`). "Aceitar" reaproveita `finalizar_cadastro_convite`
    sem nenhuma mudança — ele já só confere sessão-vs-e-mail-do-convite, indiferente a
    `signUp` ou `signIn`.
  - Precisou abrir o CHECK constraint de `convites.status` (só aceitava
    `pendente`/`preenchido`/`concluido`) pra incluir `recusado`.
  - **Novo componente** [`SolicitacoesPendentes`](src/components/solicitacoes-pendentes.tsx),
    gate em `aluno/_layout.tsx` **antes** do gate de anamnese: se há solicitação pendente,
    mostra ela no lugar das abas (e no lugar do onboarding); resolvida (aceita ou recusada),
    cai pro gate seguinte normalmente.
  - `obter_solicitacoes_pendentes` precisou de `coalesce(nullif(nome,''), 'Seu profissional')`
    — achado real: `profiles.nome` do próprio Tassis está vazio no banco (dado de produção,
    não causado por essa mudança), mesmo padrão de fallback já usado em `listarAlunos`.
  - `gestaoService.ts`: contagem de "convites pendentes" no Painel corrigida de
    `neq('status','concluido')` pra `eq('status','pendente')` — com `recusado` existindo
    agora, a versão antiga contaria recusa como pendência.
  - Migrações: [`20260904_convite_valida_conta_existente.sql`](supabase/migrations/20260904_convite_valida_conta_existente.sql)
    (`obter_convite` ganha `conta_existe`) e
    [`20260904_solicitacao_acesso_existente.sql`](supabase/migrations/20260904_solicitacao_acesso_existente.sql)
    (as duas RPCs novas + o CHECK). `get_advisors(security)` conferido depois de cada uma:
    nenhum warning de categoria nova, só a mesma classe já aceita (RPC `security definer`
    anon-chamável, inofensiva porque tudo é escopado em `auth.uid()`).
  - **Testado com dado real**: convite novo gerado (via SQL, direto — não tinha sessão do
    Tassis no browser) pro lead real do Guilherme (`gui.pasquetti@gmail.com`, que já tem
    conta). Abrir o link mostrou "Você já tem conta, Guilherme" + botão pro login, sem campo
    de senha nenhum. `obter_solicitacoes_pendentes` e `recusar_convite` verificados via
    simulação de JWT do próprio Guilherme, dentro de transação com rollback — não recusei o
    pedido de verdade, ele continua `pendente`, aberto pro Guilherme aceitar pela UI quando
    quiser (token `cd291a36-3f41-44fa-97a6-fec2a9bb5736`). **Não testado pela UI**: o login
    em si e a tela `SolicitacoesPendentes` renderizada de verdade — dependem de sessão real
    do Guilherme, que só ele pode fazer (nunca digito senha de ninguém, nem a minha).
  - ✅ **Corrigido depois do teste real do Guilherme (mesmo dia)**: a tela mostrou "Seu
    profissional" em vez do nome — achado real, não bug desta feature: `profiles.nome` do
    próprio Tassis estava **vazio no banco** (dado de produção, provavelmente porque o
    cadastro dele é anterior ao trigger que preenche `nome` a partir do metadata do
    `signUp`). Corrigido com o nome real dele, já existente em `plans.treinador` ("Tassis
    Moraes") — não inventado, só copiado de outro lugar que já guardava o dado certo.
    Pedido junto: mostrar a especialidade (Nutri x Treinador). `obter_solicitacoes_pendentes`
    ganhou a coluna `especialidade` ([`20260904_solicitacao_com_especialidade.sql`](supabase/migrations/20260904_solicitacao_com_especialidade.sql));
    `rotuloEspecialidade()` em [`solicitacoesService.ts`](src/services/solicitacoesService.ts)
    traduz o texto livre de `professionals.especialidade` (`personal_trainer` → "Educador
    físico", `nutricionista` → "Nutricionista") — valor desconhecido aparece como veio, não
    some. Card agora mostra "Tassis Moraes... Quer te acompanhar como Educador físico."
    Verificado via nova simulação de JWT do Guilherme (mesmo método, sem mexer no pedido
    real): nome e especialidade batendo.
    ⚠️ **Corrigido de novo (mesmo dia)**: grafia errada — é "Moraes", não "Morales". Copiei o
    erro de `plans.treinador`, que também estava errado; os dois foram corrigidos juntos.
- ✅ **Cadastro de profissional com verificação de CREF/CRN** (04/set — "não podemos abrir
  isso pra qualquer um se cadastrar, até porque isso pode virar mote de venda", decisão do
  Guilherme). Não existia NENHUM cadastro de profissional antes disso — o único profissional
  (Tassis) veio de backfill direto no banco (§5). Achado de segurança **antes** de construir
  (§0): a RLS de `professionals` (`professionals_insert_self`) deixava **qualquer usuário
  autenticado se auto-inserir como profissional**, sem checagem nenhuma — fechado nesta
  migração.
  - **Sem validação automática**: CONFEF (CREF) e CFN (CRN) não têm API pública — só consulta
    manual no site do conselho. Verificação é humana; o app só facilita (link direto pro site
    do conselho na tela do admin).
  - **Sem RBAC formal**: `profiles.is_admin` é uma flag simples, não um papel — hoje só o
    Guilherme (`gui.pasquetti@gmail.com`) tem `is_admin = true`. Formalizar múltiplos
    aprovadores agora seria estrutura sem uso.
  - **CPF e documento nunca em `professionals`**: essa tabela já é lida pelos próprios
    pacientes do profissional (`is_client_of`), então qualquer dado sensível ali vazaria sem
    motivo. Tabela nova `professional_verificacoes` — só o próprio profissional e quem é
    admin conseguem ler (`professional_verificacoes_select`).
  - **Fluxo**: [`cadastro-profissional.tsx`](src/app/cadastro-profissional.tsx) (rota pública
    top-level, whitelisted em `_layout.tsx` igual a `/convite`) coleta nome/e-mail/senha/CPF/
    especialidade/CREF-CRN+UF/carteirinha (`expo-document-picker`, instalado nesta mudança)/
    bio opcional → `signUp` → upload pro bucket privado `documentos-profissionais` (**primeiro
    uso de Storage no projeto**) → RPC `cadastrar_profissional` (cria `professionals` +
    `professional_verificacoes` status `pendente`, tudo num passo). Acesso já libera na hora
    (decisão do Guilherme: acesso liberado, aviso visível) — banner "Verificação pendente" no
    Painel ([`pro/index.tsx`](src/app/pro/index.tsx)) até um admin decidir.
  - **Tela de admin** [`admin.tsx`](src/app/admin.tsx) (rota top-level, também whitelisted —
    é ortogonal a aluno/profissional, um admin pode ser cliente de outro profissional ao
    mesmo tempo, caso do próprio Guilherme): lista pendentes, mostra CPF/registro/bio, link
    pro documento (URL assinada, 1h) e link direto pro site do conselho; Aprovar/Rejeitar
    (rejeitar pede motivo) grava via `update` direto — RLS (`professional_verificacoes_update_admin`)
    já garante que só admin escreve.
  - **Guard central testado de verdade**: profissional tentando setar o próprio status pra
    `aprovado` é **bloqueado pela RLS** (`professional_verificacoes_update_self` só aceita
    `with check status = 'pendente'`) — verificado com uma conta de teste tentando se
    auto-aprovar e recebendo `42501 new row violates row-level security policy`. É o ponto
    de segurança inteiro desta feature.
  - **RLS nova pro admin enxergar solicitações de gente sem vínculo nenhum**: `profiles` e
    `professionals` ganharam policy de SELECT pra `is_admin()` — sem isso o admin não
    conseguia ler nome/e-mail/especialidade de um candidato com quem ainda não tem relação
    nenhuma (mesma classe de problema do §12, "paciente vê planos do profissional" antes de
    ter assinatura). Escopo: só nome/e-mail/especialidade, nunca anamnese/saúde.
  - **Storage**: bucket privado, path sempre prefixado por `auth.uid()`
    (`{uid}/carteirinha.ext`). Policies de insert/update/select — **faltou delete** na
    primeira versão (nem o dono conseguia apagar o próprio documento pra reenviar), corrigido
    ainda no mesmo teste.
  - Migração [`20260904_cadastro_profissional_verificado.sql`](supabase/migrations/20260904_cadastro_profissional_verificado.sql).
    `get_advisors(security)` conferido depois: nenhuma categoria nova (só o padrão já aceito
    de RPC `security definer` anon-chamável).
  - **Testado ponta a ponta com dado real** (conta QA descartável): cadastro completo pela UI
    de verdade — nome/e-mail/senha/CPF/especialidade/CREF+UF/upload de documento real (o
    seletor de arquivo do Expo funciona em web) — gravou tudo certo no banco; banner
    "Verificação pendente" apareceu no Painel com Leads/Planos já liberados; aprovação
    testada via simulação de JWT do Guilherme como admin (RLS aceitou); tentativa de
    auto-aprovação bloqueada (acima). Conta de teste, documento no storage e tudo mais
    apagados depois — inclusive precisou da policy de delete que faltava.
  - ⚠️ **O pedido real do Tassis pro Guilherme** (§ imediatamente anterior, "Solicitação de
    acesso existente") **segue pendente**, sem eu tocar — a sessão do browser é do Guilherme
    de verdade e essa decisão (aceitar/recusar) é dele, não minha.
- Sem pagamento/cobrança automática ainda (schema tem `subscriptions.status`, mas nada
  muda esse status sozinho), sem contrato/LGPD.
- Toda migração de schema é versionada em `supabase/migrations/` (convenção: `AAAAMMDD_descrição.sql`,
  ver lista completa em §15). A primeira ([`20260902_...`](supabase/migrations/20260902_multi_tenant_professionals_subscriptions.sql))
  precisou ser aplicada manualmente via SQL Editor do Supabase — `apply_migration` do MCP foi
  bloqueado pelo classificador de auto mode do Claude Code naquela sessão. As seguintes
  (03/set e 04/set) foram aplicadas sem esse bloqueio via `execute_sql` do MCP — não é um
  bloqueio permanente, parece ter sido específico daquela chamada/sessão.
- ✅ **Campo de observação na série, vídeo do exercício, cor por perfil (05/set).** Três
  pedidos do Guilherme sobre a tela de treino + login, nesta ordem:
  - `SetLog` ganhou `obs?: string` ([`domain.ts`](src/models/domain.ts)) — campo opcional
    abaixo do registro de série em [`aluno/index.tsx`](src/app/aluno/index.tsx), mostrado nos
    chips de séries já registradas hoje. Não aparece no histórico de sessões passadas (só no
    dia corrente) — decisão de escopo pra não complicar a linha já compacta do histórico.
  - `Exercicio` ganhou `video?: string` (URL) — campo "Vídeo (URL)" no editor do profissional
    ([`pro/aluno/[id]/index.tsx`](src/app/pro/aluno/%5Bid%5D/index.tsx)) e botão "Ver vídeo"
    (`Linking.openURL`) na tela do aluno quando presente. Sem migração — os dois campos vivem
    dentro do jsonb (`workout_logs.sets` / `plans.dias[].ex[]`), schema não muda.
  - ⚠️ **Seletor de carga: três tentativas até a que ficou.** Pedido original era trocar o
    stepper +/- por "uma barra de arrastar". Tentativa 1: `DragSlider` com `PanResponder`
    próprio — sensibilidade ruim (`locationX` durante o move é relativo ao elemento embaixo do
    dedo NAQUELE instante, não ao track; trocado por `dx` acumulado desde o toque) e depois
    brigava com o `ScrollView` da tela. **Achado importante:** no web (react-native-web) o
    `ScrollView` é scroll **nativo do navegador**, não passa pelo `PanResponder` — nenhuma
    negociação de responder no JS o intercepta; só resolve com `touchAction: 'none'` (CSS) no
    elemento. Tentativa 2: `NumberRoll` (rolo horizontal com `ScrollView` + `snapToInterval`,
    sem gesto próprio — não brigava mais). **O Guilherme não gostou de nenhuma das duas**,
    pediu de volta o stepper igual ao de reps, só que com **segurar pra repetir o incremento**.
    Versão final: `StepperButton` ganhou `onPressIn`/`onPressOut` com `setTimeout` (delay
    400ms) + `setInterval` (120ms) — achado e corrigido um bug clássico de **closure velha**:
    o `setInterval` inicial chamava o `onPress` capturado no toque, então travava repetindo o
    mesmo incremento a partir do peso de quando o dedo pousou. Corrigido com uma ref
    (`onPressRef`) sempre atualizada via `useEffect`, lida a cada tick em vez do closure velho.
    `DragSlider`/`NumberRoll`/`snapPeso` foram removidos (mortos) — só sobrou `ajustarPeso`,
    igual a antes de toda essa exploração.
  - **Cor por perfil (aluno rosa, profissional azul)**, pedido separado do Guilherme:
    `RoleColors` ([`theme/index.ts`](src/theme/index.ts)) + `RoleThemeProvider`/`useRoleColor`
    ([`contexts/role-theme.tsx`](src/contexts/role-theme.tsx), novo). `Button`/`Pill` em
    [`ui/index.tsx`](src/components/ui/index.tsx) usam a cor do perfil como padrão quando
    ninguém passa `color=` explícito — não precisou caçar botão por botão. `aluno/_layout.tsx`
    e `pro/_layout.tsx` envolvem suas telas (+ tab bar ativa) no provider certo. Roxo ficou de
    fora do esquema de perfil de propósito — já é a cor do módulo Dieta (aba, botão "Salvar
    dieta"), não mexi nisso. Pontos que tinham rosa fixo dentro do profissional (aba do editor
    de aluno em [`aluno-tabs.tsx`](src/components/aluno-tabs.tsx), botão "Convidar" do Painel,
    link do convite, "Editar" em Planos) trocados pra `RoleColors.profissional` também.
  - **Login redesenhado** ([`login.tsx`](src/app/login.tsx)): botão "Sou profissional e quero
    me cadastrar" virou um switch de 2 pills ("Aluno" | "Profissional", centralizado, cor muda
    ao trocar) + link em texto puro "Não tem cadastro? Criar conta" **fixo nas duas abas** (só
    a cor acompanha o modo) apontando pro `/cadastro-profissional` de sempre — login em si
    continua o mesmo `signIn()` pros dois perfis, a troca é só visual. Tentativa de efeito de
    corte diagonal 45° entre os dois lados (via `skewX`) foi feita e **descartada** — o
    Guilherme não gostou, voltou pro switch de pills simples.
  - **Nada disso está commitado ainda** — está tudo só no working tree. O que está no
    `origin/main` e no ar em `app-treino.expo.app` é só até o commit `f50fdbe` (observação de
    série + vídeo do exercício + primeira versão do `DragSlider`, sem os pontos acima).
- 📌 **Decisão sobre TestFlight (Guilherme, 05/set):** ele já tem conta Apple Developer paga
  (não é mais bloqueio de custo), mas decidiu esperar definir **nome/marca** antes de subir —
  "Definindo nome e marca vamos para o testflight". Até lá segue só no link web de produção.
  Mesmo com a conta, falta todo o setup técnico: bundle ID, EAS Build, credenciais de
  assinatura — nada disso existe no projeto ainda (ver §10, item 8). Também sugeri usar
  `eas deploy` sem `--prod` pra ter uma URL de preview estável e separada da produção pros
  testadores, sem tocar nos pacientes reais do Tassis — o Guilherme preferiu não fazer isso
  agora também, mantendo tudo como está até a marca fechar.

## 9. Escopo funcional v1 (proposto, não implementado)

Tabela abaixo é por par paciente↔profissional (já reflete o modelo N:N do §1/§5).

| Módulo | Aluno | Treinador |
|---|---|---|
| Onboarding | aceita convite, anamnese, cadastro | gera convite, acompanha status |
| Treino | vê plano do dia, registra séries (draft→log), histórico | monta plano por período, edita dias/exercícios |
| Nutrição | vê plano alimentar, busca alimento TACO | monta plano, define metas macro |
| Perfil | dados pessoais, peso/altura | lista de alunos, progresso agregado |

## 10. Próximos passos

1. ✅ **Feito em 03/set:** cadastro de paciente destravado (ver §16) — confirmação de e-mail
   desligada e URLs de retorno configuradas. SMTP próprio fica para quando o domínio existir —
   e domínio depende da marca (§7).
2. ✅ **Home confirmada visualmente em 03–04/set**, os dois lados, com login real
   (`expo start --web`): Aluno (Treino/Dieta/Perfil) e Profissional (Alunos/Planos/Perfil,
   login do próprio Tassis) — dado de produção batendo com §5/§11. Achado no processo, ver
   bug abaixo em §8.
3. Telas de treino/nutrição além da home: registrar série (draft→log), montar/editar
   plano (treinador), ver plano alimentar completo, buscar TACO.
4. ✅ **Feito em 04/set:** CRUD de `professional_plans` completo (criar, editar, ativar/
   desativar). Falta ainda gestão de `subscriptions` (cancelar/reativar aluno) — hoje só
   nasce via `finalizar_cadastro_convite`, sem tela pra mudar depois.
5. ✅ **Feito em 04/set, dos dois lados:** tela pública de anamnese por convite (§8, lado
   paciente) + tela do profissional pra gerar o link (§8, lado profissional). O funil do §12
   fecha ponta a ponta agora: profissional convida → paciente preenche anamnese → cria conta
   → assinatura nasce → aparece na lista do profissional. Falta só automação de pagamento
   (Fase 2, fora de escopo agora) e leads/atendimentos (item ainda não iniciado, sem
   depender do Tassis pra começar).
6. ~~Tela de cadastro (`signUp`)~~ — coberta pelo fluxo de convite do item 5. Cadastro
   direto (fora de convite) segue não previsto pelo produto — Tassis sempre inicia o vínculo.
7. Remover a tela de exemplo restante do scaffold (`(app)/explore.tsx`) quando o fluxo
   real substituir.
8. Configurar EAS Build quando for hora de buildar pra iOS/Android de verdade (hoje só roda
   via `expo start --web`/Expo Go). Guilherme já tem conta Apple Developer paga (05/set) —
   não é mais bloqueio de custo — mas decidiu esperar nome/marca (§7) antes de começar; falta
   todo o setup técnico (bundle ID, build profile, credenciais de assinatura), nada disso
   existe no projeto ainda.
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

### Estado de implementação por passo (04/set — ordem real, terceira versão no mesmo dia)

A ordem mudou de verdade nesta última correção: anamnese e escolha de plano deixaram de
acontecer ANTES da conta existir — agora acontecem DEPOIS, dentro do app autenticado.

| Passo | Status |
|---|---|
| 1. Sensibilização/lead | ✅ feito ([`pro/leads.tsx`](src/app/pro/leads.tsx), 04/set) — cria lead + atendimento na call |
| 2. Gera o link | ✅ feito ([`pro/convite.tsx`](src/app/pro/convite.tsx)) — só nome/e-mail, sempre a partir de um lead (`?leadId=` obrigatório) |
| 3. Lead cria a conta | ✅ feito ([`convite/[token].tsx`](src/app/convite/%5Btoken%5D.tsx)) — link público só pede senha; assinatura nasce `'ativa'` com `plan_id` nulo |
| 4. Anamnese + escolha de plano | ✅ feito ([`OnboardingAnamnese`](src/components/onboarding-anamnese.tsx), dentro do app, autenticado) — grava `plano_solicitado_id` (pedido, não confirmado) |
| 5. Profissional confirma o plano | ✅ feito (Painel, seção "Pedidos de plano") — grava `plan_id` de verdade, libera Treino/Dieta |
| 6. Paciente paga | ❌ manual, fora do app — confirmação de pagamento acontece antes do profissional clicar "Confirmar" no passo 5, sem integração |
| 7. Espera de ~2 dias | ❌ não iniciado — home não avisa nada, ainda mostra vazio genérico |
| 8. Profissional monta | ✅ já existia (editores de treino/dieta) |
| 9. Publica | ❌ não iniciado — sem rascunho/publicado, plano fica visível assim que salva |

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

### Perguntas mapeadas (22 de 23 — falta a 19)

| # | Categoria | Tipo |
|---|---|---|
| 1 | Peso corporal | número (kg, em jejum) |
| 2 | Disposição durante o dia | escolha ordinal, 5 opções com emoji |
| 3 | Desempenho em exercícios | escolha ordinal, 5 opções com emoji |
| 4 | Horas de sono | escala 1–10 ("Pouco" → "Muito") |
| 5 | Qualidade do sono | escolha ordinal, 5 opções com emoji |
| 6 | Aderência ao plano | escolha, 4 opções + **follow-up condicional** |
| 7 | Refeições fora do plano | escala **0–9** ("Nenhuma" → "9 ou mais") |
| 8 | Pular refeições | escolha ordinal, 3 opções sem emoji |
| 9 | Níveis de fome | escolha **categórica**, 4 opções (ver abaixo) |
| 10 | Ingestão de líquidos | escala **0–5** ("Pouco" → "5 ou mais") |
| 11 | Consumo de vegetais | escolha ordinal, 3 opções (ordem invertida) |
| 12 | Consumo de frutas | idem 11, **mesmo conjunto de opções** |
| 13 | Desconforto abdominal | escolha + **follow-up condicional** |
| 14 | Consistência de fezes | escolha categórica, 3 opções |
| 15 | Frequência intestinal | escolha ordinal, 3 opções |
| 16 | Consumo de álcool (dias) | escala **0–7** (dias da semana) |
| 17 | Quantidade de álcool | escolha ordinal, 3 opções |
| 18 | Alterações no cardápio | **texto livre — pedido de revisão do plano** |
| 19 | *(não capturada)* | — |
| 20 | Foto de perfil esquerdo | upload de imagem, opcional, até 8 MB |
| 21 | Foto de perfil direito | upload de imagem, opcional, até 8 MB |
| 22 | Foto de costas | upload de imagem, opcional, até 8 MB |
| 23 | Feedback aberto | texto livre |

Perguntas são **puláveis**, com diálogo de confirmação ("Você está prestes a pular esta pergunta").

### O check-in devolve uma leitura ao paciente

Ao enviar, o paciente vê **"Minha pontuação foi 78%"** e um resumo por categoria com rótulo
qualitativo (Disposição: Bom · Desempenho: Ótimo · Sono: Bom · Qualidade do sono: Neutro ·
Aderência: Neutro). Não é só coleta — é devolutiva imediata, e é o que faz valer a pena responder.
Barato de copiar e provavelmente o maior ganho de retenção do formato.

⚠️ As perguntas 20–22 coletam **fotos de corpo**. É o dado mais sensível que o sistema vai
guardar, e tem implicação jurídica direta — ver a análise do termo de consentimento (§14).

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

### Guardar valor, não texto — mas nem tudo é ordinal

As respostas precisam ser gravadas pelo **valor** da opção, não pelo rótulo. Rótulo
("Geralmente disposto(a)") e emoji são apresentação; gravar o texto joga fora a possibilidade de
plotar tendência, e a tendência é o produto todo.

Só que **a pergunta precisa declarar se é ordinal ou categórica** — não dá pra assumir:

- A pergunta 9 (níveis de fome) tem "Baixo", "Médio", "Alto" e também "Não sinto fome e tenho
  dificuldade para comer". A última **não é ponta de escala**, é outro eixo (e clinicamente é
  sinal de alerta). Tratada como ordinal, vira ruído no gráfico.
- A **direção varia**: vegetais e frutas listam "Três ou mais porções" primeiro (melhor → pior),
  enquanto outras vão de pior → melhor. Não inferir ordem pela posição na lista — cada opção
  carrega o próprio valor.
- Conjuntos de opções se repetem entre perguntas (11 e 12 são idênticas): vale poder reaproveitar.

### O check-in alimenta a revisão do plano — isso exige versionamento

A pergunta 18 pede explicitamente alterações no cardápio ("incluir um novo alimento, adicionar ou
modificar uma refeição"). Ou seja, o check-in **não é só medição, é entrada de pedido de revisão**,
e o ciclo real é: check-in → pedido → profissional revisa → publica versão nova.

Consequência direta: `plans` e `planos_alimentares` precisam de **histórico de versões**. Hoje o
save sobrescreve a linha única (e `client_id` é UNIQUE nas duas tabelas). Numa consultoria que
revisa a cada quinzena, sobrescrever apaga o histórico inteiro do acompanhamento — o paciente não
vê o que mudou e o profissional não vê o que já tentou. Resolver junto com a publicação
(rascunho/publicado) da Fase 1, porque são a mesma mudança estrutural.

### Melhorar em cima do original: condicional no álcool

A pergunta 17 ("quantas bebidas num dia típico") aparece mesmo quando a 16 é "0 dias". Mesma
mecânica de revelação condicional das perguntas 6 e 13 resolve — é um lugar barato de ficar melhor
que a ferramenta que estamos substituindo.

### As duas conversas medem os mesmos eixos

O que o Tassis observa na sensibilização (§12: vegetais, fibras, hidratação, sono, relação com a
comida) é quase exatamente o que o check-in mede depois. Se os dois instrumentos compartilharem o
mesmo **vocabulário de áreas**, a sensibilização vira a linha de base do gráfico em vez de ficar
solta — o profissional vê "onde começou → onde está" no mesmo eixo. Vale desenhar assim desde o
início; é de graça agora e caro depois.

### Padrão de UX que faz o paciente terminar

Uma pergunta por cartão, contador de progresso (`4/23`), categoria nomeada com ícone, foto e nome do
profissional no topo, resposta em um toque. Vinte e três campos numa página única seriam
abandonados — o formato de cartão é o que faz o volume de perguntas caber. Copiar o formato, não o
visual (a identidade é a do §1).

**Pendente do Tassis:** as outras 18 perguntas.


## 14. Termo de consentimento — análise (03/set)

Tassis trouxe um modelo de termo gerado por IA, escrito para consultório de nutrição autônomo.
Análise completa no artifact **"Termo de Consentimento do App Treino"**. Resumo do que importa
para a engenharia:

**Não é parecer jurídico — precisa de advogado antes de usar com paciente real.**

### Lacunas críticas

1. **A plataforma não aparece no termo.** Falta definir controlador (profissional) e operador
   (plataforma), e falta o contrato entre os dois.
2. **Os dados ficam nos EUA — decidido em 03/set.** O Supabase está em `us-east-1`, o que é
   transferência internacional sob a LGPD. Migrar para `sa-east-1` foi avaliado e **descartado**:
   o plano gratuito permite 2 projetos ativos por organização e as duas vagas estão ocupadas
   (`oli-health-hub` + `treino-tassis`); migrar exigiria pausar outra operação viva ou assinar o
   Pro (~US$ 25/mês). **Consequência: informar a transferência no termo deixou de ser alternativa e
   virou obrigação** — cláusula expressa de transferência internacional, com consentimento
   específico, antes de entrar paciente novo.

   *Não reabrir essa decisão sem o custo na mesa: a parte técnica é trivial (2 usuários, 27 logs,
   zero arquivos em storage), o que trava é o limite do plano.*
3. **Só cobre nutrição.** Treino tem risco de lesão e precisa de termo próprio (CREF).
4. **Menor de idade não tratado** — e o check-in coleta foto de corpo. Recomendação: bloquear
   cadastro de menor de 18 até existir fluxo de consentimento de responsável.

### Requisitos de implementação que o termo cria

- Guardar **versão do termo aceita** + data, hora, IP e dispositivo do aceite
- **Nunca sobrescrever** versões antigas do termo (mesma lógica do versionamento de plano)
- Aceite vinculado à **assinatura**, não ao perfil — um consentimento por profissional (N:N)
- **Exportação** dos dados do paciente (portabilidade + fim de assinatura)
- Fotos de corpo com **acesso restrito e regra própria** de retenção
- Nome/CRN/CREF preenchidos **a partir do cadastro do profissional**, nunca fixos no texto


## 15. Schema versionado (03/set)

[`supabase/migrations/00000000_baseline_schema.sql`](supabase/migrations/00000000_baseline_schema.sql)
reconstrói o estado atual completo num projeto vazio: 11 tabelas, constraints, índices, 8 funções,
o trigger `on_auth_user_created` e as 30 policies.

Foi capturado por introspecção porque **o schema base nunca tinha sido versionado** — só as
migrações 20260902 e 20260903 estavam no git; as tabelas originais, as policies e o
`handle_new_user` existiam apenas dentro do projeto Supabase.

Ferramentas ausentes nesta máquina: `pg_dump`, `psql` e o CLI do Supabase. Só há acesso via SQL
pelo MCP. Se um dia for preciso migrar de projeto de verdade, instalar o CLI do Supabase primeiro —
copiar `auth.users` e `auth.identities` na mão via SQL é frágil e não vale o risco.

⚠️ O baseline é um **snapshot de 03/set** — não se atualiza sozinho. Migrações aplicadas depois
dele (`20260903_convite_cria_assinatura.sql`, `20260904_convite_token_default.sql`,
`20260904_teleconsultas.sql`) não estão refletidas nas contagens acima (11 tabelas/30 policies);
pra reconstruir o schema completo hoje, aplicar o baseline **e depois** todas as migrações
datadas seguintes, em ordem.


## 16. E-mail e SMTP (investigado em 03/set)

### A causa raiz

O SMTP padrão do Supabase **só entrega para membros da organização do projeto**. Não é limite de
volume — é limitação de destinatário, por design. Para paciente, ele nunca funcionaria.
Confirmado na doc oficial: <https://supabase.com/docs/guides/auth/auth-smtp>

### A dependência que ninguém tinha mapeado

SMTP próprio exige **domínio de envio verificado** (registros DNS). Domínio depende do nome do
app — que é justamente a pendência de marca com o Tassis (§7). Ou seja, **configurar SMTP de
verdade está bloqueado pela decisão de marca**, não por falta de tempo.

Contorno possível sem esperar a marca: usar um subdomínio de domínio já controlado
(`app.olihealthhub.com.br`, ou o domínio do Tassis). Subdomínio dedicado é boa prática — isola a
reputação de envio do domínio principal.

### Caminho recomendado: duas etapas

**Etapa 1 — agora, destrava a Fase 1 sem e-mail nenhum.**
✅ **Feito em 03/set:** confirmação de e-mail desligada (Dashboard → Authentication → Sign In /
Providers → Email → *Confirm email*). O fluxo de cadastro é **por token de convite**: o
profissional já conheceu o paciente, fez a call e recebeu o pagamento. O token é a prova de
confiança, e `finalizar_cadastro_convite` ainda confere que o e-mail bate com o do convite.

*Custo real dessa escolha, para decidir com consciência:* e-mail digitado errado gera conta
inalcançável; recuperação de senha continua dependendo de SMTP; e alguém poderia criar conta via
API com e-mail qualquer — mas sem convite não ganha assinatura, e a RLS não devolve nada
(verificado: usuário autenticado avulso enxerga zero linhas em todas as tabelas). Aceitável no
piloto, **não aceitável em escala**.

**Etapa 2 — quando houver domínio.** Provedor SMTP (a doc lista Resend, AWS SES, Postmark,
SendGrid, ZeptoMail, Brevo). Com Resend: host `smtp.resend.com`, porta `587`, usuário `resend`,
senha = chave de API, remetente no domínio verificado.

### URLs de retorno

✅ **Feito em 03/set:** Site URL configurado como `https://app-treino.expo.app` e a mesma URL
adicionada às redirect URLs. Dashboard → Authentication → URL Configuration.

### O que um agente NÃO consegue fazer aqui

Criar conta em provedor de e-mail e colar chave de API são ações fora do que um assistente executa.
O MCP do Supabase também **não expõe configuração de auth** — não há ferramenta para SMTP, Site URL
nem `mailer_autoconfirm`. Tudo isso é dashboard ou Management API com token pessoal:

```
PATCH https://api.supabase.com/v1/projects/<ref>/config/auth
```

Depois de configurado, dá para verificar por aqui: disparar um recovery de teste e conferir a
entrega e os logs de auth.
