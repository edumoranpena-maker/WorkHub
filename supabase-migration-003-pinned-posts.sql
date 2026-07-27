-- ============================================================
-- Migración 003 — Posts fijados (PostFeed)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
--
-- Aditiva y aislada: solo toca `recap_threads`, la tabla del feed de Posts.
-- No tiene relación con las tablas de Doers Journal (trades, trading_*) ni
-- con la migración de ese proyecto — es un cambio independiente sobre una
-- tabla que ya existe en el proyecto de PlanSpace.
-- ============================================================

alter table recap_threads
  add column if not exists pinned    boolean     not null default false,
  add column if not exists pinned_at timestamptz;

-- Soporta el ORDER BY que usa la vista fijada (pinned desc, pinned_at desc)
create index if not exists idx_recap_threads_pinned on recap_threads (pinned, pinned_at desc);
