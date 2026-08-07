-- 为 quarterly_npl_stats 添加唯一约束
ALTER TABLE quarterly_npl_stats ADD CONSTRAINT IF NOT EXISTS uq_npl_bank_quarter UNIQUE(bank_id, report_quarter);

-- 为 quarterly_stored_value_stats 也添加
ALTER TABLE quarterly_stored_value_stats ADD CONSTRAINT IF NOT EXISTS uq_sv_bank_quarter UNIQUE(bank_id, report_quarter);
