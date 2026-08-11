# -*- coding: utf-8 -*-
"""Phase 5 - Card Crawler powered by Firecrawl + DeepSeek
Replaces Playwright-based card_crawler.py for banks that need JS rendering.
Firecrawl handles: SPA rendering, bot detection, proxy rotation.
"""
import os, sys, io, json, time, requests
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from supabase import create_client

FIRECRAWL_KEY = os.environ.get("FIRECRAWL_API_KEY", "")
DEEPSEEK_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
FIRECRAWL_URL = "https://api.firecrawl.dev/v1/scrape"
DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"

SYS_PROMPT = """You are a credit card product analyst. Extract ALL credit cards from the markdown text.
Return ONLY a JSON array. Each element must have these fields:
{"name":"card Chinese name","network":"Visa|Mastercard|JCB|AmericanExpress|UnionPay|null",
"card_level":"Platinum|World|Infinite|Signature|Titanium|Classic|Gold|Standard|null",
"is_cobrand":true|false,"co_brand_partner":"name or null",
"key_benefits":"brief benefits summary in Chinese","annual_fee":"fee or null"}
Return only JSON array, no markdown. [] if no cards found."""

# Complete bank URL mapping - curated from manual browsing + firecrawl search
BANK_URLS = {
    # Phase 4A banks already scraped (skip if already have data)
    # "013": "国泰", "017": "兆丰", etc. - already in DB

    # Banks previously blocked by Playwright - NOW WORKING WITH FIRECRAWL
    "004": "https://www.bot.com.tw/personal/credit-card/",
    "005": "https://www.landbank.com.tw/Category/Items/%E8%AA%8D%E5%90%8C%E5%8D%A1%E3%80%81%E8%81%AF%E5%90%8D%E5%8D%A1%E2%80%94JCB%E7%B3%BB%E5%88%97",
    "006": "https://www.tcb-bank.com.tw/creditcard/",
    "007": "https://card.firstbank.com.tw/",
    "008": "https://www.hncb.com.tw/wps/portal/HNCB/card/credit_card",
    "009": "https://www.chb.com.tw/chbwww/WebCM?fid=f1f12f6d15",
    "011": "https://www.scsb.com.tw/personal/credit-card/",
    "012": "https://www.fubon.com/banking/personal/credit_card/credit_card_list.html",
    "016": "https://www.bok.com.tw/personal/credit-card/",
    "021": "https://www.citibank.com.tw/credit-cards/",  # 花旗已退出台湾，可能失效
    "053": "https://www.tcbbank.com.tw/personal/credit-card/",
    "054": "https://www.ktb.com.tw/personal/credit-card/",
    "101": "https://www.htb.com.tw/personal/credit-card/",
    "103": "https://www.taishinbank.com.tw/TSB/personal/credit/intro/overview/",
    "108": "https://www.cotabank.com.tw/creditcard/",
    "118": "https://www.bop.com.tw/creditcard/",
    "806": "https://www.yuantabank.com.tw/bank/creditCard/creditCard/list.do",
    "809": "https://www.kgibank.com.tw/zh-tw/personal/credit-card/list",
    "810": "https://www.dbs.com.tw/treasures-ideas/credit-cards/default.page",
    "815": "https://www.entiebank.com.tw/personal/credit-card/",
    "822": "https://www.ctbcbank.com/tw/personal/credit-card",
    "AE001": "https://www.americanexpress.com/zh-tw/credit-cards/",
    "NB01": "https://www.nextbank.com.tw/personal/credit-card/",
    "NB02": "https://www.linebank.com.tw/personal/credit-card/",
    "NB03": "https://www.rakuten-bank.com.tw/personal/credit-card/",
}

def firecrawl_scrape(url, timeout=90):
    """Scrape a URL using Firecrawl API, return clean markdown."""
    payload = {
        "url": url,
        "formats": ["markdown"],
        "onlyMainContent": False,
        "waitFor": 10000,
    }
    headers = {
        "Authorization": f"Bearer {FIRECRAWL_KEY}",
        "Content-Type": "application/json",
    }
    try:
        resp = requests.post(FIRECRAWL_URL, json=payload, headers=headers, timeout=120)
        data = resp.json()
        if data.get("success"):
            return data.get("data", {}).get("markdown", "")
        else:
            print(f"    Firecrawl failed: {str(data)[:200]}")
            return ""
    except Exception as e:
        print(f"    Firecrawl error: {e}")
        return ""

def deepseek_extract(markdown):
    """Send markdown to DeepSeek to extract card products."""
    headers = {
        "Authorization": f"Bearer {DEEPSEEK_KEY}",
        "Content-Type": "application/json",
    }
    body = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": SYS_PROMPT},
            {"role": "user", "content": markdown[:24000]},
        ],
        "temperature": 0.1,
        "max_tokens": 8192,
    }
    try:
        resp = requests.post(DEEPSEEK_URL, json=body, headers=headers, timeout=120)
        data = resp.json()
        return data["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"    DeepSeek error: {e}")
        return "[]"

def parse_json(raw):
    """Clean and parse DeepSeek JSON output."""
    clean = raw.strip()
    if clean.startswith("```json"):
        clean = clean[7:]
    if clean.startswith("```"):
        clean = clean[3:]
    if clean.endswith("```"):
        clean = clean[:-3]
    clean = clean.strip()
    try:
        return json.loads(clean)
    except:
        return []

def main():
    if not FIRECRAWL_KEY:
        print("ERROR: Set FIRECRAWL_API_KEY env var")
        sys.exit(1)
    if not DEEPSEEK_KEY:
        print("ERROR: Set DEEPSEEK_API_KEY env var")
        sys.exit(1)

    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not supabase_url or not supabase_key:
        print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_KEY")
        sys.exit(1)

    s = create_client(supabase_url, supabase_key)

    # Load banks from DB
    banks_resp = s.table("banks").select("id,code,name").execute()
    banks = {b["code"]: b for b in banks_resp.data}

    # Only process banks NOT in BANK_URLS.keys() if args provided
    target_codes = sys.argv[1:] if len(sys.argv) > 1 else list(BANK_URLS.keys())

    total_inserted = 0
    for code in target_codes:
        bank = banks.get(code)
        if not bank:
            print(f"\n{code}: bank not found in DB, skipping")
            continue

        url = BANK_URLS.get(code)
        if not url:
            print(f"\n{code} ({bank['name']}): no URL mapped, skipping")
            continue

        # Check existing cards
        existing = s.table("card_products").select("count", count="exact").eq("bank_id", bank["id"]).execute()
        if existing.count > 0:
            print(f"\n{code} ({bank['name']}): already has {existing.count} cards, skipping")
            continue

        print(f"\n=== {bank['name']} ({code}) ===")
        print(f"  URL: {url}")

        # Step 1: Firecrawl scrape
        print(f"  Scraping with Firecrawl...")
        md = firecrawl_scrape(url)
        if not md or len(md) < 500:
            print(f"  SKIP: no content ({len(md)} chars)")
            continue
        print(f"  Got {len(md)} chars of markdown")

        # Step 2: DeepSeek analysis
        print(f"  Analyzing with DeepSeek...")
        raw = deepseek_extract(md)
        cards = parse_json(raw)

        if not cards:
            # Save sample markdown for debugging
            dbg_file = f"scripts/_debug_{code}.md"
            try:
                with open(dbg_file, "w", encoding="utf-8") as f:
                    f.write(md[:10000])
            except:
                pass
            print(f"  No cards found by DeepSeek (sample saved to {dbg_file})")
            continue
        print(f"  Found {len(cards)} cards")

        # Step 3: Store in Supabase
        inserted = 0
        for card in cards:
            record = {
                "bank_id": bank["id"],
                "name": card.get("name", ""),
                "network": card.get("network"),
                "card_level": card.get("card_level"),
                "is_cobrand": card.get("is_cobrand", False),
                "co_brand_partner": card.get("co_brand_partner"),
                "key_benefits": str(card.get("key_benefits", ""))[:200],
                "annual_fee": card.get("annual_fee"),
                "source_page": url,
            }
            try:
                # Check if already exists
                existing = s.table("card_products").select("id").eq("bank_id", bank["id"]).eq("name", record["name"]).execute()
                if existing.data and len(existing.data) > 0:
                    continue  # skip duplicate
                s.table("card_products").insert(record).execute()
                inserted += 1
            except Exception as e:
                err_msg = str(e)
                if "duplicate" in err_msg.lower() or "23505" in err_msg:
                    continue  # race condition duplicate, ok
                print(f"    Insert error [{card.get('name')}]: {err_msg[:80]}")

        print(f"  Inserted: {inserted}")
        total_inserted += inserted

        # Rate limiting
        time.sleep(2)

    print(f"\n{'='*50}")
    print(f"TOTAL: {total_inserted} new cards inserted")
    print(f"DONE")

if __name__ == "__main__":
    main()
