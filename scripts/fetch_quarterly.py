# -*- coding: utf-8 -*-
"""
季度补充数据同步 — 数位存款 + 逾放资料 + 储值卡
"""
import os, sys, re, io, zipfile, ssl
from datetime import date
from urllib.request import Request, urlopen
from urllib.parse import quote

import openpyxl
from supabase import create_client

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

SOURCES = {
    "digital_acct": {
        "url": "https://www.banking.gov.tw/ch/home.jsp?id=591&parentpath=0,590&mcustomize=multimessage_view.jsp&dataserno=201911270001&dtable=Disclosure",
        "table": "quarterly_digital_acct_stats",
        "desc": "数位存款帐户",
    },
    "npl": {
        "url": "https://www.banking.gov.tw/ch/home.jsp?id=591&parentpath=0,590&mcustomize=multimessage_view.jsp&dataserno=201202130001&dtable=Disclosure",
        "table": "quarterly_npl_stats",
        "desc": "逾放资料",
    },
}

USER_AGENT = "Mozilla/5.0 (compatible; BankInfoBot/1.0)"
MIN_ROC_YEAR = 113

BANK_CODE_MAP = {
    "004": "臺灣銀行", "005": "臺灣土地銀行", "006": "合作金庫商業銀行",
    "007": "第一商業銀行", "008": "華南商業銀行", "009": "彰化商業銀行",
    "011": "上海商業儲蓄銀行", "012": "台北富邦商業銀行", "013": "國泰世華商業銀行",
    "016": "高雄銀行", "017": "兆豐國際商業銀行", "021": "花旗(台灣)商業銀行",
    "050": "臺灣中小企業銀行", "052": "渣打國際商業銀行", "053": "台中商業銀行",
    "081": "滙豐(台灣)商業銀行", "101": "華泰商業銀行", "102": "臺灣新光商業銀行",
    "103": "陽信商業銀行", "108": "三信商業銀行", "803": "聯邦商業銀行",
    "805": "遠東國際商業銀行", "806": "元大商業銀行", "807": "永豐商業銀行",
    "808": "玉山商業銀行", "809": "凱基商業銀行", "810": "星展(台灣)商業銀行",
    "812": "台新國際商業銀行", "815": "安泰商業銀行", "822": "中國信託商業銀行",
}
BANK_NAME_MAP = {v: k for k, v in BANK_CODE_MAP.items()}

def ssl_ctx():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx

def fetch(url):
    req = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(req, context=ssl_ctx(), timeout=30) as r:
        return r.read().decode("utf-8")

def find_zips(html, min_year=MIN_ROC_YEAR):
    """从页面提取 ZIP URL，返回 [(report_date, url), ...]"""
    # 匹配季度: Q1-Q4 或直接年份
    pattern = r'(https?://[^"\s]*?\.zip)'
    urls = re.findall(pattern, html)
    results = []
    for u in urls:
        # 尝试提取年份季度
        m = re.search(r'(\d{2,3})Q(\d)', u)
        if m:
            y, q = int(m.group(1)), int(m.group(2))
            if y < min_year:
                continue
            if q < 1 or q > 4:
                continue
            month = (q - 1) * 3 + 1
            results.append((date(y + 1911, month, 1), u))
    return sorted(results, reverse=True)

def download_zip(url):
    safe = re.sub(r"[^\x00-\x7F]+", lambda m: quote(m.group(0), encoding="utf-8"), url)
    req = Request(safe, headers={"User-Agent": USER_AGENT})
    with urlopen(req, context=ssl_ctx(), timeout=60) as r:
        return r.read()

def parse_digital_acct(zip_bytes):
    """解析数位存款 Excel"""
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        xlsx = [n for n in zf.namelist() if n.endswith(".xlsx")]
        if not xlsx:
            return None, []
        with zf.open(xlsx[0]) as f:
            wb = openpyxl.load_workbook(f, data_only=True)
    ws = wb[wb.sheetnames[0]]

    # 找报告季度
    rq = None
    for row in ws.iter_rows(min_row=1, max_row=5, max_col=10, values_only=True):
        for c in row:
            if c and isinstance(c, str):
                m = re.search(r'(\d{2,3})\s*年\s*Q(\d)', str(c)) or re.search(r'(\d{2,3})\s*年\s*第?\s*(\d)\s*季', str(c)) or re.search(r'(\d{2,3})Q(\d)', str(c))
                if m:
                    y, q = int(m.group(1)), int(m.group(2))
                    rq = date(y + 1911, (q - 1) * 3 + 1, 1)
                    break
        if rq:
            break
    if not rq:
        return None, []

    rows = []
    for row in ws.iter_rows(min_row=4, max_row=ws.max_row, max_col=6, values_only=True):
        bn = row[0]
        if not bn or not isinstance(bn, str):
            continue
        bn = re.sub(r"[\s\u3000]+", "", str(bn).strip())
        # 匹配银行名
        code = None
        for name, c in BANK_NAME_MAP.items():
            if name in bn or bn in name:
                code = c
                break
        if not code:
            continue

        def ti(v):
            try: return None if v is None else int(float(v))
            except: return None

        rows.append({
            "code": code,
            "type1_accounts": ti(row[1]),  # 第一类
            "type2_accounts": ti(row[2]),  # 第二类
            "type3_accounts": ti(row[3]),  # 第三类
            "total_accounts": ti(row[4]),  # 合计
        })
    return rq, rows

def parse_npl(zip_bytes):
    """解析逾放资料 Excel"""
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        xlsx = [n for n in zf.namelist() if n.endswith(".xlsx")]
        if not xlsx:
            return None, []
        with zf.open(xlsx[0]) as f:
            wb = openpyxl.load_workbook(f, data_only=True)
    ws = wb[wb.sheetnames[0]]

    rq = None
    for row in ws.iter_rows(min_row=1, max_row=5, max_col=10, values_only=True):
        for c in row:
            if c and isinstance(c, str):
                m = re.search(r'(\d{2,3})\s*年\s*Q(\d)', str(c)) or re.search(r'(\d{2,3})\s*年\s*第?\s*(\d)\s*季', str(c)) or re.search(r'(\d{2,3})Q(\d)', str(c))
                if m:
                    y, q = int(m.group(1)), int(m.group(2))
                    rq = date(y + 1911, (q - 1) * 3 + 1, 1)
                    break
        if rq:
            break
    if not rq:
        return None, []

    rows = []
    for row in ws.iter_rows(min_row=4, max_row=ws.max_row, max_col=5, values_only=True):
        bn = row[0]
        if not bn or not isinstance(bn, str):
            continue
        bn = re.sub(r"[\s\u3000]+", "", str(bn).strip())
        code = None
        for name, c in BANK_NAME_MAP.items():
            if name in bn or bn in name:
                code = c
                break
        if not code:
            continue

        def tn(v):
            try: return None if v is None else round(float(v), 2)
            except: return None

        rows.append({
            "code": code,
            "bank_type": str(row[1]) if row[1] else None,
            "npl_ratio": tn(row[2]),
            "coverage_ratio": tn(row[3]),
        })
    return rq, rows

def run_source(supabase, cfg, code_to_id):
    table = cfg["table"]
    desc = cfg["desc"]

    existing = {r["report_quarter"] for r in supabase.table(table).select("report_quarter").execute().data}
    print(f"\n{'='*50}")
    print(f"{desc} — 现有 {len(existing)} 个季度")

    html = fetch(cfg["url"])
    months = find_zips(html)
    print(f"发现 {len(months)} 个季度")

    new_count = 0
    for rq, zurl in months:
        if rq.isoformat() in existing:
            continue
        print(f"  新季度: 民国{rq.year-1911}年Q{(rq.month-1)//3+1}")
        try:
            zb = download_zip(zurl)
            if "digital" in table:
                pq, rows = parse_digital_acct(zb)
            else:
                pq, rows = parse_npl(zb)

            if pq is None:
                print("    无法解析")
                continue

            for r in rows:
                bid = code_to_id.get(r["code"])
                if not bid:
                    continue
                record = {
                    "bank_id": bid,
                    "report_quarter": pq.isoformat(),
                    "source_url": zurl.replace(".zip", ".pdf"),
                }
                if "digital" in table:
                    record.update({
                        "type1_accounts": r.get("type1_accounts"),
                        "type2_accounts": r.get("type2_accounts"),
                        "type3_accounts": r.get("type3_accounts"),
                        "total_accounts": r.get("total_accounts"),
                    })
                else:
                    record.update({
                        "bank_type": r.get("bank_type"),
                        "npl_ratio": r.get("npl_ratio"),
                        "coverage_ratio": r.get("coverage_ratio"),
                    })
                supabase.table(table).upsert(record, on_conflict="bank_id,report_quarter").execute()
                new_count += 1

            print(f"    入库 {len(rows)} 笔")
            existing.add(rq.isoformat())
        except Exception as e:
            print(f"    失败: {e}")

    print(f"{desc} 完成，新增 {new_count} 笔")

def main():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("请设置 SUPABASE_URL 和 SUPABASE_SERVICE_KEY")
        sys.exit(1)
    supabase = create_client(url, key)

    resp = supabase.table("banks").select("id,code").execute()
    code_to_id = {b["code"]: b["id"] for b in resp.data}

    for name, cfg in SOURCES.items():
        try:
            run_source(supabase, cfg, code_to_id)
        except Exception as e:
            print(f"{cfg['desc']} 整体失败: {e}")

if __name__ == "__main__":
    main()
