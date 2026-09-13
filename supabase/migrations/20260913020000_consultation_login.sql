-- Phase 6: the consultation client's view-only login.
--
-- Phase 1 created consultation_clients.auth_user_id and /plan has read it since
-- phase 4, but nothing ever WROTE it outside a test script. This phase gives the
-- coach a button that does, which makes both changes below matter.

-- The review screen's Pipeline dates every other step from a real timestamp.
-- auth_user_id records only THAT a login exists, never when it was handed over.
alter table consultation_clients
  add column login_sent_at timestamptz;

-- current_consultation_client_id() is `select id from consultation_clients
-- where auth_user_id = auth.uid()`. A scalar sql function given two matching rows
-- does not error — it returns an arbitrary one, so a duplicated link would show
-- somebody else's plan rather than failing loudly. Nothing writes this column by
-- hand any more, so make the invariant the database's job.
create unique index consultation_clients_auth_user_id_key
  on consultation_clients (auth_user_id)
  where auth_user_id is not null;
