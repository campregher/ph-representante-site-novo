-- ============================================================
-- SISTEMA COMERCIAL — 016 — Bucket de logos (Supabase Storage)
-- Upload de logo da representada (e futuros clientes/produtos).
-- Aditivo e idempotente.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sistema-comercial',
  'sistema-comercial',
  true,
  2097152, -- 2 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Leitura pública (bucket público)
drop policy if exists "sc_bucket_read" on storage.objects;
create policy "sc_bucket_read" on storage.objects
  for select
  using (bucket_id = 'sistema-comercial');

-- Escrita apenas para usuários autenticados do sistema
drop policy if exists "sc_bucket_insert" on storage.objects;
create policy "sc_bucket_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'sistema-comercial');

drop policy if exists "sc_bucket_update" on storage.objects;
create policy "sc_bucket_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'sistema-comercial')
  with check (bucket_id = 'sistema-comercial');

drop policy if exists "sc_bucket_delete" on storage.objects;
create policy "sc_bucket_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'sistema-comercial');
