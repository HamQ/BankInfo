# 🏦 台湾信用卡情报雷达 — 项目参考手册

> 最后更新: 2026-08-06
> Phase 1 & 2 完成

---

## 一、项目概览

| 项目 | 值 |
|------|-----|
| 本地路径 | `D:\PrslProject\HamQ\BankInfo` |
| GitHub 仓库 | https://github.com/HamQ/BankInfo (public) |
| 线上地址 | https://hamq.github.io/BankInfo/ |
| 默认分支 | `main` |

---

## 二、密钥与账号

### Supabase

| 项目 | 值 |
|------|-----|
| Project Name | `bankinfoCUPfdwn` |
| Project URL | `https://hpuatpbfbfxeyljfbjgs.supabase.co` |
| Anon Key (前端) | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwdWF0cGJmYmZ4ZXlsamZiamdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5NzY2MzIsImV4cCI6MjEwMTU1MjYzMn0.Hd66KOtwvk1Dc0vyG12dB5nUyfhWj4_gqoRdfoyeb-8` |
| Service Role Key (后端) | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwdWF0cGJmYmZ4ZXlsamZiamdzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTk3NjYzMiwiZXhwIjoyMTAxNTUyNjMyfQ.evBVkkGaUCrYe0pd4rEcm9-U-xNfg822gFXSSH85ChY` |
| Database Password | 创建时设定 |
| Region | Asia-Pacific |

### GitHub

| 项目 | 值 |
|------|-----|
| 账号 | `HamQ` |
| 仓库 | `HamQ/BankInfo` (public) |
| Secrets | `SUPABASE_URL` = `https://hpuatpbfbfxeyljfbjgs.supabase.co` |
|  | `SUPABASE_SERVICE_KEY` = service_role key |

### DeepSeek API (Phase 4 使用)

| 项目 | 值 |
|------|-----|
| API Key | _(待提供)_ |

---

## 三、Phase 1 — 数据层 ✅

### 数据库表

| 表 | 说明 | 数据量 |
|---|------|--------|
| `banks` | 32 家银行基础信息 | 32 |
| `monthly_credit_stats` | 信用卡月报 (14 指标) | ~928 |
| `monthly_cash_stats` | 现金卡月报 (9 指标) | ~342 |
| `card_products` | 银行卡产品 (待 Phase 4) | 0 |
| `insights` | 洞察 (待 Phase 4) | 0 |
| `quarterly_digital_acct_stats` | 数位存款季度统计 | 0 |
| `quarterly_npl_stats` | 逾放资料 | 0 |
| `quarterly_stored_value_stats` | 储值卡季度统计 | 0 |

### 数据源

| 数据 | Gov URL | dataserno |
|------|---------|-----------|
| 信用卡月报 | banking.gov.tw/.../Disclosure | 21207 |
| 现金卡月报 | banking.gov.tw/.../Disclosure | 21206 |

### 脚本

| 文件 | 用途 |
|------|------|
| `scripts/seed_banks.py` | 初始化银行数据 (一次性) |
| `scripts/fetch_credit_stats.py` | 信用卡月报增量同步 (存 PDF URL) |
| `scripts/fetch_cash_stats.py` | 现金卡月报增量同步 (存 PDF URL) |
| `scripts/requirements.txt` | Python 依赖 |

### GitHub Actions

| 文件 | 说明 |
|------|------|
| `.github/workflows/monthly_sync.yml` | 每月自动同步 |

---

## 四、Phase 2 — 前端 ✅

### 页面

| 路由 | 内容 |
|------|------|
| `#/` | Dashboard：信用卡/现金卡 Tab 切换、Top 排行、全银行表格 |
| `#/bank/:id` | 银行详情：指标卡、月度趋势图 (点击跳转金管 PDF)、卡产品、洞察 |
| `#/compare` | 银行对比 (待完善) |

### 功能特性

- 💳/💰 Tab 切换：信用卡 vs 现金卡独立视图
- 📊 ECharts 暗色主题趋势图，点击数据点直接打开金管局对应月份 PDF
- 🏆 排行 Bento Grid：流通卡数、签帐金额、有效卡率 Bottom 5
- 📱 响应式：平板 (1024px) + 手机 (640px) 双断点
- 🎨 Dark Premium 主题：毛玻璃卡片、渐变 accent、发光效果
- 🔗 所有链接标注来源，可追溯至金管局原始档案

### 文件结构

```
BankInfo/
├── index.html                         ← 入口 (Vue SPA)
├── frontend/
│   ├── app.js                         ← Vue Router 配置
│   ├── utils/supabase.js              ← Supabase 客户端 + 全局工具函数
│   ├── styles/main.css                ← 全局样式 (Dark Premium v2)
│   └── components/
│       ├── dashboard.js               ← 首页仪表盘
│       ├── bank-detail.js             ← 银行详情页
│       └── bank-compare.js            ← 银行对比页
├── scripts/                           ← Python 数据脚本
├── supabase/migrations/               ← SQL 建表迁移
└── docs/                              ← 文档
```

---

## 五、Phase 3 计划 (待讨论)

建议方向：
1. **银行对比页完善** — 多选银行横向对比指标雷达图
2. **数位存款/逾放数据接入** — 补充季度数据
3. **Phase 4 准备** — AI 爬虫 + 卡产品自动识别 (DeepSeek)
4. **PWA 离线支持** — Service Worker 缓存

---

## 六、本地运行

```powershell
$env:SUPABASE_URL="https://hpuatpbfbfxeyljfbjgs.supabase.co"
$env:SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwdWF0cGJmYmZ4ZXlsamZiamdzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTk3NjYzMiwiZXhwIjoyMTAxNTUyNjMyfQ.evBVkkGaUCrYe0pd4rEcm9-U-xNfg822gFXSSH85ChY"

pip install -r scripts/requirements.txt
python scripts/seed_banks.py        # 仅首次
python scripts/fetch_credit_stats.py
python scripts/fetch_cash_stats.py
```

---

## 七、注意事项

1. **民国/公元** — 前端同时显示两种记年法
2. **金管局 SSL** — Python 脚本已忽略证书验证
3. **RLS** — 所有表公开可读，`service_role` 可写
4. **source_url** — 脚本存 PDF URL (`.zip` → `.pdf`)，前端也兜底转换
5. **缓存** — JS 引用带 `?v=N` 版本号
