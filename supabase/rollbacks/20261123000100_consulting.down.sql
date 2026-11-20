-- =============================================================================
-- RETOUR ARRIÈRE de 20261123000100_consulting.sql (CSC Consulting, lot C1)
-- =============================================================================
-- ⚠ DESTRUCTIF : efface TOUTES les données CSC Consulting (offres, rendez-vous,
--   paiements, comptes rendus) et le journal des tâches planifiées.
--   À n'exécuter qu'en cas d'abandon du lot, APRÈS une sauvegarde complète
--   (Supabase › Database › Backups, ou pg_dump).
--   Les fichiers du stockage « consulting-files » doivent être vidés depuis le
--   tableau de bord Supabase (Storage) AVANT ce script : un bucket non vide ne
--   peut pas être supprimé.
--   Le journal d'audit (audit_log) n'est jamais modifié : les lignes
--   « consulting.* » restent, comme trace de l'historique.
--   L'extension btree_gist est conservée (sans effet, et peut-être utilisée ailleurs).
-- =============================================================================

begin;

drop policy if exists consulting_files_admin_read on storage.objects;
drop policy if exists consulting_files_admin_insert on storage.objects;
drop policy if exists consulting_files_admin_delete on storage.objects;
delete from storage.buckets where id = 'consulting-files';

drop view if exists public.consulting_booking_details;

drop table if exists public.consulting_report_files;
drop table if exists public.consulting_reports;
drop table if exists public.consulting_reminders;
drop table if exists public.consulting_payments;
drop table if exists public.consulting_booking_events;
drop table if exists public.consulting_bookings;
drop table if exists public.consulting_unavailabilities;
drop table if exists public.consulting_availability;
drop table if exists public.consulting_offers;
drop table if exists public.consulting_advisors;
drop table if exists public.consulting_settings;
drop table if exists public.job_runs;

-- Ajoutée par 20261125000100_consulting_reminder_lead (dépend du type consulting_mode).
drop function if exists public.consulting_reminder_lead(public.consulting_mode);
drop function if exists public.consulting_is_advisor(uuid);
drop function if exists public.consulting_is_staff(uuid);
drop function if exists public.consulting_can_manage(uuid, uuid);
drop function if exists public.consulting_has_booked_offer(uuid, uuid);
drop function if exists public.consulting_event(uuid, text, jsonb);
drop function if exists public.consulting_expire_holds();
drop function if exists public.consulting_available_slots(uuid, uuid);
drop function if exists public.consulting_book(uuid, timestamptz, text);
drop function if exists public.consulting_cancel_booking(uuid, text);
drop function if exists public.consulting_reschedule_booking(uuid, timestamptz);
drop function if exists public.consulting_record_payment(uuid, bigint, text, text, date, text);
drop function if exists public.consulting_refund_payment(uuid, text, text);
drop function if exists public.consulting_join(uuid);
drop function if exists public.consulting_claim_reminders(integer);
drop function if exists public.consulting_claim_expiry_notices(integer);
drop function if exists public.consulting_save_report(uuid, date, text, text, text, text);
drop function if exists public.consulting_publish_report(uuid);
drop function if exists public.consulting_report_view(uuid);
drop function if exists public.consulting_add_report_file(uuid, text, text, bigint);
drop function if exists public.consulting_remove_report_file(uuid);
drop function if exists public.consulting_report_file_path(uuid);
drop function if exists public.consulting_set_advisor(uuid, text, boolean);
drop function if exists public.consulting_bookings_compute();
drop function if exists public.consulting_append_only();
drop function if exists public.consulting_reports_guard();
drop function if exists public.consulting_config_audit();
drop function if exists public.consulting_settings_touch();

drop type if exists public.consulting_report_status;
drop type if exists public.consulting_payment_status;
drop type if exists public.consulting_booking_status;
drop type if exists public.consulting_category;
drop type if exists public.consulting_mode;
drop type if exists public.consulting_offer_status;

commit;
