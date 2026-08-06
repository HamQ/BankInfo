# -*- coding: utf-8 -*-
import os, sys
from supabase import create_client

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase = create_client(url, key)

missing = [
    ("048", "王道商業銀行", "王道銀行", "https://www.o-bank.com", "純網銀"),
    ("054", "京城商業銀行", "京城銀行", "https://www.ktb.com.tw", None),
    ("118", "板信商業銀行", "板信銀行", "https://www.bop.com.tw", None),
    ("101", "瑞興商業銀行", "瑞興銀行", "https://www.taipeistarbank.com.tw", None),
    ("NB01", "將來商業銀行", "將來銀行", "https://www.nextbank.com.tw", "純網銀"),
    ("NB02", "連線商業銀行", "連線銀行", "https://www.linebank.com.tw", "LINE Bank 純網銀"),
    ("NB03", "樂天國際商業銀行", "樂天國際銀行", "https://www.rakuten-bank.com.tw", "純網銀"),
]

for code, name, short_name, website, notes in missing:
    existing = supabase.table("banks").select("id").eq("code", code).execute()
    if existing.data:
        print(f"SKIP: {name} ({code})")
    else:
        supabase.table("banks").insert({
            "code": code, "name": name, "short_name": short_name,
            "website": website, "notes": notes
        }).execute()
        print(f"ADD: {name} ({code})")

print("Done")
