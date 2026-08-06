# 🏦 台湾信用卡情报雷达 — 项目参考手册

> 最后更新: 2026-08-06
> Phase 1 完成

---

## 一、项目概览

| 项目 | 值 |
|------|-----|
| 本地路径 | `D:\PrslProject\HamQ\BankInfo` |
| GitHub 仓库 | https://github.com/HamQ/BankInfo |
| 前端页面 | `#/` Dashboard / `#/bank/:id` 银行详情 / `#/compare` 对比 (待 Phase 2 开发) |
| 默认分支 | `main` |

---

## 二、密钥与账号

### Supabase

| 项目 | 值 |
|------|-----|
| Project Name | `bankinfoCUPfdwn` |
| Project URL | `https://hpuatpbfbfxeyljfbjgs.supabase.co` |
| Anon Key (前端用) | _从 Supabase Dashboard → Settings → API 获取_ |
| Service Role Key (后端用) | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwdWF0cGJmYmZ4ZXlsamZiamdzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTk3NjYzMiwiZXhwIjoyMTAxNTUyNjMyfQ.evBVkkGaUCrYe0pd4rEcm9-U-xNfg822gFXSSH85ChY` |
| Database Password | _你在创建时生成的密码_ |
| Region | Asia-Pacific |

### GitHub

| 项目 | 值 |
|------|-----|
| 账号 | `HamQ` |
| 仓库 | `HamQ/BankInfo` (public) |
| Secrets | `SUPABASE_URL` = `https://hpuatpbfbfxeyljfbjgs.supabase.co` |
|  | `SUPABASE_SERVICE_KEY` = _(同上 service_role key)_ |
| Actions | `.github/workflows/monthly_sync.yml` 每月 5 号自动运行 |

### DeepSeek API (待 Phase 4 使用)

| 项目 | 值 |
|------|-----|
| API Key | _(待提供)_ |

---

## 三、数据库表结构

### 核心表

| 表 | 说明 | 当前笔数 |
|---|------|---------|
| `banks` | 32 家银行基础信息 | 32 |
| `monthly_credit_stats` | 信用卡月报 (14 指标) | 928 |
| `monthly_cash_stats` | 现金卡月报 (9 指标) | 342 |
| `card_products` | 银行卡产品 (待 Phase 4 填充) | 0 |
| `insights` | 人工/AI 洞察 | 0 |

### 补充表 (轻量)

| 表 | 说明 |
|---|------|
| `quarterly_digital_acct_stats` | 数位存款季度统计 |
| `quarterly_npl_stats` | 逾放资料 |
| `quarterly_stored_value_stats` | 储值卡季度统计 |

### 已知 Schema 修复

| 修复 | SQL |
|------|-----|
| `monthly_credit_stats.bad_debt_coverage_ratio` 溢出 | `ALTER TABLE monthly_credit_stats ALTER COLUMN bad_debt_coverage_ratio TYPE NUMERIC(8,2);` ✅ 已执行 |
| `monthly_cash_stats.delinquency_ratio` 溢出 | `ALTER TABLE monthly_cash_stats ALTER COLUMN delinquency_ratio TYPE NUMERIC(8,2);` ✅ 已执行 |

---

## 四、数据源

| 数据 | 来源 | dataserno |
|------|------|-----------|
| 信用卡月报 | https://www.banking.gov.tw/ch/home.jsp?id=591&parentpath=0,590&mcustomize=multimessage_view.jsp&dataserno=21207&dtable=Disclosure | 21207 |
| 现金卡月报 | https://www.banking.gov.tw/ch/home.jsp?id=591&parentpath=0,590&mcustomize=multimessage_view.jsp&dataserno=21206&dtable=Disclosure | 21206 |
| 数位存款 | 同上页面 | 201911270001 |
| 逾放资料 | 同上页面 | 201202130001 |

### 年份换算

**民国年 = 公元年 - 1911**
- 115 年 = 2026 年
- 114 年 = 2025 年
- 113 年 = 2024 年

---

## 五、项目文件结构

```
BankInfo/
├── .github/workflows/
│   └── monthly_sync.yml              ← Actions 每月自动同步
├── supabase/migrations/
│   ├── 001_initial_schema.sql        ← 建表 + RLS
│   └── 002_grant_permissions.sql     ← service_role 授权
├── scripts/
│   ├── requirements.txt              ← Python 依赖
│   ├── seed_banks.py                 ← 银行种子数据 (运行一次)
│   ├── fetch_credit_stats.py         ← 信用卡月报 v2 (增量)
│   └── fetch_cash_stats.py           ← 现金卡月报 v2 (增量)
├── docs/plans/
│   └── 2026-08-05-...-design.md      ← 设计文档
├── frontend/                         ← (Phase 2)
└── README.md                         ← (Phase 2)
```

---

## 六、本地运行命令

```powershell
# 设置环境变量
$env:SUPABASE_URL="https://hpuatpbfbfxeyljfbjgs.supabase.co"
$env:SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwdWF0cGJmYmZ4ZXlsamZiamdzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTk3NjYzMiwiZXhwIjoyMTAxNTUyNjMyfQ.evBVkkGaUCrYe0pd4rEcm9-U-xNfg822gFXSSH85ChY"

# 安装依赖
pip install -r scripts/requirements.txt

# 初始化银行数据 (仅首次)
python scripts/seed_banks.py

# 同步信用卡月报 (增量)
python scripts/fetch_credit_stats.py

# 同步现金卡月报 (增量)
python scripts/fetch_cash_stats.py
```

---

## 七、注意事项

1. **金管局 SSL 证书** — 脚本已配置忽略证书验证（金管局证书链不完整）
2. **URL 中文编码** — 旧版 ZIP 链接含原始中文，脚本自动 URL 转义
3. **民国/公元** — 前端显示时需同时展示两种记年法
4. **RLS 策略** — 所有表公开可读，`service_role` 可写；Python 脚本用 `SUPABASE_SERVICE_KEY`
5. **GitHub Actions** — 需确保 token 包含 `workflow` scope
6. **2GB 硬盘预算** — 当前数据库 < 1MB，充足
