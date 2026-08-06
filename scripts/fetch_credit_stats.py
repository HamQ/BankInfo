# -*- coding: utf-8 -*-
"""
信用卡重要业务及财务资讯揭露 — 解析与入库 (v2)
- 抓取页面上全部月份 ZIP
- 只更新数据库中缺失的月份
- 只处理 113 年（2024）之后的数据
- 同时显示 民国/公元 年份
"""
import os, sys, re, io, zipfile, ssl
from datetime import date
from urllib.request import Request, urlopen
from urllib.parse import quote

import openpyxl
from supabase import create_client, Client

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

FSC_PAGE_URL = "https://www.banking.gov.tw/ch/home.jsp?id=591&parentpath=0,590&mcustomize=multimessage_view.jsp&dataserno=21207&dtable=Disclosure"
USER_AGENT = "Mozilla/5.0 (compatible; BankInfoBot/1.0)"
MIN_ROC_YEAR = 113  # 公元 2024 年起

BANK_NAME_MAP = {
    "臺灣銀行": "004", "臺灣土地銀行": "005", "合作金庫商業銀行": "006",
    "第一商業銀行": "007", "華南商業銀行": "008", "彰化商業銀行": "009",
    "上海商業儲蓄銀行": "011", "台北富邦商業銀行": "012", "國泰世華商業銀行": "013",
    "高雄銀行": "016", "兆豐國際商業銀行": "017", "花旗(台灣)商業銀行": "021",
    "臺灣中小企業銀行": "050", "渣打國際商業銀行": "052", "台中商業銀行": "053",
    "滙豐(台灣)商業銀行": "081", "華泰商業銀行": "101", "臺灣新光商業銀行": "102",
    "陽信商業銀行": "103", "三信商業銀行": "108", "聯邦商業銀行": "803",
    "遠東國際商業銀行": "805", "元大商業銀行": "806", "永豐商業銀行": "807",
    "玉山商業銀行": "808", "凱基商業銀行": "809", "星展(台灣)商業銀行": "810",
    "台新國際商業銀行": "812", "安泰商業銀行": "815", "中國信託商業銀行": "822",
    "台灣樂天信用卡股份有限公司": "RC001", "台灣美國運通國際(股)公司": "AE001",
}

def _ssl_context():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx

def fetch_page(url: str) -> str:
    req = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(req, context=_ssl_context(), timeout=30) as resp:
        return resp.read().decode("utf-8")

def roc_label(y, m):
    """民国/公元标签: 115年5月 (2026-05)"""
    return f"民国{y}年{m}月 (公元{y+1911}-{m:02d})"

def find_all_zip_urls(html: str) -> list:
    """找到所有信用卡 ZIP 链接，去重并排序（新 -> 旧），只保留 MIN_ROC_YEAR 之后"""
    pattern = r'(https?://[^"\s]*?/(\d{3})(\d{2})_[^"\s]*?\.zip)'
    matches = re.findall(pattern, html)

    month_map = {}
    for full_url, roc_year, roc_month in matches:
        y, m = int(roc_year), int(roc_month)
        if y < MIN_ROC_YEAR:
            continue
        month_map[(y, m)] = full_url

    result = []
    for (y, m), url in sorted(month_map.items(), reverse=True):
        result.append((date(y + 1911, m, 1), url))
    return result

def get_existing_months(supabase: Client) -> set:
    resp = supabase.table("monthly_credit_stats").select("report_month").execute()
    return {r["report_month"] for r in resp.data}

def download_zip(zip_url: str) -> bytes:
    safe_url = re.sub(r"[^\x00-\x7F]+", lambda m: quote(m.group(0), encoding="utf-8"), zip_url)
    req = Request(safe_url, headers={"User-Agent": USER_AGENT})
    with urlopen(req, context=_ssl_context(), timeout=60) as resp:
        return resp.read()

def parse_excel(zip_bytes: bytes) -> tuple:
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        xlsx_files = [n for n in zf.namelist() if n.endswith(".xlsx")]
        if not xlsx_files:
            return None, []
        with zf.open(xlsx_files[0]) as f:
            wb = openpyxl.load_workbook(f, data_only=True)

    ws = wb[wb.sheetnames[0]]
    report_month = None
    for row in ws.iter_rows(min_row=1, max_row=5, max_col=14, values_only=True):
        for cell in row:
            if cell and isinstance(cell, str):
                m = re.search(r"(\d{2,3})\s*年\s*(\d{1,2})\s*月", str(cell))
                if m:
                    report_month = date(int(m.group(1)) + 1911, int(m.group(2)), 1)
                    break
        if report_month:
            break
    if not report_month:
        return None, []

    rows = []
    for row in ws.iter_rows(min_row=5, max_row=ws.max_row, max_col=14, values_only=True):
        bn = row[0]
        if not bn or not isinstance(bn, str):
            continue
        bn_clean = re.sub(r"[\s\u3000]+", "", str(bn).strip())
        if bn_clean not in BANK_NAME_MAP:
            continue

        def to_int(v):
            try:
                if v is None: return None
                return int(float(v))
            except: return None

        def to_num(v):
            try:
                if v is None: return None
                return round(float(v), 2)
            except: return None

        rows.append({
            "code": BANK_NAME_MAP[bn_clean],
            "cards_in_circulation": to_int(row[1]), "active_cards": to_int(row[2]),
            "cards_issued_month": to_int(row[3]), "cards_stopped_month": to_int(row[4]),
            "revolving_balance": to_int(row[5]), "installment_balance": to_int(row[6]),
            "transaction_volume": to_int(row[7]), "cash_advance_volume": to_int(row[8]),
            "delinquency_3m_ratio": to_num(row[9]), "delinquency_6m_ratio": to_num(row[10]),
            "bad_debt_coverage_ratio": to_num(row[11]),
            "bad_debt_writeoff_month": to_int(row[12]), "bad_debt_writeoff_ytd": to_int(row[13]),
        })
    return report_month, rows

def upsert_month(supabase: Client, report_month: date, rows: list, source_url: str, code_to_id: dict):
    count = 0
    for row in rows:
        bank_id = code_to_id.get(row["code"])
        if not bank_id: continue
        supabase.table("monthly_credit_stats").upsert({
            "bank_id": bank_id, "report_month": report_month.isoformat(),
            "cards_in_circulation": row["cards_in_circulation"],
            "active_cards": row["active_cards"],
            "cards_issued_month": row["cards_issued_month"],
            "cards_stopped_month": row["cards_stopped_month"],
            "revolving_balance": row["revolving_balance"],
            "installment_balance": row["installment_balance"],
            "transaction_volume": row["transaction_volume"],
            "cash_advance_volume": row["cash_advance_volume"],
            "delinquency_3m_ratio": row["delinquency_3m_ratio"],
            "delinquency_6m_ratio": row["delinquency_6m_ratio"],
            "bad_debt_coverage_ratio": row["bad_debt_coverage_ratio"],
            "bad_debt_writeoff_month": row["bad_debt_writeoff_month"],
            "bad_debt_writeoff_ytd": row["bad_debt_writeoff_ytd"],
            "source_url": source_url,
        }, on_conflict="bank_id,report_month").execute()
        count += 1
    return count

def main():
    print("台湾信用卡情报雷达 - 信用卡月报同步 v2")
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("请设置 SUPABASE_URL 和 SUPABASE_SERVICE_KEY")
        sys.exit(1)
    supabase = create_client(url, key)

    existing = get_existing_months(supabase)
    print(f"数据库已有 {len(existing)} 个月份")

    print("抓取金管局页面...")
    html = fetch_page(FSC_PAGE_URL)
    all_months = find_all_zip_urls(html)
    print(f"页面中 {len(all_months)} 个可用月份 (自 {MIN_ROC_YEAR} 年起)")

    resp = supabase.table("banks").select("id,code").execute()
    code_to_id = {b["code"]: b["id"] for b in resp.data}

    new_count = 0
    for report_month, zip_url in all_months:
        month_str = report_month.isoformat()
        if month_str in existing:
            continue
        roc_y = report_month.year - 1911
        roc_m = report_month.month
        print(f"\n新月份: {roc_label(roc_y, roc_m)}")
        try:
            zip_bytes = download_zip(zip_url)
            parsed_month, rows = parse_excel(zip_bytes)
            if parsed_month is None:
                print("  无法解析，跳过")
                continue
            n = upsert_month(supabase, parsed_month, rows, zip_url, code_to_id)
            print(f"  入库 {n} 笔 ({len(rows)} 家银行)")
            new_count += n
            existing.add(month_str)
        except Exception as e:
            print(f"  失败: {e}")
            continue

    if new_count == 0:
        print("\n所有月份均为最新")
    else:
        print(f"\n完成! 新增 {new_count} 笔记录")

if __name__ == "__main__":
    main()
