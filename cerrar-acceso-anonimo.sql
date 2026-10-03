-- Panorama Inventario — cerrar el acceso anónimo a la tabla de sincronización.
--
-- ORDEN (importante, para no perder sincronización):
--  1. Supabase → Authentication → Users → "Add user" → correo + contraseña
--     (marca "Auto Confirm User"). Esta será la cuenta única de la app.
--  2. Supabase → Authentication → Sign In / Providers → desactiva
--     "Allow new users to sign up" (así nadie más puede crear cuentas).
--  3. Sube esta versión de la app a GitHub y, en CADA dispositivo, abre
--     Datos y app → "Iniciar sesión" y entra con esa cuenta.
--  4. Hasta entonces ejecuta este script en SQL Editor.
--
-- Si algo sale mal, los datos locales de cada dispositivo siguen intactos;
-- la app solo mostrará "Requiere iniciar sesión".

alter table public.panorama_inventario_state enable row level security;

do $$
declare r record;
begin
  for r in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'panorama_inventario_state'
  loop
    execute format('drop policy %I on public.panorama_inventario_state', r.policyname);
  end loop;
end $$;

create policy "inventario solo usuarios autenticados"
  on public.panorama_inventario_state
  for all
  to authenticated
  using (true)
  with check (true);
