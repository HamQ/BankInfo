# -*- coding: utf-8 -*-
"""
银行基础数据初始化脚本
首次部署时运行一次: python seed_banks.py
需要环境变量: SUPABASE_URL, SUPABASE_SERVICE_KEY
"""

import os, sys
from supabase import create_client, Client

BANKS = [
    # (code, name, short_name, website, notes)
    ("004", "臺灣銀行", "臺銀", "https://www.bot.com.tw", None),
    ("005", "臺灣土地銀行", "土地銀行", "https://www.landbank.com.tw", None),
    ("006", "合作金庫商業銀行", "合作金庫", "https://www.tcb-bank.com.tw", None),
    ("007", "第一商業銀行", "第一銀行", "https://www.firstbank.com.tw", None),
    ("008", "華南商業銀行", "華南銀行", "https://www.hncb.com.tw", None),
    ("009", "彰化商業銀行", "彰化銀行", "https://www.chb.com.tw", None),
    ("011", "上海商業儲蓄銀行", "上海銀行", "https://www.scsb.com.tw", None),
    ("012", "台北富邦商業銀行", "台北富邦", "https://www.fubon.com", None),
    ("013", "國泰世華商業銀行", "國泰世華", "https://www.cathaybk.com.tw", None),
    ("016", "高雄銀行", "高雄銀行", "https://www.bok.com.tw", None),
    ("017", "兆豐國際商業銀行", "兆豐銀行", "https://www.megabank.com.tw", None),
    ("021", "花旗(台灣)商業銀行", "花旗(台灣)", "https://www.citibank.com.tw", "消金業務已售予星展"),
    ("050", "臺灣中小企業銀行", "臺灣企銀", "https://www.tbb.com.tw", None),
    ("052", "渣打國際商業銀行", "渣打銀行", "https://www.sc.com/tw", None),
    ("053", "台中商業銀行", "台中銀行", "https://www.tcbbank.com.tw", None),
    ("081", "滙豐(台灣)商業銀行", "滙豐(台灣)", "https://www.hsbc.com.tw", None),
    ("101", "華泰商業銀行", "華泰銀行", "https://www.htabank.com.tw", None),
    ("102", "臺灣新光商業銀行", "新光銀行", "https://www.skbank.com.tw", None),
    ("103", "陽信商業銀行", "陽信銀行", "https://www.sunnybank.com.tw", None),
    ("108", "三信商業銀行", "三信銀行", "https://www.cotabank.com.tw", None),
    ("803", "聯邦商業銀行", "聯邦銀行", "https://www.ubot.com.tw", None),
    ("805", "遠東國際商業銀行", "遠東銀行", "https://www.feib.com.tw", None),
    ("806", "元大商業銀行", "元大銀行", "https://www.yuantabank.com.tw", None),
    ("807", "永豐商業銀行", "永豐銀行", "https://bank.sinopac.com", None),
    ("808", "玉山商業銀行", "玉山銀行", "https://www.esunbank.com.tw", None),
    ("809", "凱基商業銀行", "凱基銀行", "https://www.kgibank.com.tw", None),
    ("810", "星展(台灣)商業銀行", "星展(台灣)", "https://www.dbs.com.tw", None),
    ("812", "台新國際商業銀行", "台新銀行", "https://www.taishinbank.com.tw", None),
    ("815", "安泰商業銀行", "安泰銀行", "https://www.entiebank.com.tw", None),
    ("822", "中國信託商業銀行", "中國信託", "https://www.ctbcbank.com", None),
    ("RC001", "台灣樂天信用卡股份有限公司", "樂天信用卡", "https://card.rakuten.com.tw", "信用卡公司，非銀行"),
    ("AE001", "台灣美國運通國際(股)公司", "美國運通", "https://www.americanexpress.com.tw", "信用卡公司，非銀行"),
]

def seed():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("❌ 请设置环境变量 SUPABASE_URL 和 SUPABASE_SERVICE_KEY")
        sys.exit(1)

    supabase: Client = create_client(url, key)

    for code, name, short_name, website, notes in BANKS:
        existing = supabase.table("banks").select("id").eq("code", code).execute()
        if existing.data:
            print(f"⏭  已存在: {name} ({code})")
        else:
            supabase.table("banks").insert({
                "code": code,
                "name": name,
                "short_name": short_name,
                "website": website,
                "notes": notes,
            }).execute()
            print(f"✅ 新增: {name} ({code})")

    print("\n银行数据初始化完成！")

if __name__ == "__main__":
    seed()
