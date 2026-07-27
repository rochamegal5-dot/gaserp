-- ════════════════════════════════════════════════════════════
-- Migración Supabase: tabla puntos_ruta con columna descripcion
-- ════════════════════════════════════════════════════════════
-- Ejecutar en el SQL Editor de Supabase (https://supabase.com/dashboard)
-- Solo agrega la columna si no existe. Es seguro ejecutarlo múltiples veces.

-- Si la tabla no existe todavía, crearla:
create table if not exists public.puntos_ruta (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  latitud     double precision not null,
  longitud    double precision not null,
  radio_m     integer default 50,
  descripcion text,
  created_at  timestamptz default now()
);

-- Habilitar RLS (si no está habilitado)
alter table public.puntos_ruta enable row level security;

-- Política permisiva (cualquiera puede leer/escribir — ajustar si hay auth)
drop policy if exists "puntos_ruta_all_access" on public.puntos_ruta;
create policy "puntos_ruta_all_access"
  on public.puntos_ruta
  for all
  using (true)
  with check (true);

-- Agregar columna descripcion si no existe (compatible con versiones anteriores)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'puntos_ruta'
      and column_name = 'descripcion'
  ) then
    alter table public.puntos_ruta add column descripcion text;
    raise notice 'Columna descripcion agregada';
  else
    raise notice 'Columna descripcion ya existe, omitiendo';
  end if;
end$$;

-- ════════════════════════════════════════════════════════════
-- Habilitar Realtime para que los cambios se propaguen a todos
-- los navegadores conectados (los puntos agregados/editados por
-- un usuario aparecen automáticamente en los demás)
-- ════════════════════════════════════════════════════════════
alter publication supabase_realtime add table public.puntos_ruta;

-- Verificación final
select id, nombre, latitud, longitud, radio_m, descripcion, created_at
from public.puntos_ruta
order by nombre;
