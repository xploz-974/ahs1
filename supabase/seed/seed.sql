-- Seed de développement local (supabase db reset applique ce fichier après les migrations)
-- Ne crée pas d'utilisateur Supabase Auth : créez-en un via Studio (http://localhost:54323)
-- puis liez-le manuellement à l'organisation ci-dessous (voir requête en bas de fichier).

insert into genres (id, name) values
  (gen_random_uuid(), 'Lounge'),
  (gen_random_uuid(), 'Pop'),
  (gen_random_uuid(), 'Jazz'),
  (gen_random_uuid(), 'Electro chill')
on conflict (name) do nothing;

insert into organizations (id, name, slug) values
  ('00000000-0000-0000-0000-000000000001', 'Client Demo', 'client-demo')
on conflict (id) do nothing;

insert into stores (id, organization_id, name, region, timezone) values
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Boutique Saint-Pierre', 'Reunion', 'Indian/Reunion')
on conflict (id) do nothing;

-- Une fois un utilisateur créé dans Supabase Auth (Studio > Authentication),
-- récupérez son id et exécutez :
--
-- insert into users (id, email, full_name)
--   values ('<auth-user-id>', '<email>', '<nom>');
--
-- insert into organization_members (organization_id, user_id, role)
--   values ('00000000-0000-0000-0000-000000000001', '<auth-user-id>', 'owner');
