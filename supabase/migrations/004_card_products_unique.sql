-- Add unique constraint for card_products upsert
ALTER TABLE card_products ADD CONSTRAINT IF NOT EXISTS uq_card_products_bank_name UNIQUE(bank_id, name);
