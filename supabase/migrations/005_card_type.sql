-- Add card_type column to card_products
ALTER TABLE card_products ADD COLUMN IF NOT EXISTS card_type TEXT DEFAULT 'personal';
-- card_type values: personal, business, cobrand, debit, commercial
COMMENT ON COLUMN card_products.card_type IS 'personal/business/cobrand/debit/commercial';
