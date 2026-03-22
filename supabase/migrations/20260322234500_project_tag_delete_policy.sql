drop policy if exists "project_tags_delete_managers" on public.project_tags;
create policy "project_tags_delete_managers"
on public.project_tags
for delete
to authenticated
using (public.is_project_manager(project_id));

drop policy if exists "ledger_entry_tags_delete_entry_creator_or_manager" on public.ledger_entry_tags;
create policy "ledger_entry_tags_delete_entry_creator_or_manager"
on public.ledger_entry_tags
for delete
to authenticated
using (
  exists (
    select 1
    from public.ledger_entries le
    where le.id = ledger_entry_id
      and (
        le.created_by = auth.uid()
        or public.is_project_manager(le.project_id)
      )
  )
);
