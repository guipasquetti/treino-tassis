-- F0 do roadmap: separar rascunho de publicado, pra paciente não ver o plano sendo montado
-- pela metade. Default true preserva os planos já em produção (visíveis hoje) sem backfill —
-- só planos NOVOS nascem como rascunho (o app passa publicado=false explicitamente no
-- primeiro save). Nenhuma policy nova: a leitura do aluno já é filtrada na aplicação, não é
-- dado sensível a mais, é só estado de exibição.

alter table public.plans
  add column publicado boolean not null default true;

alter table public.planos_alimentares
  add column publicado boolean not null default true;
