-- Migration 003: 修正 quarterly_npl_stats 表结构
-- 实际 NPL Excel 包含原始财务数据，非比率

-- 修改列类型以容纳更大数值
ALTER TABLE quarterly_npl_stats 
  ALTER COLUMN npl_ratio TYPE NUMERIC(10,2),
  ALTER COLUMN coverage_ratio TYPE NUMERIC(10,2);

-- 添加原始数据列
ALTER TABLE quarterly_npl_stats
  ADD COLUMN IF NOT EXISTS deposits BIGINT,
  ADD COLUMN IF NOT EXISTS pre_tax_profit BIGINT,
  ADD COLUMN IF NOT EXISTS total_loans BIGINT,
  ADD COLUMN IF NOT EXISTS overdue_loans BIGINT,
  ADD COLUMN IF NOT EXISTS loan_allowance BIGINT;

-- 添加唯一约束
ALTER TABLE quarterly_npl_stats 
  ADD CONSTRAINT IF NOT EXISTS uq_npl_bank_quarter UNIQUE(bank_id, report_quarter);
