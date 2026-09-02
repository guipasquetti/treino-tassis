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
| Estado | Zustand (ainda não criado — ver §8) |
| Persistência local | AsyncStorage + Expo SecureStore |
| Backend | Supabase (Postgres + Auth + RLS) |
| Build/OTA | não configurado ainda (sem EAS) |

## 4. Infra — IDs e ambientes

| Item | Valor |
|---|---|
| Supabase project | `treino-tassis` |
| Supabase project ref | `fshwcaxcbnudvoyyqaxy` |
| Supabase região | `us-east-1` |
| Supabase URL | `https://fshwcaxcbnudvoyyqaxy.supabase.co` |
| App scheme (deep link) | `apptreino://` |
| Bundle iOS/Android | não definido ainda |
| Repo git | local apenas, **sem remote** (`git remote -v` vazio) |
| Pasta local | `/Users/guilhermepasquetti/Developer/App Treino` |

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

```
app/                          expo-router — rotas = telas (a criar)
src/
  lib/supabase.ts             ✅ client Supabase tipado
  models/
    database.types.ts         ✅ gerado do schema
    types.ts                  tipos de domínio (a criar)
  services/                   1 arquivo por domínio, chamadas Supabase (a criar)
  store/                      zustand (a criar)
  components/                 do scaffold Expo (genéricos, a substituir aos poucos)
  hooks/
```

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

## 8. Estado atual

- Scaffold Expo padrão (SDK 57) renomeado de `app-treino-scaffold` → `app-treino`,
  ainda com as telas de exemplo (`src/app/index.tsx`, `explore.tsx`) — **nada de
  domínio implementado ainda**.
- Supabase conectado e tipado; schema multi-tenant aplicado (§5) e `database.types.ts`
  regenerado batendo com ele — banco já reflete a visão white-label do §2, o app ainda não.
- `git`: 2 commits, sem remote configurado — decidir onde hospedar (GitHub) antes do
  próximo handoff.
- Sem auth flow, sem guarda de role, sem nenhuma tela de treino/nutrição ainda.
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

1. `app/_layout.tsx` — auth + guarda de role/assinatura (usar `is_professional()`/
   `is_client_of()` no client, não reimplementar a lógica no app), espelhando
   `OLIHealthHub/app/_layout.tsx`.
2. `src/store/authStore.ts` + `src/services/authService.ts` + `src/services/professionalService.ts`
   (CRUD de `professional_plans`, gestão de `subscriptions`).
3. Telas de onboarding por convite (RPCs do §5) — falta decidir onde no funil entra a
   escolha de plano/assinatura (§2 aponta que hoje é manual, sem cobrança recorrente).
4. Remover as telas de exemplo do scaffold quando o fluxo real substituir.
5. Decidir repo remoto (GitHub) e configurar EAS quando for hora de buildar.
6. Cobrar do Tassis os itens do §7 — vários bloqueiam decisões de schema/UX.
7. Avaliar se `is_trainer()` pode ser removida (não é mais usada em nenhuma RLS, ver §5).
