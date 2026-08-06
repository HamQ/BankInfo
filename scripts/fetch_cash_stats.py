# -*- coding: utf-8 -*-
"""
现金卡重要业务及财务资讯揭露 — 解析与入库
数据源: https://www.banking.gov.tw/ch/home.jsp?id=591&...&dataserno=21206
运行: python fetch_cash_stats.py
需要环境变量: SUPABASE_URL, SUPABASE_SERVICE_KEY
"""

import os, sys, re, io, zipfile, ssl
from datetime import date
from urllib.request import Request, urlopen

import openpyxl
from supabase import create_client, Client

FSC_PAGE_URL = "https://www.banking.gov.tw/ch/home.jsp?id=591&parentpath=0,590&mcustomize=multimessage_view.jsp&dataserno=21206&dtable=Disclosure"
USER_AGENT = "Mozilla/5.0 (compatible; BankInfoBot/1.0)"

BANK_NAME_MAP = {
    "第一商業銀行": "007", "華南商業銀行": "008", "台中商業銀行": "053",
    "臺灣銀行": "004", "臺灣土地銀行": "005", "合作金庫商業銀行": "006",
    "彰化商業銀行": "009", "上海商業儲蓄銀行": "011", "台北富邦商業銀行": "012",
    "國泰世華商業銀行": "013", "高雄銀行": "016", "兆豐國際商業銀行": "017",
    "花旗(台灣)商業銀行": "021", "臺灣中小企業銀行": "050", "渣打國際商業銀行": "052",
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

def find_zip_url(html: str) -> str:
    match = re.search(r'https?://[^"\s]+\.zip', html)
    if not match:
        raise RuntimeError("页面中未找到 ZIP 下载链接")
    return match.group(0)

def download_zip(zip_url: str) -> bytes:
    req = Request(zip_url, headers={"User-Agent": USER_AGENT})
    with urlopen(req, context=_ssl_context(), timeout=60) as resp:
        return resp.read()

def parse_excel(zip_bytes: bytes) -> tuple:
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        xlsx_files = [n for n in zf.namelist() if n.endswith('.xlsx')]
        if not xlsx_files:
            raise RuntimeError("ZIP 中未找到 .xlsx 文件")
        with zf.open(xlsx_files[0]) as f:
            wb = openpyxl.load_workbook(f, data_only=True)

    ws = wb[wb.sheetnames[0]]

    report_month = None
    for row in ws.iter_rows(min_row=1, max_row=5, max_col=10, values_only=True):
        for cell in row:
            if cell and isinstance(cell, str):
                m = re.search(r'(\d{2,3})\s*年\s*(\d{1,2})\s*月', str(cell))
                if m:
                    year = int(m.group(1)) + 1911
                    month = int(m.group(2))
                    report_month = date(year, month, 1)
                    break
        if report_month:
            break

    if not report_month:
        raise RuntimeError("无法从 Excel 中解析报表月份")

    rows = []
    for row in ws.iter_rows(min_row=5, max_row=ws.max_row, max_col=10, values_only=True):
        bank_name_raw = row[0]
        if not bank_name_raw or not isinstance(bank_name_raw, str):
            continue
        bank_name = re.sub(r'[\s\u3000]+', '', str(bank_name_raw).strip())

        if bank_name not in BANK_NAME_MAP:
            print(f"  ⚠ 未知银行: {bank_name_raw}")
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
            "code": BANK_NAME_MAP[bank_name],
            "drawn_cards":       to_int(row[1]),
            "undrawn_cards":     to_int(row[2]),
            "contract_limit":    to_int(row[3]),
            "available_limit":   to_int(row[4]),
            "loan_balance":      to_int(row[5]),
            "delinquency_ratio": to_num(row[6]),
            "provision_balance": to_int(row[7]),
            "writeoff_month":    to_int(row[8]),
            "writeoff_ytd":      to_int(row[9]),
        })

    return report_month, rows

def upsert_to_supabase(supabase: Client, report_month: date, rows: list, source_url: str):
    resp = supabase.table("banks").select("id,code").execute()
    code_to_id = {b["code"]: b["id"] for b in resp.data}

    for row in rows:
        bank_id = code_to_id.get(row["code"])
        if not bank_id: continue

        supabase.table("monthly_cash_stats").upsert({
            "bank_id":           bank_id,
            "report_month":      report_month.isoformat(),
            "drawn_cards":       row["drawn_cards"],
            "undrawn_cards":     row["undrawn_cards"],
            "contract_limit":    row["contract_limit"],
            "available_limit":   row["available_limit"],
            "loan_balance":      row["loan_balance"],
            "delinquency_ratio": row["delinquency_ratio"],
            "provision_balance": row["provision_balance"],
            "writeoff_month":    row["writeoff_month"],
            "writeoff_ytd":      row["writeoff_ytd"],
            "source_url":        source_url,
        }, on_conflict="bank_id,report_month").execute()

    print(f"  ✅ 现金卡数据已入库 ({len(rows)} 笔)")

def main():
    print("🔍 现金卡月报同步")
    html = fetch_page(FSC_PAGE_URL)
    zip_url = find_zip_url(html)
    print(f"  ZIP: {zip_url}")
    zip_bytes = download_zip(zip_url)
    report_month, rows = parse_excel(zip_bytes)
    print(f"  月份: {report_month}, 银行数: {len(rows)}")

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("❌ 请设置 SUPABASE_URL 和 SUPABASE_SERVICE_KEY")
        sys.exit(1)
    supabase = create_client(url, key)
    upsert_to_supabase(supabase, report_month, rows, zip_url)
    print("🎉 现金卡同步完成！")

if __name__ == "__main__":
    main()
