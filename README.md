# Vytra

Plataforma de dieta, treino e acompanhamento para profissionais de nutrição e educação
física e seus pacientes. Um plano realmente seu.

O Tassis Moraes é o profissional piloto, não o único usuário previsto: o modelo de dados é
multi-tenant desde a v1, com relação paciente↔profissional N:N e assinatura própria por par.

## Documentação

| Onde | O que |
|---|---|
| [`HANDOFF.md`](HANDOFF.md) | **fonte canônica** — estado do projeto, decisões, schema, pendências. Ler antes de mexer em qualquer coisa. |
| [`docs/marca/BRAND.md`](docs/marca/BRAND.md) | brand book: nome, mark, paleta, tipografia, lockups, voz |
| [`AGENTS.md`](AGENTS.md) | instrução para agentes de IA que trabalham no repositório |

## Stack

React Native + Expo SDK 57 + Expo Router + TypeScript · Zustand · design system próprio em
`src/theme` · Supabase (Postgres, Auth, RLS, Storage) · EAS Hosting.

Sem biblioteca de componentes de UI e sem ORM. Não introduzir dependência nova sem decisão
registrada no `HANDOFF.md`.

## Rodar

```bash
npm install
npx expo start --web
```

Precisa de um `.env` na raiz com `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
Use o [`.env.example`](.env.example) como referência. Nunca colocar chave de `service_role`
em variável `EXPO_PUBLIC_*`: ela vai embutida no bundle.

## Deploy web

```bash
npx expo export --platform web && eas deploy --prod
```

Produção: <https://app-treino.expo.app>

O `slug` do projeto continua `app-treino` de propósito. Trocar muda o EAS project e a URL que
os usuários já acessam; é decisão comercial, registrada como pendência no `HANDOFF.md`.

## Antes de commitar

```bash
npx tsc --noEmit
npx expo lint
```

Migrations ficam em `supabase/migrations/`, uma por mudança lógica, com a policy de RLS escrita
na mesma tarefa. Dado clínico é sensível: toda tabela nova carrega o vínculo
profissional↔paciente e é protegida por RLS. Ver a seção 0 do `HANDOFF.md`.

## Marca

Os arquivos de logotipo em `assets/brand/` são gerados, não desenhados à mão:

```bash
pip install fonttools cairosvg
python3 scripts/brand/gen_brand.py
```

Editar um arquivo de `assets/brand/` direto não adianta, a próxima execução sobrescreve.
