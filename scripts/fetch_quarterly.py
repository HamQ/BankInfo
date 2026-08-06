# -*- coding: utf-8 -*-
"""
季度补充数据同步 — 数位存款 + 逾放资料
根据实际 Excel 结构解析
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
    """提取所有 ZIP URL，匹配 YYYQN 季度格式"""
    pattern = r'(https?://[^"\s]*?\.zip)'
    urls = re.findall(pattern, html)
    results = []
    for u in urls:
        m = re.search(r'(\d{2,3})Q(\d)', u)
        if m:
            y, q = int(m.group(1)), int(m.group(2))
            if y < min_year or q < 1 or q > 4:
                continue
            month = (q - 1) * 3 + 1
            results.append((date(y + 1911, month, 1), u))
    return sorted(results, reverse=True)

def find_zips_npl(html, min_year=MIN_ROC_YEAR):
    """NPL 页面: URL 含 /附件三/ 且文件名含年份"""
    pattern = r'(https?://[^"\s]*?附件三[^"\s]*?\.zip)'
    urls = re.findall(pattern, html)
    results = []
    for u in urls:
        # 尝试从 URL 提取年份季度: 114Q4 或 114 年 Q4
        m = re.search(r'(\d{2,3})Q(\d)', u)
        if not m:
            m = re.search(r'/(\d{2,3})(\d{2})[._]', u)  # 如 /11401_
        if m:
            y, q = int(m.group(1)), int(m.group(2))
            if q > 4:  # 可能是月份 01-12
                q = (q - 1) // 3 + 1
            if y < min_year or q < 1 or q > 4:
                continue
            month = (q - 1) * 3 + 1
            results.append((date(y + 1911, month, 1), u))
    return sorted(results, reverse=True)

def download_zip(url):
    safe = re.sub(r"[^\x00-\x7F]+", lambda m: quote(m.group(0), encoding="utf-8"), url)
    req = Request(safe, headers={"User-Agent": USER_AGENT})
    with urlopen(req, context=ssl_ctx(), timeout=60) as r:
        return r.read()

def parse_digital_acct(zip_bytes, fallback_url):
    """解析数位存款 Excel — 实际格式:
    标题行: 數位存款帳戶開戶數統計
    日期行: 中華民國105年12月
    表头: (空白) | 第一類帳戶 | 第二類帳戶 | 第三類帳戶 | 合計
    数据行: 004 臺銀 | 201 | 197 | 0 | 398
    """
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        # ZIP 内文件名可能是乱码 (Big5)，按扩展名找
        xlsx_files = [n for n in zf.namelist() if n.endswith(".xlsx")]
        if not xlsx_files:
            return None, [], "ZIP 内无 xlsx 文件: " + ", ".join(zf.namelist()[:5])
        with zf.open(xlsx_files[0]) as f:
            wb = openpyxl.load_workbook(f, data_only=True)

    ws = wb[wb.sheetnames[0]]
    
    # 找日期: "中華民國105年12月"
    rq = None
    for row in ws.iter_rows(min_row=1, max_row=5, max_col=5, values_only=True):
        for c in row:
            if c and isinstance(c, str):
                m = re.search(r'(\d{2,3})\s*年\s*(\d{1,2})\s*月', str(c))
                if m:
                    y, mo = int(m.group(1)), int(m.group(2))
                    rq = date(y + 1911, mo, 1)
                    break
        if rq:
            break
    if not rq:
        return None, [], "未找到报告月份"

    rows = []
    for row in ws.iter_rows(min_row=6, max_row=ws.max_row, max_col=5, values_only=True):
        col0 = row[0]
        if not col0 or not isinstance(col0, str):
            continue
        col0 = col0.strip()
        
        # 跳过汇总行
        if "總計" in col0 or "合计" in col0:
            continue
        
        # 提取银行代码: "004 臺銀" → code=004
        m = re.match(r'^(\d{3})\s', col0)
        if not m:
            continue
        code = m.group(1)
        
        def ti(v):
            if v is None: return None
            try: return int(float(str(v).replace(",", "")))
            except: return None
        
        rows.append({
            "code": code,
            "type1_accounts": ti(row[1]),
            "type2_accounts": ti(row[2]),
            "type3_accounts": ti(row[3]),
            "total_accounts": ti(row[4]),
        })
    
    return rq, rows, None

def parse_npl(zip_bytes, fallback_url):
    """解析逾放资料 Excel"""
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        xlsx_files = [n for n in zf.namelist() if n.endswith(".xlsx")]
        if not xlsx_files:
            return None, [], "ZIP 内无 xlsx"
        with zf.open(xlsx_files[0]) as f:
            wb = openpyxl.load_workbook(f, data_only=True)

    ws = wb[wb.sheetnames[0]]
    
    # 找日期
    rq = None
    for row in ws.iter_rows(min_row=1, max_row=5, max_col=10, values_only=True):
        for c in row:
            if c and isinstance(c, str):
                m = re.search(r'(\d{2,3})\s*年\s*(\d{1,2})\s*月', str(c))
                if m:
                    y, mo = int(m.group(1)), int(m.group(2))
                    rq = date(y + 1911, mo, 1)
                    break
        if rq:
            break
    if not rq:
        return None, [], "未找到报告月份"

    rows = []
    for row in ws.iter_rows(min_row=5, max_row=ws.max_row, max_col=5, values_only=True):
        col0 = row[0]
        if not col0 or not isinstance(col0, str):
            continue
        col0 = col0.strip()
        if "總計" in col0 or "合计" in col0:
            continue
        
        # 提取银行代码
        m = re.match(r'^(\d{3})\s', col0)
        if not m:
            continue
        code = m.group(1)
        
        def tn(v):
            if v is None: return None
            try: return round(float(str(v).replace(",", "")), 2)
            except: return None
        
        # NPL Excel 结构: 银行 | 银行类型? | 逾放比率 | 覆盖率 | ...
        rows.append({
            "code": code,
            "bank_type": str(row[1]) if row[1] else None,
            "npl_ratio": tn(row[2]),
            "coverage_ratio": tn(row[3]),
        })
    
    return rq, rows, None

def run_source(supabase, cfg, code_to_id):
    table = cfg["table"]
    desc = cfg["desc"]

    existing = {r["report_quarter"] for r in supabase.table(table).select("report_quarter").execute().data}
    print(f"\n{'='*50}")
    print(f"{desc} — 现有 {len(existing)} 个季度")

    html = fetch(cfg["url"])
    
    # 选 Zip 查找函数
    if "npl" in table:
        months = find_zips_npl(html)
    else:
        months = find_zips(html)
    print(f"发现 {len(months)} 个季度")

    new_count = 0
    for rq, zurl in months:
        ms = rq.isoformat()
        if ms in existing:
            continue
        roc_y = rq.year - 1911
        roc_m = rq.month
        print(f"  新季度: 民国{roc_y}年{roc_m}月")
        try:
            zb = download_zip(zurl)
            if "digital" in table:
                pq, data_rows, err = parse_digital_acct(zb, zurl)
            else:
                pq, data_rows, err = parse_npl(zb, zurl)
            
            if pq is None:
                print(f"    跳过: {err}")
                continue

            for r in data_rows:
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

            print(f"    入库 {len(data_rows)} 笔")
            existing.add(ms)
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
    print(f"已加载 {len(code_to_id)} 家银行映射")

    for name, cfg in SOURCES.items():
        try:
            run_source(supabase, cfg, code_to_id)
        except Exception as e:
            print(f"{cfg['desc']} 整体失败: {e}")

if __name__ == "__main__":
    main()
