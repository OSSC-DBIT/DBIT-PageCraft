-- DBIT PageCraft - PostgreSQL schema
-- Applied automatically by server/db.js on startup (idempotent).

create table if not exists generations (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  page          varchar(32)  not null,
  type          varchar(32)  not null,
  student_name  varchar(200) not null default '',
  usn           varchar(64)  not null default '',
  subject       varchar(300) not null default '',
  subject_code  varchar(64)  not null default '',
  topic         varchar(300) not null default '',
  semester      varchar(64)  not null default '',
  section       varchar(32)  not null default '',
  branch        varchar(200) not null default '',
  email         varchar(254) not null default '',
  constraint generations_page_chk check (page in ('front-page', 'project-report')),
  constraint generations_type_chk check (type in (
    'PDF', 'PNG', 'MERGE', 'DOC', 'DOCX',
    'REPORT_PDF', 'REPORT_MERGE', 'REPORT_DOC', 'REPORT_DOCX'
  ))
);

create index if not exists generations_created_at_idx on generations (created_at desc);
create index if not exists generations_email_idx on generations (lower(email));
