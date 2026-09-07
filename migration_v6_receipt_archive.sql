-- ============================================================================
-- DukaSmart v6 — archiving receipts, instead of deleting them
--
-- Run once in the Supabase SQL editor, after
-- migration_v5_warranty_and_imei_snapshot.sql.
--
-- WHY ARCHIVE AND NOT DELETE
--   The ask was to clear out receipts once their warranty had lapsed. Deleting
--   a sale would take the profit reports with it — they are computed from sale
--   history, so last year's figures would silently change — orphan the customer
--   loan ledger, and empty the IMEI lookup that answers "did this shop sell
--   this handset?". Warranties lapse in months; tax records are kept for years,
--   and the receipt is also what protects the shop when a customer claims cover
--   that had already expired.
--
--   Archiving is therefore a view flag and nothing more. An archived sale is
--   hidden from the receipts list, and still counted in every report, still
--   searchable by IMEI, and restorable in one tap. Nothing is destroyed.
-- ============================================================================

begin;

alter table public.sales
  add column if not exists archived_at timestamptz;

comment on column public.sales.archived_at is
  'Set when the shopkeeper files a receipt away. Presentation only: archived sales still count in reports and IMEI lookup.';

-- Partial index: the receipts list asks for the unarchived ones on every open.
create index if not exists sales_archived_at_idx
  on public.sales (user_id, archived_at);

commit;

notify pgrst, 'reload schema';
