-- migrate:up
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  title text not null,
  status text not null check (status in ('processing', 'ready', 'failed')),
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists chatbots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  system_prompt text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists chatbot_documents (
  chatbot_id uuid not null references chatbots(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (chatbot_id, document_id)
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  chatbot_id uuid not null references chatbots(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender text not null check (sender in ('user', 'assistant')),
  content text not null,
  citations_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists documents_tenant_id_idx on documents(tenant_id);
create index if not exists chatbots_tenant_id_idx on chatbots(tenant_id);
create index if not exists conversations_chatbot_id_idx on conversations(chatbot_id);
create index if not exists messages_conversation_id_idx on messages(conversation_id);

-- migrate:down
-- NOTE: Down migrations are for dev-only. Never run in production.

drop table if exists messages;
drop table if exists conversations;
drop table if exists chatbot_documents;
drop table if exists chatbots;
drop table if exists documents;
