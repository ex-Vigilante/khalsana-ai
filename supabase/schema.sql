-- ============================================================================
-- Khalsana | خلّصانة : database schema (Supabase / Postgres)
--
-- Run this ONCE in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- It is idempotent, so running it again is safe.
--
-- ADD THE FIRST OWNER (run after this file, with your own email in lowercase):
--
--     insert into team_members (email, role) values ('you@example.com', 'owner')
--     on conflict (email) do update set role = excluded.role;
--
-- Then create the same user in Authentication -> Users -> Add user (email + password).
-- More staff: insert another row with role 'staff' and create their user the same way.
--
-- Security model: Row Level Security is ON for every table. Only signed-in users whose CONFIRMED email
-- is in team_members can read or write anything. The anon role has no access at all.
-- Staff can read everything, add messages/orders/replies and change message/order status.
-- Owners can additionally edit settings and delete orders and messages.
-- Also in Supabase: Authentication -> Sign In / Providers -> turn OFF "Allow new users to sign up" and keep "Confirm email" ON.
-- The WhatsApp webhook writes with the service-role key (server only), which bypasses RLS.
-- ============================================================================

-- ---------- tables ----------
create table if not exists team_members (
  email      text primary key check (email = lower(email)),
  role       text not null check (role in ('owner', 'staff')),
  created_at timestamptz not null default now()
);

create table if not exists settings (
  id         int primary key default 1 check (id = 1),
  store      jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists messages (
  id          uuid primary key default gen_random_uuid(),
  channel     text not null default 'manual' check (channel in ('whatsapp', 'messenger', 'instagram', 'manual')),
  external_id text unique,            -- WhatsApp wamid; null for manual messages
  from_phone  text,
  from_name   text,
  body        text not null,
  received_at timestamptz not null default now(),
  status      text not null default 'new' check (status in ('new', 'extracted', 'replied', 'ignored')),
  extraction  jsonb,
  created_at  timestamptz not null default now()
);

create table if not exists orders (
  id            bigint generated always as identity (start with 1001) primary key,
  message_id    uuid references messages (id) on delete set null,
  customer_name text,
  phone         text,
  governorate   text,
  address       text,
  items         jsonb not null default '[]'::jsonb,
  notes         text,
  subtotal      int not null default 0,
  shipping      int not null default 0,
  total         int not null default 0,
  status        text not null default 'new' check (status in ('new', 'confirmed', 'shipped', 'delivered', 'returned')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists replies (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid references messages (id) on delete cascade,
  body        text not null,
  sent_via    text not null check (sent_via in ('whatsapp_api', 'manual')),
  external_id text,
  created_by  text,
  created_at  timestamptz not null default now()
);

-- ---------- indexes ----------
create index if not exists messages_status_received_idx on messages (status, received_at desc);
create index if not exists orders_status_created_idx on orders (status, created_at desc);
create index if not exists replies_message_idx on replies (message_id);
-- one order per customer message (the app also checks this)
create unique index if not exists orders_message_unique on orders (message_id) where message_id is not null;

-- ---------- updated_at ----------
create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

drop trigger if exists settings_set_updated_at on public.settings;
create trigger settings_set_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

-- ---------- access helpers ----------
-- security definer so the checks can read team_members and auth.users whatever the caller's own rights are.
-- The signed-in user's email must be CONFIRMED and listed in team_members.
create or replace function public.is_team_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.team_members t
    join auth.users u on lower(u.email) = t.email
    where u.id = auth.uid() and u.email_confirmed_at is not null
  );
$$;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.team_members t
    join auth.users u on lower(u.email) = t.email
    where u.id = auth.uid() and u.email_confirmed_at is not null and t.role = 'owner'
  );
$$;

revoke all on function public.is_team_member() from public, anon;
revoke all on function public.is_owner() from public, anon;
grant execute on function public.is_team_member() to authenticated;
grant execute on function public.is_owner() to authenticated;

-- replies.created_by is always the signed-in user's email (clients cannot set it)
alter table public.replies alter column created_by set default (auth.jwt() ->> 'email');

-- ---------- Row Level Security ----------
alter table public.team_members enable row level security;
alter table public.settings     enable row level security;
alter table public.messages     enable row level security;
alter table public.orders       enable row level security;
alter table public.replies      enable row level security;

-- ---------- least privilege: table and column grants ----------
-- Start from nothing (this also removes truncate, references and trigger), then grant back exactly what the app needs.
revoke all on public.team_members, public.settings, public.messages, public.orders, public.replies from anon, authenticated;

--   everyone on the team can read everything
grant select on public.team_members, public.settings, public.messages, public.orders, public.replies to authenticated;
--   settings: owner only writes (policies enforce the owner part)
grant insert (id, store), update (store) on public.settings to authenticated;
--   messages: staff add manual messages and change status / extraction; only owners delete
grant insert (channel, from_phone, from_name, body) on public.messages to authenticated;
grant update (status, extraction) on public.messages to authenticated;
grant delete on public.messages to authenticated;
--   orders: staff create and move orders; only owners delete
grant insert (message_id, customer_name, phone, governorate, address, items, notes, subtotal, shipping, total) on public.orders to authenticated;
grant update (status) on public.orders to authenticated;
grant delete on public.orders to authenticated;
--   replies: insert only (created_by is filled by its default); never edited or deleted from the app
grant insert (message_id, body, sent_via, external_id) on public.replies to authenticated;
--   team_members: read only; it is edited from the SQL editor

-- ---------- policies ----------
drop policy if exists team_read on public.team_members;
drop policy if exists team_all on public.settings;
drop policy if exists team_all on public.messages;
drop policy if exists team_all on public.orders;
drop policy if exists team_all on public.replies;

drop policy if exists team_members_select on public.team_members;
create policy team_members_select on public.team_members for select to authenticated using (public.is_team_member());

drop policy if exists settings_select on public.settings;
create policy settings_select on public.settings for select to authenticated using (public.is_team_member());
drop policy if exists settings_insert on public.settings;
create policy settings_insert on public.settings for insert to authenticated with check (public.is_owner());
drop policy if exists settings_update on public.settings;
create policy settings_update on public.settings for update to authenticated using (public.is_owner()) with check (public.is_owner());

drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages for select to authenticated using (public.is_team_member());
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated with check (public.is_team_member());
drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages for update to authenticated using (public.is_team_member()) with check (public.is_team_member());
drop policy if exists messages_delete on public.messages;
create policy messages_delete on public.messages for delete to authenticated using (public.is_owner());

drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders for select to authenticated using (public.is_team_member());
drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders for insert to authenticated with check (public.is_team_member());
drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders for update to authenticated using (public.is_team_member()) with check (public.is_team_member());
drop policy if exists orders_delete on public.orders;
create policy orders_delete on public.orders for delete to authenticated using (public.is_owner());

drop policy if exists replies_select on public.replies;
create policy replies_select on public.replies for select to authenticated using (public.is_team_member());
drop policy if exists replies_insert on public.replies;
create policy replies_insert on public.replies for insert to authenticated with check (public.is_team_member());

-- ---------- seed: the sample store, editable later in the app's Settings page ----------
insert into public.settings (id, store)
values (1, $store${"name":"بيت الكتان","signature":"بيت الكتان - شكراً لثقتك 🤍","products":[{"id":"p1","name":"طقم كتان قطعتين","aliases":["طقم","taqm","set"],"price":890,"sizes":["S","M","L","XL"],"colors":["أسود","بيج","كحلي"],"available":true},{"id":"p2","name":"فستان كتان طويل","aliases":["فستان","dress"],"price":650,"sizes":["S","M","L","XL"],"colors":["بيج","زيتي","أسود"],"available":true},{"id":"p3","name":"قميص كتان رجالي","aliases":["قميص","shirt"],"price":480,"sizes":["M","L","XL","XXL"],"colors":["أبيض","سماوي","كحلي"],"available":true},{"id":"p4","name":"بنطلون كتان واسع","aliases":["بنطلون","بنطلون واسع","pantalon","pants"],"price":520,"sizes":["S","M","L","XL"],"colors":["بيج","أسود","رمادي"],"available":true},{"id":"p5","name":"جاكيت كتان خفيف","aliases":["جاكيت","jacket"],"price":780,"sizes":["M","L","XL"],"colors":["بيج","زيتي"],"available":true},{"id":"p6","name":"عباية كتان","aliases":["عباية","abaya"],"price":950,"sizes":["52","54","56","58"],"colors":["أسود","كحلي","بيج"],"available":true},{"id":"p7","name":"بلوزة كتان","aliases":["بلوزة","بلوزه","blouse"],"price":340,"sizes":["S","M","L"],"colors":["أبيض","وردي","بيج"],"available":true},{"id":"p8","name":"شال كتان","aliases":["شال","ايشارب","scarf","shal","shala"],"price":190,"sizes":["Free"],"colors":["بيج","رمادي","عنابي","زيتي"],"available":true},{"id":"p9","name":"جلابية بيت","aliases":["جلابية","جلابيه"],"price":420,"sizes":["M","L","XL"],"colors":["رمادي","كحلي"],"available":true},{"id":"p10","name":"شنطة كتان","aliases":["شنطة","شنطه","bag"],"price":260,"sizes":["Free"],"colors":["بيج","أسود"],"available":false}],"shipping":{"القاهرة":60,"الجيزة":60,"القليوبية":65,"الإسكندرية":70,"البحيرة":75,"الغربية":70,"الدقهلية":70,"الشرقية":70,"المنوفية":70,"كفر الشيخ":75,"دمياط":75,"بورسعيد":75,"الإسماعيلية":70,"السويس":70,"شمال سيناء":100,"جنوب سيناء":100,"مطروح":90,"الفيوم":75,"بني سويف":80,"المنيا":85,"أسيوط":90,"سوهاج":90,"قنا":90,"الأقصر":90,"أسوان":95,"الوادي الجديد":110,"البحر الأحمر":100}}$store$::jsonb)
on conflict (id) do nothing;
