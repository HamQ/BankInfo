# 台湾银行卡片资讯 — 系统设计文档

> **项目代号**: BankInfo  
> **目标用户**: 个人使用（SDM 售前/会议/内部研究）  
> **最后更新**: 2026-08-05  
> **状态**: 设计定稿，待开发

---

## 1. 项目背景

SDM 工作内容跨销售/开发/维护部门，主要业务为 Fiserv Vision PLUS (FVA) 及 Vision Next 信用卡核心系统。近期商机多来自台湾，需要一套个人情报平台，用于：

- **RFP 响应前** 快速了解目标银行的发卡规模、业务特征、数字化程度
- **内部会议** 有数据支撑地描述银行现状
- **客户演示** 展示对客户业务的深入理解
- **竞品分析** 横向对比各家银行卡片产品差异

核心原则：**所有数据必须有迹可循，参考来源必须注明**。

---

## 2. 系统架构

```
┌─────────────────────────────────────────────────────┐
│                  GitHub 仓库                          │
│  ├── frontend/        ← Vue 3 CDN SPA（零构建）       │
│  ├── scripts/         ← Python 解析/爬虫脚本           │
│  └── .github/workflows ← Actions 月度自动抓取          │
└──────────┬──────────────────────┬───────────────────┘
           │                      │
     GitHub Pages            GitHub Actions
     (前端静态托管)          (Excel/ODS 解析 → Supabase)
           │                      │
           └──────────┬───────────┘
                      │
                  Supabase
              (PostgreSQL 数据库)
                      │
        ┌─────────────┴─────────────┐
        │                           │
   个人电脑                        公司电脑
   (浏览器打开 Pages)              (浏览器打开 Pages)
   (可跑本地 AI 分析卡片)          (纯浏览，零权限)
```

- **前端** 始终从 Supabase 读取数据，任何设备打开浏览器即可
- **金管局 Excel/ODS** 由 GitHub Actions 每月自动解析入库
- **银行官网卡片分析**（Visa/MC/JCB 等）由个人电脑跑 DeepSeek 辅助脚本，离线分析后一次性入库
- **零服务器依赖**、零成本运营

---

## 3. 技术选型

| 层 | 技术 | 引入方式 |
|---|------|---------|
| 前端框架 | Vue 3 (Composition API) | CDN (`unpkg.com`) |
| 路由 | Vue Router 4 | CDN |
| 图表 | ECharts | CDN |
| 数据库 | Supabase (PostgreSQL) | 官方 CDN (`supabase.co`) |
| 后端解析 | Python (openpyxl/pandas) | GitHub Actions |
| AI 辅助 | DeepSeek API | 个人电脑本地调用 |

**设计原则**: 零构建（无 node_modules/package.json）、纯 CDN 引入、GitHub Pages 直接托管原始文件。

---

## 4. 数据来源

### 4.1 主数据源 — 金管局银行务资讯揭露

页面入口: `https://www.banking.gov.tw/ch/home.jsp?id=591&parentpath=0,590`

| 优先级 | 报表名称 | 数据格式 | 更新频率 | 对应数据表 |
|--------|---------|---------|---------|-----------|
| ⭐⭐⭐ | 信用卡重要务及财务资讯揭露 (21207) | Excel/ODS (ZIP) | 月 | `monthly_credit_stats` |
| ⭐⭐⭐ | 现金卡重要务及财务资讯揭露 (21206) | Excel/ODS (ZIP) | 月 | `monthly_cash_stats` |
| ⭐⭐ | 数位存款帐户务统计 | Excel/ODS (ZIP) | 季 | `quarterly_digital_acct_stats` |
| ⭐⭐ | 本国银行逾放等财务资料揭露 | Excel/ODS | 季 | `quarterly_npl_stats` |
| ⭐ | 本国银行转销呆帐金额汇总表 | Excel/ODS | 年 | `annual_writeoff_stats` |
| ⭐ | 储值卡(电子票证)重要务资讯揭露 | Excel/ODS | 季 | `quarterly_stored_value_stats` |

### 4.2 辅助数据源 — 各银行官网

- 卡片产品列表（卡名、发卡组织 Logo、等级、联名方、权益摘要）
- 分析方式：DeepSeek AI 辅助解析网页 → 人工核验 → 一次性入库
- 后续仅页面结构变更时才重新分析

### 4.3 银行列表

金管局报表中出现的全量 32 家机构：

臺灣銀行、臺灣土地銀行、合作金庫商業銀行、第一商業銀行、華南商業銀行、彰化商業銀行、上海商業儲蓄銀行、台北富邦商業銀行、國泰世華商業銀行、高雄銀行、兆豐國際商業銀行、花旗(台灣)商業銀行、臺灣中小企業銀行、渣打國際商業銀行、台中商業銀行、滙豐(台灣)商業銀行、華泰商業銀行、臺灣新光商業銀行、陽信商業銀行、三信商業銀行、聯邦商業銀行、遠東國際商業銀行、元大商業銀行、永豐商業銀行、玉山商業銀行、凱基商業銀行、星展(台灣)商業銀行、台新國際商業銀行、安泰商業銀行、中國信託商業銀行、台灣樂天信用卡股份有限公司、台灣美國運通國際(股)公司

---

## 5. 资料库表设计

### 5.1 `banks` — 银行基础资讯

| 列 | 类型 | 说明 |
|---|---|---|
| `id` | `uuid` PK | |
| `code` | `text` | 金管局机构代码 |
| `name` | `text` | 中文全称 |
| `short_name` | `text` | 简称（如"国泰世华"） |
| `website` | `text` | 官网 URL |
| `is_active` | `bool` | 是否仍在发卡 |
| `notes` | `text` | 手动备注（如"花旗消金已售星展"） |

### 5.2 `monthly_credit_stats` — 信用卡月报

| 列 | 类型 | 说明 |
|---|---|---|
| `id` | `uuid` PK | |
| `bank_id` | `fk → banks` | |
| `report_month` | `date` | 报表月份 |
| `cards_in_circulation` | `int` | 流通卡数 |
| `active_cards` | `int` | 有效卡数 |
| `cards_issued_month` | `int` | 当月发卡数 |
| `cards_stopped_month` | `int` | 当月停卡数 |
| `revolving_balance` | `bigint` | 循环信用余额（千元 NTD） |
| `installment_balance` | `bigint` | 未到期分期付款余额 |
| `transaction_volume` | `bigint` | 当月签帐金额 |
| `cash_advance_volume` | `bigint` | 当月预借现金金额 |
| `delinquency_3m_ratio` | `numeric(5,2)` | 逾期3个月以上比率 (%) |
| `delinquency_6m_ratio` | `numeric(5,2)` | 逾期6个月以上比率 (%) |
| `bad_debt_coverage_ratio` | `numeric(5,2)` | 备抵呆帐提足率 (%) |
| `bad_debt_writeoff_month` | `bigint` | 当月转销呆帐金额 |
| `bad_debt_writeoff_ytd` | `bigint` | 当年度累计转销呆帐金额 |
| `source_url` | `text` | 数据来源链接 |
| `fetched_at` | `timestamptz` | 抓取时间 |

### 5.3 `monthly_cash_stats` — 现金卡月报

| 列 | 类型 | 说明 |
|---|---|---|
| `id` | `uuid` PK | |
| `bank_id` | `fk → banks` | |
| `report_month` | `date` | 报表月份 |
| `drawn_cards` | `int` | 已动用额度卡数 |
| `undrawn_cards` | `int` | 未动用额度卡数 |
| `contract_limit` | `bigint` | 放款契约额度总和 |
| `available_limit` | `bigint` | 放款可动用额度总和 |
| `loan_balance` | `bigint` | 放款余额（含催收款） |
| `delinquency_ratio` | `numeric(5,2)` | 逾放比率 (%) |
| `provision_balance` | `bigint` | 已提列备抵呆帐余额 |
| `writeoff_month` | `bigint` | 当月转销呆帐金额 |
| `writeoff_ytd` | `bigint` | 当年度累计转销呆帐金额 |
| `source_url` | `text` | 数据来源链接 |
| `fetched_at` | `timestamptz` | 抓取时间 |

### 5.4 `card_products` — 银行卡片产品

| 列 | 类型 | 说明 |
|---|---|---|
| `id` | `uuid` PK | |
| `bank_id` | `fk → banks` | |
| `name` | `text` | 卡名（如"CUBE 卡"） |
| `network` | `text` | 发卡组织（Visa/MC/JCB/AE/银联） |
| `card_level` | `text` | 等级（白金/钛金/无限/世界...） |
| `is_cobrand` | `bool` | 是否联名卡 |
| `co_brand_partner` | `text` | 联名方（如"好市多"） |
| `key_benefits` | `text` | 核心权益摘要 |
| `annual_fee` | `text` | 年费政策简述 |
| `source_page` | `text` | 来源网页 URL |
| `last_verified` | `date` | 最后核验日期 |

### 5.5 `insights` — 人工/AI 分析洞察

| 列 | 类型 | 说明 |
|---|---|---|
| `id` | `uuid` PK | |
| `bank_id` | `fk → banks` | 可为 NULL（全局洞察） |
| `content` | `text` | 洞察正文 |
| `category` | `text` | 分类（rfp_signal / risk / opportunity / news） |
| `source_url` | `text` | 来源链接 |
| `created_at` | `timestamptz` | 建立时间 |

### 5.6 补充报表（轻量处理，主界面不重点展示）

- `quarterly_digital_acct_stats` — 数位存款帐户季度统计
- `quarterly_npl_stats` — 逾放等财务资料
- `annual_writeoff_stats` — 转销呆帐金额汇总
- `quarterly_stored_value_stats` — 储值卡季度统计

---

## 6. 前端页面结构

**三页面 SPA（Vue Router Hash 模式）：**

| 路由 | 页面 | 说明 |
|------|------|------|
| `#/` | Dashboard | 首页总览：Top 排名卡片 + 银行列表（可排序/筛选） + 情报动态 |
| `#/bank/:id` | 银行详情 | 单家银行：月度指标趋势图（ECharts）、卡片产品列表、历史洞察时间线、数据溯源 tooltip |
| `#/compare` | 银行对比 | 任选 2-4 家银行并排对比核心指标 |

**Dashboard 布局：**
- 顶部：导航栏 + 「雷达扫描」按钮 + 最后更新时间
- 中部：Top 5 排名卡片（流通卡数 TOP / 有效卡率 BOTTOM / 签帐额 TOP）
- 主体：银行列表表格（可排序、可筛选、点行跳转详情页）
- 底部：情报动态流

---

## 7. 数据流

```
金管局网站
  │
  ▼
GitHub Actions (手动触发 / 每月 cron)
  │  Python 脚本:
  │  1. 抓取页面 → 定位 ZIP 下载链接
  │  2. 下载 ZIP → 解压 → openpyxl 解析 Excel/ODS
  │  3. 匹配银行名称 → 结构化为 SQL 行
  │  4. UPSERT 到 Supabase
  │
  ▼
Supabase PostgreSQL
  │
  ▼
GitHub Pages (Vue 3 SPA)
  │  Supabase JS SDK 直连数据库
  │  ECharts 渲染趋势图
  │  每条数据可点击查看 source_url
  │
  ▼
用户浏览器（任何设备）
```

**银行官网卡片分析流程（离线半自动）：**
```
个人电脑
  │  浏览器打开银行官网 → DeepSeek API 分析页面结构
  │  提取：卡名 / Logo / 等级 / 联名方 / 权益
  │  人工核验 → Python 脚本一次性 INSERT 到 Supabase
  │  后续同银行同页面结构无需重新分析
  ▼
Supabase card_products 表
```

---

## 8. GitHub 仓库结构（规划）

```
BankInfo/
├── frontend/
│   ├── index.html              ← SPA 入口
│   ├── app.js                  ← Vue 3 应用 + 路由
│   ├── components/
│   │   ├── dashboard.js        ← 首页总览
│   │   ├── bank-detail.js      ← 银行详情页
│   │   └── bank-compare.js     ← 银行对比页
│   ├── utils/
│   │   └── supabase.js         ← Supabase 客户端初始化
│   └── styles/
│       └── main.css            ← 全局样式
├── scripts/
│   ├── fetch_credit_cards.py   ← 信用卡月报解析
│   ├── fetch_cash_cards.py     ← 现金卡月报解析
│   ├── fetch_digital_acct.py   ← 数位存款统计解析
│   └── analyze_bank_cards.py   ← DeepSeek 辅助卡片分析
├── .github/workflows/
│   └── monthly_sync.yml        ← Actions 月度同步
└── README.md
```

---

## 9. 已知限制与后续扩展

| 限制 | 说明 | 应对 |
|------|------|------|
| Logo 发卡量无法精确拆分 | FSC 不公布按网络维度的数据 | 仅做定性分析（产品数量×Logo 类型） |
| 银行官网爬虫维护成本高 | 32 家网站结构各异 | 离线 AI 分析 + 人工核验，非自动化 |
| GitHub Actions 免费额度 | 2000 分钟/月 | 月度触发绰绰有余 |

---

## 10. 开发优先级

1. **Phase 1** — Supabase 建表 + 银行基础数据初始化 + GitHub Actions 信用卡月报解析
2. **Phase 2** — 前端 Dashboard + 银行详情页 + ECharts 趋势图
3. **Phase 3** — 现金卡/数位存款等补充数据源 + 银行对比页
4. **Phase 4** — 银行官网卡片产品分析（DeekSeek 辅助）+ 洞察模块
