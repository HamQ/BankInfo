# -*- coding: utf-8 -*-
import os, sys
from supabase import create_client
sys.stdout = __import__('io').TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase = create_client(url, key)

# Fix source_url: replace LAST .pdf with .zip
tables = ["quarterly_digital_acct_stats", "quarterly_npl_stats"]

for table in tables:
    resp = supabase.table(table).select("id,source_url").execute()
    fixed = 0
    for r in resp.data:
        old = r["source_url"]
        if old and old.endswith(".pdf"):
            new_url = old[:-4] + ".zip"
            supabase.table(table).update({"source_url": new_url}).eq("id", r["id"]).execute()
            fixed += 1
    print(table + ": fixed " + str(fixed) + " / " + str(len(resp.data)))
