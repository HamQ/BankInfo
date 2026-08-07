# -*- coding: utf-8 -*-
"""Phase 4A - Credit Card Crawler with Playwright + DeepSeek"""
import os, sys, re, io, json
from datetime import date
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup
from supabase import create_client
import urllib3
urllib3.disable_warnings()

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

DEEPSEEK_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"

BANK_CC = {
    # Phase 4A - original 5
    "011": "https://apply.scsb.com.tw/creditcard/client/#/cc/card-main",
    "102": "https://www.skbank.com.tw/CC-Creditcard",
    "808": "https://www.esunbank.com/zh-tw/personal/credit-card/intro",
    "810": "https://www.dbs.com.tw/treasures-ideas/credit-cards/default.page",
    "013": "https://www.cathaybk.com.tw/cathaybk/personal/credit-card/cards/",
    # Phase 4A batch 1
    "005": "https://www.landbank.com.tw/personal/credit-card/",
    "012": "https://www.fubon.com/banking/personal/credit_card/index.html",
    "017": "https://www.megabank.com.tw/personal/credit-card/",
    "048": "https://www.o-bank.com/web/creditcard/",
    "052": "https://www.sc.com/tw/credit-cards/",
    "054": "https://www.ktb.com.tw/personal/credit-card/",
    "081": "https://www.hsbc.com.tw/credit-cards/",
    "108": "https://www.cotabank.com.tw/creditcard/",
    "118": "https://www.bop.com.tw/creditcard/",
    "806": "https://www.yuantabank.com.tw/bank/creditCard/creditCard/list.do",
    "807": "https://bank.sinopac.com/sinopacBT/personal/credit-card/introduction/bankcard/list.html",
    "809": "https://www.kgibank.com.tw/credit/",
    "815": "https://www.entiebank.com.tw/personal/credit-card/",
    "822": "https://www.ctbcbank.com/content/tw/personal/credit-card/index.html",
    "RC001": "https://card.rakuten.com.tw/",
    # Phase 4A batch 2 - discovered via homepage navigation
    "007": "https://card.firstbank.com.tw/",
    "008": "https://www.hncb.com.tw/wps/portal/HNCB/card",
    "009": "https://www.chb.com.tw/subarea.jsp?funcId=f1f12f6d15",
    "050": "https://www.tbb.com.tw/zh-tw/personal/cards/products/overview",
    "803": "https://card.ubot.com.tw/eCard/",
    "805": "https://www.feib.com.tw/introduce/cardInfo?type=1",
    "812": "https://www.taishinbank.com.tw/TSB/personal/credit/intro/overview/",
}

SYS_PROMPT = """You are a credit card product analyst. Extract ALL credit cards from webpage text.
Return ONLY a JSON array, each element:
{"name":"card Chinese name","network":"Visa|Mastercard|JCB|AmericanExpress|UnionPay|null",
"card_level":"Platinum|World|Infinite|Signature|Titanium|Classic|Gold|Standard|null",
"is_cobrand":true|false,"co_brand_partner":"name or null",
"key_benefits":"brief benefits","annual_fee":"fee or null"}
Return only JSON array, no markdown. [] if no cards."""

def fetch_page_pw(url, timeout=30):
    """用 Playwright 渲染 JS 页面并返回 HTML"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            page.goto(url, wait_until="networkidle", timeout=timeout*1000)
            page.wait_for_timeout(3000)
            html = page.content()
            browser.close()
            return html
        except Exception as e:
            browser.close()
            print(f"    Playwright error: {e}")
            return None

def extract_text(html):
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "noscript"]):
        tag.decompose()
    lines = []
    for el in soup.find_all(string=True):
        t = el.strip()
        if t and len(t) > 2:
            if not lines or t != lines[-1]:
                lines.append(t)
    full = "\n".join(lines)
    if len(full) > 15000:
        full = full[:15000]
    return full

def call_deepseek(text):
    import requests
    headers = {"Authorization": "Bearer " + DEEPSEEK_KEY, "Content-Type": "application/json"}
    body = {"model": "deepseek-chat", "messages": [
        {"role": "system", "content": SYS_PROMPT},
        {"role": "user", "content": text}
    ], "temperature": 0.1, "max_tokens": 8192}
    try:
        resp = requests.post(DEEPSEEK_URL, headers=headers, json=body, timeout=120)
        data = resp.json()
        return data["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"    DeepSeek error: {e}")
        return None

def parse_json(text):
    """Robust JSON extraction from DeepSeek response."""
    if not text: return []
    text = text.strip()
    # Remove markdown code blocks
    text = re.sub(r'```(?:json)?\s*\n?', '', text, flags=re.IGNORECASE)
    text = re.sub(r'```', '', text)
    text = text.strip()
    # Try direct JSON parse
    try:
        result = json.loads(text)
        if isinstance(result, list): return result
        if isinstance(result, dict): return [result]
    except: pass
    # Try extracting array
    m = re.search(r'\[\s\S]*\]', text)
    if m:
        try: return json.loads(m.group(0))
        except: pass
    # Try extracting object(s)
    objs = re.findall(r'\{[^{}]*\}', text, re.DOTALL)
    if objs and len(objs) > 1:
        try: return [json.loads(o) for o in objs]
        except: pass
    return []

def main():
    import requests as req
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("Set SUPABASE_URL and SUPABASE_SERVICE_KEY")
        sys.exit(1)
    supabase = create_client(url, key)
    codes = sys.argv[1:] if len(sys.argv) > 1 else list(BANK_CC.keys())
    for code in codes:
        b = supabase.table("banks").select("id,name").eq("code", code).execute()
        if not b.data:
            print("\nBank " + code + " not found")
            continue
        bid = b.data[0]["id"]
        bname = b.data[0]["name"]
        print("\n=== " + bname + " (" + code + ") ===")
        
        page_url = BANK_CC.get(code, "")
        if not page_url:
            print("  No URL configured")
            continue
        
        print("  Loading: " + page_url)
        html = fetch_page_pw(page_url)
        if not html:
            print("  Failed to load page")
            continue
        
        text = extract_text(html)
        print("  Extracted: " + str(len(text)) + " chars")
        
        if len(text) < 200:
            print("  Too short, saving raw HTML snippet...")
            # Fallback: extract from raw HTML title/meta
            soup = BeautifulSoup(html, "html.parser")
            title = soup.title.string if soup.title else ""
            meta = soup.find("meta", attrs={"name": "description"})
            desc = meta["content"] if meta else ""
            text = title + "\n" + desc
            print("  Title+desc: " + str(len(text)) + " chars")
        
        if len(text) < 50:
            print("  Still too short, skip")
            continue
        
        result = call_deepseek(text)
        cards = parse_json(result)
        
        if not cards:
            preview = (result or "")[:300]
            print("  No cards. Raw: " + preview)
            continue
        
        print("  Found " + str(len(cards)) + " cards:")
        added = 0
        for c in cards:
            nm = c.get("name","")
            if not nm: continue
            nw = c.get("network","?") or "?"
            print("    " + nm + " [" + nw + "]")
            ex = supabase.table("card_products").select("id").eq("bank_id", bid).eq("name", nm).execute()
            if ex.data:
                print("      (exists)")
                continue
            supabase.table("card_products").insert({
                "bank_id": bid,
                "name": nm,
                "network": c.get("network"),
                "card_level": c.get("card_level"),
                "is_cobrand": c.get("is_cobrand", False),
                "co_brand_partner": c.get("co_brand_partner"),
                "key_benefits": c.get("key_benefits"),
                "annual_fee": c.get("annual_fee"),
                "source_page": page_url,
                "last_verified": date.today().isoformat(),
            }).execute()
            added += 1
        print("  Added " + str(added) + " cards")

if __name__ == "__main__":
    main()
