-- Bespoke broker dossiers: store the client's date of birth (individuals).
ALTER TABLE "broker_clients"
  ADD COLUMN IF NOT EXISTS "date_of_birth" date;
