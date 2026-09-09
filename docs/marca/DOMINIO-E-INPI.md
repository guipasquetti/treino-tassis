# Vytra — domínio e registro de marca

> Decisões de 09/set/2026. Complementa `BRAND.md`, que é o brand book.
> Este documento existe para não reabrir discussão já fechada: as alternativas descartadas
> estão listadas com o motivo.

---

## 1. Decisão

**O nome Vytra está mantido — reconfirmado três vezes em 09/set.** Foi testado contra Vytia,
contra Vytria, e contra uma ronda completa de nomes começando com V com domínio livre. Nenhum
substituto se sustentou. Ver §4.

⚠️ **Não reabrir sem fato novo.** Fato novo é: a Vytra Diagnósticos depositar VYTRA no INPI,
ou uma oposição real chegar. Não é dúvida, não é um nome bonito que apareceu. A ronda já foi
feita e o resultado está registrado abaixo.

**Endereço oficial: `vytraoficial.com.br`.**

Não é o endereço ideal, é o melhor disponível. O ideal, `vytra.com.br`, está registrado pela
Vytra Diagnósticos. A escolha é deliberadamente reversível: trocar de domínio depois custa
reverificar o domínio de envio, mudar duas URLs no Supabase e reapontar o EAS. Menos de uma
hora. O que não é reversível, e por isso tem prioridade, é o depósito da marca no INPI (§5).

Por que `oficial` e não outra palavra: é a única disponível que **não impõe teto ao produto**.
"App" limitava ao aplicativo e envelhece quando a plataforma for vendida a outros
profissionais; "saúde" empurrava para o clínico; "fit" fechava em treino, quando metade do
produto é dieta. "Oficial" não diz nada sobre o que a Vytra faz. E já é o vocabulário da
marca: o handle `@vytra.oficial` foi fechado em 08/set, então link e perfil contam a mesma
história.

---

## 2. Estrutura de DNS

Um domínio, um endereço para falar em voz alta.

| Nome | Aponta para | Para quê |
|---|---|---|
| `vytraoficial.com.br` (raiz) | EAS Hosting | o app. Na raiz de propósito: `app.` só faria o link do convite crescer |
| `mail.vytraoficial.com.br` | provedor de SMTP (Resend) | envio de e-mail transacional |

O subdomínio dedicado de envio não é capricho: ele isola a reputação de entrega. Se um dia um
disparo for marcado como spam, o estrago fica no `mail.` e não derruba o domínio principal.

---

## 3. O que isso destrava

Três frentes que hoje estão paradas por falta de domínio:

1. **E-mail (§16 do `HANDOFF.md`).** O SMTP padrão do Supabase só entrega para membros da
   organização do projeto. Nenhum paciente recebe nada, e recuperação de senha não funciona.
   Corrigir exige provedor próprio, que exige domínio de envio verificado. Com `mail.` no ar,
   destrava.
2. **Supabase.** Site URL e redirect URLs saem de `app-treino.expo.app`.
   Dashboard → Authentication → URL Configuration. Não é MCP, é dashboard.
3. **EAS Hosting.** Domínio customizado no lugar de `app-treino.expo.app`. Isso tira
   "app-treino" do link que o paciente recebe no WhatsApp, que hoje é uma inconsistência
   visível para quem acabou de ouvir falar de Vytra.

O `slug` do projeto Expo continua `app-treino` mesmo assim. Trocar o slug mexe no EAS project
e é uma decisão separada, registrada como pendência no `HANDOFF.md`.

---

## 4. Alternativas descartadas

Registradas para não voltarem à mesa sem informação nova.

### Domínios

| Opção | Por que caiu |
|---|---|
| `vytra.com.br` | Registrado pela Vytra Diagnósticos, vence 25/09/2027, parado em DNS automático. Comprar foi descartado pelo Guilherme: é marca já implementada, difícil pleitear. Em monitoramento, ver §6 |
| `vytra.com` | EmblemHealth, plano de saúde americano |
| `vytra.io`, `vytra.club` | registrados |
| `vytra.app.br`, `appvytra.com.br`, `vytraapp.com.br`, `vytra.app` | "app" impõe teto ao produto. Decisão do Guilherme |
| `usevytra.com.br` | "use Vytra" lê como imperativo de vestir. Decisão do Guilherme |
| `vytra.co` | quem erra e digita `.com` cai na EmblemHealth. Vazar tráfego de um produto de saúde para outra marca de saúde não vale a economia de caracteres |
| `vytrasaude.com.br` | disponível, mas "saúde" empurra o posicionamento para o clínico |
| `vytra.fit` | "fit" fecha em treino e carrega conotação de emagrecimento de moda, o oposto da voz "técnica, nunca sedutora" |
| `vytra.health`, `vytra.care`, `vytra.life`, `vytra.pro` | palavra em inglês para base de pacientes que fala português |
| `vytra.net.br`, `vytra.tec.br` | soam como provedor de internet e empresa de TI |

### Nomes

| Nome | Por que caiu |
|---|---|
| **Vytia** | `vytia.com.br` está livre, mas `vytia.fr` foi uma loja de sapatos fraudulenta anunciada no Facebook, com 15 reclamações registradas no Signal Arnaques entre dez/2021 e jan/2022. Contaminação de busca inaceitável para produto de saúde com assinatura. Fonética também piora: o fecho *-tia* puxa apatia e antipatia, e falado corre risco de virar "V, tia" |
| **Ronda de nomes com V** | Rodada completa em 09/set com três peneiras (`.com.br` livre no Registro.br, busca sem contaminação, legível em português na primeira tentativa). Passaram: **Vytora** (ecoa vitória, o melhor dos cinco), Vytana, Vyanta, Vysora, Vyrena. Caíram: `Vyntra` e `Vytria` (registrados e suspensos), `Vydra` (reservado pelo Comitê Gestor), `Vyntro` (duas startups de IA), `Vyvante` (o `.com` é marca de wellness de enema de café), e `Vylia`/`Vyndra`/`Vyron`/`Vyara`/`Vyora`/`Vetra` (`.com.br` ocupados). **Nenhum superou Vytra**: os limpos não têm significado, e Vytora perde as duas sílabas secas e ganha vizinhança com "Vitória" |
| **Vytria** | Fonética funciona bem (o fecho *-tria* puxa pediatria, psiquiatria, geriatria de um lado, simetria e geometria do outro) e o INPI já estava limpo. Mas `vytria.com.br` está registrado e suspenso (`ns1.dns-suspended.com`, vencimento 14/06/2026, status on hold, fora da lista de liberação), e `vytria.com` é a Vytria Eyewear, e-commerce ativo que domina a busca pelo nome. Trocaria o nome e continuaria sem `.com.br` |

---

## 5. INPI — a parte que não é reversível

**Nada foi depositado ainda.** Hoje existe busca limpa e zero proteção.

Situação conhecida (verificada em 09/set/2026 na base oficial `busca.inpi.gov.br`):

- Busca exata zerou para VYTRA, VYTRIA e VYTTRA.
- Busca radical (fonética) trouxe 7 processos, nenhum idêntico. O mais próximo é VYTRANZO,
  farmacêutica, classes NCL 5/10, medicamento e dispositivo médico. Outro mercado.
- **Vytra Diagnósticos não aparece no INPI.** É nome empresarial e CNPJ, não marca registrada.

**O risco real.** Nome empresarial anterior de terceiro, no mesmo ramo, é fundamento de
oposição pelo art. 124, V da Lei da Propriedade Industrial. A Vytra Diagnósticos opera em
saúde no Brasil. Ou seja: mesmo com a busca limpa, existe caminho para eles contestarem um
depósito — e o momento em que isso doeria é justamente quando o produto já tiver paciente
pagante dentro.

**Por que depositar agora inverte a posição.** O Brasil é first-to-file com ressalvas de uso
anterior. Depositar dá data de prioridade e transfere para o outro lado o ônus de agir dentro
do prazo de oposição, em vez de deixar a questão aberta indefinidamente.

**Como fazer:**

1. Sistema e-INPI (`gru.inpi.gov.br` para a guia, `busca.inpi.gov.br` para o pedido).
2. Classes prováveis, a confirmar com quem for fazer o depósito:
   - **NCL 9** — software, aplicativo baixável
   - **NCL 42** — desenvolvimento de software, SaaS
   - **NCL 44** — serviços de saúde, nutrição, acompanhamento
3. Custo de referência: cerca de R$ 355 por classe, ou cerca de R$ 142 com a redução para
   ME, EPP, MEI e pessoa física. Confirmar a tabela vigente no site do INPI.
4. Depositar como **marca mista** (o mark junto do nome) protege mais que só a nominativa,
   mas a nominativa é a que impede terceiro de usar a palavra. Se for depositar uma só,
   depositar a nominativa.

Aviso do próprio INPI que continua valendo: "nenhum resultado" na busca não garante
registrabilidade. O exame de verdade só acontece com o pedido formal.

Isto não é parecer jurídico. Vale uma conversa com advogado de PI antes do depósito,
principalmente sobre as classes.

---

## 6. Monitoramento do `vytra.com.br`

Existe uma tarefa agendada mensal (dia 1º, 09h de Brasília) que consulta o Registro.br e avisa
se o `vytra.com.br` mudar de status: ficar disponível, entrar em processo de liberação, ou
passar para on hold. Ela também confere se o `vytraoficial.com.br` continua registrado, para
que uma renovação perdida não passe em branco.

Se a janela abrir, o domínio precisa ser registrado imediatamente. Havendo mais de um
interessado, o Registro.br leva a um processo competitivo.

Vencimento conhecido em 09/set/2026: **25/09/2027**.

---

## 7. Ordem de execução

1. Registrar `vytraoficial.com.br` no Registro.br. Precisa de CPF ou CNPJ brasileiro.
2. Criar conta no provedor de SMTP e verificar `mail.vytraoficial.com.br` pelos registros DNS
   que ele indicar (SPF, DKIM e, de preferência, DMARC).
3. Configurar o SMTP no Supabase: Authentication → Emails → SMTP Settings. Ligar de volta a
   confirmação de e-mail, que foi desligada em 03/set como contorno.
4. Apontar a raiz do domínio para o EAS Hosting e configurar o domínio customizado.
5. Trocar Site URL e redirect URLs no Supabase.
6. Atualizar o fallback em `src/app/pro/convite.tsx`, hoje `https://app-treino.expo.app`.
7. Depositar VYTRA no INPI.

Os passos 1 e 7 dependem do Guilherme (documento, cartão, conta). Os demais eu executo.
