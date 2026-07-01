-- Multi-adresse : une seule boîte Outlook peut regrouper plusieurs adresses SMTP.
-- On mémorise l'adresse du cabinet sur laquelle chaque email est arrivé, pour
-- l'afficher (pastille couleur) et donner ce contexte à l'IA lors du tri.
ALTER TABLE broker_email_items
  ADD COLUMN IF NOT EXISTS mailbox_address text;
