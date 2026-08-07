# 台湾信用卡情报雷达 — 参考手册

> 最后更新: 2026-08-07 Phase 4B
> Phase 1-4A 完成 | 200张卡 · 13家银行 · 全network识别

| 分类 | 银行数 | 代表银行 | 原因 |
|------|--------|----------|------|
| ✅ **已有卡片** | 13 | 玉山/远东/台新/永丰/渣打... | Phase 4A 成功 |
| 🚫 **主动拦截** | 7 | 中信/第一/富邦/花旗/星展/上海SPA | 检测 headless，返回 APP-1053/403/502 |
| 📄 **无卡列表** | 5 | 土地/彰化/元大/凯基/安泰 | 页面可见但卡片数据由 API 动态加载，innerText 只有导航 |

---

## 一、环境信息

| 项目 | 值 |
|------|-----|
| **Supabase URL** | `https://hpuatpbfbfxeyljfbjgs.supabase.co` |
| **Supabase Anon Key** | `eyJhbGci...oyeb-8` (公开读取) |
| **Supabase Service Key** | `eyJhbGci...H85ChY` (写入, 保密!) |
| **DeepSeek API Key** | `sk-30d87dba71aa437bb2ed4dde74cb85c9` (保密!) |
| **GitHub Pages** | `https://hamq.github.io/BankInfo/` |
| **GitHub Repo** | `https://github.com/HamQ/BankInfo` |
| **数据源** | 金管局 banking.gov.tw |

---

## 二、数据库表

| 表名 | 用途 | 记录数 |
|------|------|--------|
| `banks` | 银行基础信息 | 38 |
| `monthly_credit_stats` | 信用卡月报 | ~400 |
| `monthly_cash_stats` | 现金卡月报 | ~400 |
| `quarterly_digital_acct_stats` | 数位存款季度 | 315 |
| `quarterly_npl_stats` | 逾放资料 | 826 |
| `card_products` | 卡片产品 | **200** |
| `insights` | 洞察/新闻 (RFP卖点) | 82 |

---

## 三、脚本清单

### 3.1 数据同步脚本

| 脚本 | 用途 | 触发频率 | 依赖 |
|------|------|----------|------|
| `seed_banks.py` | 初始化银行数据 | 仅首次 | supabase |
| `fetch_credit_stats.py` | 信用卡月报 | 每月/GitHub Actions | openpyxl,requests,supabase |
| `fetch_cash_stats.py` | 现金卡月报 | 每月/GitHub Actions | 同上 |
| `fetch_quarterly.py` | 季度数据(数位存款+逾放) | 每季/GitHub Actions | 同上+pandas+xlrd |

### 3.2 卡片爬虫

| 脚本 | 用途 | 触发频率 | 依赖 |
|------|------|----------|------|
| `card_crawler.py` | AI 爬取银行官网信用卡 | 按需/GitHub Actions | **Playwright+Chromium+DeepSeek** |

### 3.3 辅助脚本

| 脚本 | 用途 |
|------|------|
| `add_extra_banks.py` | 补充新增银行 |
| `fix_source_urls.py` | 修复数据出处链接 |
| `_gen.py` | 代码生成辅助 |

---

## 四、GitHub Actions 自动化

### 4.1 月度同步 (自动)
**文件**: `.github/workflows/monthly_sync.yml`
- **触发**: 每月5日0:00 UTC + 手动 `workflow_dispatch`
- **执行**: `fetch_credit_stats.py` → `fetch_cash_stats.py` → `fetch_quarterly.py`
- **Secrets 需要**: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`

### 4.1B 全量更新 (手动触发)
**文件**: `.github/workflows/sync_all.yml`
- **触发**: 手动 `workflow_dispatch`
- **执行**: 月度同步 → 季度 → 卡片爬虫 → 洞察生成 (全串联)
- **Secrets 需要**: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`

### 4.2 卡片爬虫 (手动触发)

**触发方式**:
1. 打开 https://github.com/HamQ/BankInfo/actions/workflows/card_crawl.yml
2. 点击 "Run workflow" 按钮
3. 可选填入银行代码(如 013 808 812)，留空=全部
4. 点击绿色 "Run workflow" 确认执行

**文件**: `.github/workflows/card_crawl.yml`
**文件**: `.github/workflows/card_crawl.yml`
- **触发**: 手动 `workflow_dispatch`，可选填入银行代码
- **执行**: `card_crawler.py`（全部或指定银行）
- **Secrets 需要**: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- **注意**: 需要 Playwright + Chromium (workflow 中自动安装)

### 4.3 需要配置的 GitHub Secrets

在 `https://github.com/HamQ/BankInfo/settings/secrets/actions` 添加：
- `SUPABASE_URL` = `https://hpuatpbfbfxeyljfbjgs.supabase.co`
- `SUPABASE_SERVICE_KEY` = (service_role key)

---

## 五、本地运行

```powershell
# 环境变量 (cmd)
set SUPABASE_URL=https://hpuatpbfbfxeyljfbjgs.supabase.co
set SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# 安装依赖
pip install -r scripts/requirements.txt

# 基础数据
python scripts/seed_banks.py              # 仅首次
python scripts/fetch_credit_stats.py      # 信用卡月报
python scripts/fetch_cash_stats.py        # 现金卡月报
python scripts/fetch_quarterly.py         # 季度补充数据

# 卡片产品爬虫 (需要 Playwright)
pip install playwright
python -m playwright install chromium
python scripts/card_crawler.py            # 全部银行
python scripts/card_crawler.py 013 808    # 指定银行
```

---

## 六、前端架构

```
BankInfo/
├── index.html                    ← 入口 (Vue 3 SPA, Hash Router)
├── frontend/
│   ├── app.js                    ← Vue Router (Dashboard/Bank/Compare)
│   ├── utils/supabase.js         ← Supabase 客户端
│   ├── styles/main.css           ← 全局样式 (Dark Premium + Mobile)
│   └── components/
│       ├── dashboard.js          ← 首页仪表盘
│       ├── bank-detail.js        ← 银行详情 (图表+卡片产品+季度数据)
│       └── bank-compare.js       ← 银行对比 (雷达图+表格)
├── scripts/                      ← Python 数据脚本
├── supabase/migrations/          ← SQL 建表迁移
└── docs/                         ← 文档
```

### 页面路由
| 路由 | 页面 | 说明 |
|------|------|------|
| `#/` | Dashboard | Top排名 + 银行列表(可排序) + 扫描按钮 |
| `#/bank/:id` | 银行详情 | 月度趋势+季度图表+**卡片产品+🔗来源** |
| `#/compare` | 银行对比 | 任选2-4家银行并排对比 |

---

## 七、Phase 4A — 卡片产品 (已完成)

**200 张卡 · 13 家银行 · 全 Network 识别**

| 银行 | Code | 卡片 | Visa | MC | JCB | Other |
|------|------|------|------|-----|-----|-------|
| 玉山银行 | 808 | 56 | 40 | 15 | 1 | - |
| 远东银行 | 805 | 27 | 21 | 6 | - | - |
| 台新银行 | 812 | 20 | 14 | 6 | - | - |
| 永丰银行 | 807 | 18 | 11 | 7 | - | - |
| 渣打银行 | 052 | 13 | 7 | 6 | - | - |
| 中小企银 | 050 | 12 | 4 | 8 | - | - |
| 兆丰银行 | 017 | 10 | 4 | 6 | - | - |
| 国泰世华 | 013 | 9 | 4 | 5 | - | - |
| 联邦银行 | 803 | 9 | 5 | 4 | - | - |
| 汇丰银行 | 081 | 7 | 6 | 1 | - | - |
| 乐天卡 | RC001 | 7 | 4 | - | 3 | - |
| 新光银行 | 102 | 6 | 5 | 1 | - | - |
| 王道银行 | 048 | 6 | 2 | 3 | - | 1 (银联) |

**Network 总计**: Visa 141 (70.5%) · MC 52 (26%) · JCB 6 (3%) · UnionPay 1

**策略**: 文本页+DeepSeek 分析 · API拦截(新光) · 规则+AI 批量识别 Network

---

## 八、Phase 4B — RFP 洞察引擎 (✅ 已完成)

### 目标
结合金管局趋势数据 + 卡片产品信息，自动生成 RFP 卖点提示

### 示例洞察
- 联名卡 > 10张 → "碎片化严重，推 Vision Next 参数化能力"
- 有效卡率下降 → "促活需求，卖 Loyalty/Campaign 模块"
- 循环信用高 → "风控/催收需求，卖 Collections 接口"

### 数据需求
- `insights` 表已有 schema，需填充数据
- 结合 `monthly_credit_stats` 趋势 + `card_products` 产品组合

---

## 九、已知限制

| 限制 | 应对 |
|------|------|
| SPA 银行无法自动爬取 | 标记为跳过，需手动浏览器访问 |
| Network 识别依赖 AI 推断 | 非官方数据，定性分析参考 |
| GitHub Actions 免费额度 2000min/月 | 月度触发绰绰有余 |
| NPL 季度数据仅到 2022 年 | find_zips_npl 正则需更新 |

---

## 十、民国/公元对照

| 民国 | 公元 |
|------|------|
| 113年 | 2024年 |
| 114年 | 2025年 |
| 115年 | 2026年 |

前端同时显示两种记年法 (如 `115/05 → 2026.05`)
