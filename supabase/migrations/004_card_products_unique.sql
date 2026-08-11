-- Add unique constraint for card_products upsert
-- PostgreSQL doesn't support ADD CONSTRAINT IF NOT EXISTS, so we use a DO block
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_card_products_bank_name'
          AND conrelid = 'card_products'::regclass
    ) THEN
        ALTER TABLE card_products ADD CONSTRAINT uq_card_products_bank_name UNIQUE(bank_id, name);
    END IF;
END $$;
