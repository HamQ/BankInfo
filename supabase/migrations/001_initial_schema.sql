-- =============================================
-- 台湾银行卡片资讯 — 数据库初始化
-- 在 Supabase SQL Editor 中执行此脚本
-- =============================================

-- 1. 银行基础信息
CREATE TABLE IF NOT EXISTS banks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        TEXT UNIQUE NOT NULL,
    name        TEXT NOT NULL,
    short_name  TEXT,
    website     TEXT,
    is_active   BOOLEAN DEFAULT TRUE,
    notes       TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 信用卡月报
CREATE TABLE IF NOT EXISTS monthly_credit_stats (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_id                  UUID NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
    report_month             DATE NOT NULL,
    cards_in_circulation     INTEGER,
    active_cards             INTEGER,
    cards_issued_month       INTEGER,
    cards_stopped_month      INTEGER,
    revolving_balance        BIGINT,
    installment_balance      BIGINT,
    transaction_volume       BIGINT,
    cash_advance_volume      BIGINT,
    delinquency_3m_ratio     NUMERIC(5,2),
    delinquency_6m_ratio     NUMERIC(5,2),
    bad_debt_coverage_ratio  NUMERIC(5,2),
    bad_debt_writeoff_month  BIGINT,
    bad_debt_writeoff_ytd    BIGINT,
    source_url               TEXT,
    fetched_at               TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(bank_id, report_month)
);

-- 3. 现金卡月报
CREATE TABLE IF NOT EXISTS monthly_cash_stats (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_id           UUID NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
    report_month      DATE NOT NULL,
    drawn_cards       INTEGER,
    undrawn_cards     INTEGER,
    contract_limit    BIGINT,
    available_limit   BIGINT,
    loan_balance      BIGINT,
    delinquency_ratio NUMERIC(5,2),
    provision_balance BIGINT,
    writeoff_month    BIGINT,
    writeoff_ytd      BIGINT,
    source_url        TEXT,
    fetched_at        TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(bank_id, report_month)
);

-- 4. 卡片产品
CREATE TABLE IF NOT EXISTS card_products (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_id          UUID NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    network          TEXT,
    card_level       TEXT,
    is_cobrand       BOOLEAN DEFAULT FALSE,
    co_brand_partner TEXT,
    key_benefits     TEXT,
    annual_fee       TEXT,
    source_page      TEXT,
    last_verified    DATE,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 洞察
CREATE TABLE IF NOT EXISTS insights (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_id    UUID REFERENCES banks(id) ON DELETE SET NULL,
    content    TEXT NOT NULL,
    category   TEXT,
    source_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 数位存款季度统计（补充）
CREATE TABLE IF NOT EXISTS quarterly_digital_acct_stats (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_id         UUID NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
    report_quarter  DATE NOT NULL,
    type1_accounts  INTEGER,
    type2_accounts  INTEGER,
    type3_accounts  INTEGER,
    total_accounts  INTEGER,
    source_url      TEXT,
    fetched_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(bank_id, report_quarter)
);

-- 7. 逾放资料（补充）
CREATE TABLE IF NOT EXISTS quarterly_npl_stats (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_id         UUID NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
    report_quarter  DATE NOT NULL,
    bank_type       TEXT,
    npl_ratio       NUMERIC(5,2),
    coverage_ratio  NUMERIC(5,2),
    source_url      TEXT,
    fetched_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 8. 储值卡季度统计（补充）
CREATE TABLE IF NOT EXISTS quarterly_stored_value_stats (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_id             UUID NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
    report_quarter      DATE NOT NULL,
    cards_in_circulation INTEGER,
    stored_amount        BIGINT,
    transaction_volume   BIGINT,
    source_url           TEXT,
    fetched_at           TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 索引
-- =============================================
CREATE INDEX IF NOT EXISTS idx_credit_stats_bank_month
    ON monthly_credit_stats(bank_id, report_month DESC);
CREATE INDEX IF NOT EXISTS idx_cash_stats_bank_month
    ON monthly_cash_stats(bank_id, report_month DESC);
CREATE INDEX IF NOT EXISTS idx_card_products_bank
    ON card_products(bank_id, network);
CREATE INDEX IF NOT EXISTS idx_insights_bank
    ON insights(bank_id, created_at DESC);

-- =============================================
-- RLS 策略: 公开可读，service_role 可写
-- =============================================
ALTER TABLE banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_credit_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_cash_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE quarterly_digital_acct_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE quarterly_npl_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE quarterly_stored_value_stats ENABLE ROW LEVEL SECURITY;

-- 公开读取
CREATE POLICY "Allow public read" ON banks FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON monthly_credit_stats FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON monthly_cash_stats FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON card_products FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON insights FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON quarterly_digital_acct_stats FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON quarterly_npl_stats FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON quarterly_stored_value_stats FOR SELECT USING (true);

-- service_role 可写入
CREATE POLICY "Allow service_role write" ON banks
    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service_role write" ON monthly_credit_stats
    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service_role write" ON monthly_cash_stats
    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service_role write" ON card_products
    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service_role write" ON insights
    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service_role write" ON quarterly_digital_acct_stats
    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service_role write" ON quarterly_npl_stats
    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service_role write" ON quarterly_stored_value_stats
    FOR ALL USING (true) WITH CHECK (true);
