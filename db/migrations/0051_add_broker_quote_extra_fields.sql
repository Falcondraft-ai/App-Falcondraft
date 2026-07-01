-- Devis compagnie : champs supplémentaires pour un devoir de conseil exhaustif.
--   vigilance_points : exclusions, délais de carence et points de vigilance
--   other_info       : champ libre « Autres informations » (catch-all)
ALTER TABLE broker_quotes
  ADD COLUMN IF NOT EXISTS vigilance_points text,
  ADD COLUMN IF NOT EXISTS other_info text;
