# -*- coding: utf-8 -*-
"""Phase 4B - RFP Insights Engine
生成 RFP 视角的银行洞察，基于金管局数据 + 卡片产品组合
"""
import os, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from supabase import create_client
from datetime import date
from collections import defaultdict

def main():
    s = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

    # Clear old insights for clean regeneration
    s.table("insights").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()

    banks = s.table("banks").select("id,name,code").eq("is_active", True).execute()
    stats = s.table("monthly_credit_stats").select("*").order("report_month", desc=True).execute()
    cards = s.table("card_products").select("bank_id,name,network,is_cobrand").execute()
    npl = s.table("quarterly_npl_stats").select("*").order("report_quarter", desc=True).execute()
    digital = s.table("quarterly_digital_acct_stats").select("*").order("report_quarter", desc=True).execute()

    bank_stats = defaultdict(list)
    for st in stats.data:
        bank_stats[st["bank_id"]].append(st)

    bank_cards = defaultdict(list)
    for c in cards.data:
        bank_cards[c["bank_id"]].append(c)

    bank_npl = defaultdict(list)
    for n in npl.data:
        if n.get("npl_ratio") is not None:
            bank_npl[n["bank_id"]].append(n)

    bank_digital = defaultdict(list)
    for d in digital.data:
        if d.get("total_accounts"):
            bank_digital[d["bank_id"]].append(d)

    insights = []
    today = date.today().isoformat()

    for bank in banks.data:
        bid = bank["id"]
        bname = bank["name"]
        if bid not in bank_stats:
            continue

        ls = bank_stats[bid][0]
        circ = ls.get("cards_in_circulation") or 0
        active = ls.get("active_cards") or 0
        rate = (active / circ * 100) if circ > 0 else 0
        rev = (ls.get("revolving_balance") or 0) / 1_0000_0000
        txn = (ls.get("transaction_volume") or 0) / 1_0000_0000
        delinq = ls.get("delinquency_3m_ratio") or 0

        bc = bank_cards.get(bid, [])
        total = len(bc)
        cobrand = sum(1 for c in bc if c.get("is_cobrand"))
        visa_n = sum(1 for c in bc if c.get("network") == "Visa")
        mc_n = sum(1 for c in bc if c.get("network") == "Mastercard")
        jcb_n = sum(1 for c in bc if c.get("network") == "JCB")

        npl_list = bank_npl.get(bid, [])
        ln = npl_list[0] if npl_list else None
        npl_r = ln.get("npl_ratio") if ln else None

        dig_list = bank_digital.get(bid, [])
        ld = dig_list[0] if dig_list else None
        dig_t = ld.get("total_accounts") if ld else None

        def add(text, cat):
            insights.append({"bank_id": bid, "content": text, "category": cat, "created_at": today})

        # Rule 1: Fragmentation
        if total > 10:
            add("该行有{}张卡片产品，联名卡{}张，产品线碎片化严重。建议推 **Vision Next 参数化能力**，快速上线新产品。".format(total, cobrand), "rfp_signal")

        # Rule 2: Dormancy
        if rate > 0 and rate < 60:
            add("有效卡率仅{:.1f}%（流通{:,}张/有效{:,}张），呆卡问题突出。推 **Loyalty/Campaign 营销引擎** 提升活卡率。".format(rate, circ, active), "rfp_signal")

        # Rule 3: High revolving
        if rev > 50:
            add("循环信用余额约{:.0f}亿元，持卡人负债偏高。推 **灵活利息计算 + 分期 + Collections**。".format(rev), "opportunity")

        # Rule 4: Transaction momentum
        if circ > 100000 and txn > 0:
            add("月签帐约{:.0f}亿元，市场活跃。确保核心系统可支撑高并发交易。".format(txn), "opportunity")

        # Rule 5: High NPL
        if npl_r is not None and npl_r > 2.0:
            add("逾放比率{:.1f}%，风控压力偏高。推 **完整风控 + 催收管理模块**。".format(npl_r), "risk")

        # Rule 6: Digital focus
        if dig_t and dig_t > 100000:
            add("数位存款{:,}户，数字化积极。推 **Vision Next 全数位方案**。".format(dig_t), "opportunity")

        # Rule 7: Network mix
        if total > 0:
            if visa_n > mc_n * 3:
                add("Visa({}张)主导，MC({}张)为辅。推MC方案需额外价值说服。".format(visa_n, mc_n), "rfp_signal")
            elif mc_n > visa_n * 1.5:
                add("MC({}张)多于Visa({}张)，推MC有天然优势。".format(mc_n, visa_n), "opportunity")

        # Rule 8: Strong bank flag
        if total >= 20 and rate >= 70 and txn > 100:
            add("⚠ 重点关注：{}张卡、活卡率{:.0f}%、月签{:.0f}亿。优先安排拜访演示。".format(total, rate, txn), "rfp_signal")

    # Batch insert (50 at a time to avoid timeout)
    for i in range(0, len(insights), 50):
        batch = insights[i:i+50]
        s.table("insights").insert(batch).execute()

    print("Generated {} insights for {} banks".format(len(insights), len(set(x["bank_id"] for x in insights))))
    from collections import Counter
    for cat, cnt in Counter(x["category"] for x in insights).most_common():
        print("  {}: {}".format(cat, cnt))

if __name__ == "__main__":
    main()
