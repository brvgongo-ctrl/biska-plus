-- Dados iniciais: categorias do MVP e zonas de Luanda.
insert into public.categories (slug, name, requires_criminal_record, requires_driver_license, sort_order) values
  ('pintor', 'Pintor', false, false, 1),
  ('canalizador', 'Canalizador', false, false, 2),
  ('electricista', 'Electricista', false, false, 3),
  ('empregada-domestica', 'Empregada doméstica', true, false, 4),
  ('baba', 'Babá profissional', true, false, 5),
  ('explicador', 'Explicador', true, false, 6),
  ('motorista', 'Motorista', true, true, 7)
on conflict (slug) do update set
  name = excluded.name,
  requires_criminal_record = excluded.requires_criminal_record,
  requires_driver_license = excluded.requires_driver_license,
  sort_order = excluded.sort_order;

insert into public.zones (name) values
  ('Alvalade'), ('Benfica'), ('Cacuaco'), ('Camama'), ('Cazenga'), ('Golfe'),
  ('Ingombota'), ('Kilamba'), ('Maianga'), ('Maculusso'), ('Morro Bento'),
  ('Nova Vida'), ('Patriota'), ('Prenda'), ('Rangel'), ('Samba'),
  ('Sambizanga'), ('Talatona'), ('Viana'), ('Zango')
on conflict (province, name) do nothing;
