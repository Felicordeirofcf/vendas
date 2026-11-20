-- Público (anon) só usa as funções get_public_store / get_public_page / track_click.
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
