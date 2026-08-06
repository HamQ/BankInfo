# 台湾信用卡情报雷达 — 参考手册

> 最后更新: 2026-08-06  
> Phase 1-3 完成状态

---

## 一、环境信息

| 项目 | 值 |
|------|-----|
| **Supabase URL** | `https://hpuatpbfbfxeyljfbjgs.supabase.co` |
| **Supabase Anon Key** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwdWF0cGJmYmZ4ZXlsamZiamdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5NzY2MzIsImV4cCI6MjEwMTU1MjYzMn0.Hd66KOtwvk1Dc0vyG12dB5nUyfhWj4_gqoRdfoyeb-8` |
| **GitHub Pages** | `https://hamq.github.io/BankInfo/` |
| **GitHub Repo** | `https://github.com/HamQ/BankInfo` |
| **数据源** | 金管局 (banking.gov.tw) |

---

## 二、数据库表

| 表名 | 用途 | 当前记录数 |
|------|------|-----------|
| `banks` | 银行基础信息 | 38 |
| `monthly_credit_stats` | 信用卡月报 | ~12×32 |
| `monthly_cash_stats` | 现金卡月报 | ~12×32 |
| `quarterly_digital_acct_stats` | 数位存款季度统计 | 315 |
| `quarterly_npl_stats` | 逾放资料月度统计 | 826 |
| `card_products` | 卡片产品 | 待填充 |
| `insights` | 洞察/新闻 | 待填充 |

---

## 三、脚本清单

| 脚本 | 用途 | 频率 |
|------|------|------|
| `seed_banks.py` | 初始化银行数据 | 仅首次 |
| `fetch_credit_stats.py` | 信用卡月报同步 | 每月/GitHub Actions |
| `fetch_cash_stats.py` | 现金卡月报同步 | 每月/GitHub Actions |
| `fetch_quarterly.py` | 数位存款 + 逾放资料同步 | 每季/GitHub Actions |

**v5 更新 (2026-08-06):**
- 修复 Excel 解析：银行名匹配（列A是银行全名非代码）
- 支持三种 Excel 格式：`.xlsx` (openpyxl) / `.xls` (xlrd) / `.ods` (pandas)
- NPL URL 匹配覆盖全部 82 个 ZIP
- NPL 解析器重写：从原始财务数据计算逾放比率和备抵覆盖率
- 去重机制：基于 `(bank_id, report_quarter)` 的精确去重

---

## 四、迁移文件

| 文件 | 说明 |
|------|------|
| `001_initial_schema.sql` | 建表 + RLS 策略 |
| `002_grant_permissions.sql` | 授权 anon key 读取权限 |
| `003_fix_npl_schema.sql` | 修复 NPL 表精度 + 新增原始数据列 + 唯一约束 |

---

## 五、前端架构

```
BankInfo/
├── index.html                         ← 入口 (Vue SPA)
├── frontend/
│   ├── app.js                         ← Vue Router 配置
│   ├── utils/supabase.js              ← Supabase 客户端
│   ├── styles/main.css                ← 全局样式 (Dark Premium v2 + Mobile)
│   └── components/
│       ├── dashboard.js               ← 首页仪表盘
│       ├── bank-detail.js             ← 银行详情页
│       └── bank-compare.js            ← 银行对比页 (雷达图+表格+趋势)
├── scripts/                           ← Python 数据脚本
├── supabase/migrations/               ← SQL 建表迁移
└── docs/                              ← 文档
```

---

## 六、Phase 3 完成项

✅ 银行对比页 (雷达图 + 指标表 + 趋势线)  
✅ 数位存款季度数据接入 (315 条)  
✅ 逾放资料月度数据接入 (826 条, 110年1月-111年12月)  
✅ GitHub Actions 自动运行季度脚本  
✅ 银行详情页图表 + 浅色主题  
✅ 移动端响应式适配  

---

## 七、Phase 4 计划 (待讨论)

1. **AI 爬虫** — DeepSeek API 爬取银行官网卡产品信息
2. **卡产品自动识别** — Visa/Mastercard/JCB Logo + 权益分析
3. **洞察模块** — 自动生成 RFP 卖点提示
4. **PWA 离线支持** — Service Worker 缓存

---

## 八、本地运行

```powershell
# 环境变量 (cmd)
set SUPABASE_URL=https://hpuatpbfbfxeyljfbjgs.supabase.co
set SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwdWF0cGJmYmZ4ZXlsamZiamdzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTk3NjYzMiwiZXhwIjoyMTAxNTUyNjMyfQ.evBVkkGaUCrYe0pd4rEcm9-U-xNfg822gFXSSH85ChY

pip install -r scripts/requirements.txt
python scripts/seed_banks.py              # 仅首次
python scripts/fetch_credit_stats.py      # 信用卡月报
python scripts/fetch_cash_stats.py        # 现金卡月报
python scripts/fetch_quarterly.py         # 季度补充数据
```

---

## 九、注意事项

1. **民国/公元** — 前端同时显示两种记年法 (如 115年/2026年)
2. **金管局 SSL** — Python 脚本已忽略证书验证
3. **RLS** — 所有表公开可读，`service_role` 可写
4. **source_url** — 脚本优先存 PDF URL (`.zip` → `.pdf`)
5. **缓存** — JS 引用带 `?v=N` 版本号
6. **银行代码** — seed_banks.py 部分代码可能有误（101/102/103/108），季度脚本用名称匹配不受影响
