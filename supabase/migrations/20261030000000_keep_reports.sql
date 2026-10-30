-- Reports outlive the reported account. Before, deleting an account deleted every report about it (on delete cascade),
-- so someone could harass people, delete their account, and leave nothing to review. Now the reported account's id is
-- cleared instead and the report (reason, note, time) stays for review. Reports a person made are still deleted with
-- their own account, as the privacy policy says.
alter table public.reports alter column target_id drop not null;
alter table public.reports drop constraint reports_target_id_fkey;
alter table public.reports add constraint reports_target_id_fkey foreign key (target_id) references auth.users (id) on delete set null;
