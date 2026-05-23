-- Add deal-level quote configuration fields
ALTER TABLE deals
  ADD COLUMN quote_client_type TEXT CHECK (quote_client_type IN ('company', 'individual')),
  ADD COLUMN quote_price_ht NUMERIC CHECK (quote_price_ht IS NULL OR quote_price_ht > 0),
  ADD COLUMN quote_tax_rate NUMERIC CHECK (quote_tax_rate IS NULL OR quote_tax_rate IN (0, 5.5, 10, 20));

-- Add organization-level quote defaults
ALTER TABLE organizations
  ADD COLUMN default_quote_client_type TEXT NOT NULL DEFAULT 'company' CHECK (default_quote_client_type IN ('company', 'individual')),
  ADD COLUMN default_quote_tax_rate NUMERIC NOT NULL DEFAULT 20 CHECK (default_quote_tax_rate IN (0, 5.5, 10, 20));

NOTIFY pgrst, 'reload schema';
