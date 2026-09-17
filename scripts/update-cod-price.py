#!/usr/bin/env python3
"""UK landed frozen Atlantic cod (HMRC) plus this van's catering on-cost."""
import collections
import json
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

OUT = Path("data/cod-price.json")
KG_TO_LB = 2.20462
COMMODITY_ID = 3047190  # CN8 03047190 frozen Atlantic / Greenland cod fillets
# £349.90 for 45 lb vs HMRC July 2026 landed £5.67/lb
VAN_UPLIFT = 1.372


def fetch_ots():
    filt = "CommodityId eq %s and MonthId ge 202401" % COMMODITY_ID
    url = "https://api.uktradeinfo.com/OTS?" + urllib.parse.urlencode(
        {"$filter": filt, "$top": "40000"}
    )
    req = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; BrothersChipsPriceBot/1.0; +https://www.thebrotherschipsandfish.co.uk/)",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())["value"]


def main():
    rows = fetch_ots()
    by = collections.defaultdict(lambda: {"v": 0.0, "m": 0.0})
    for r in rows:
        if r.get("FlowTypeId") not in (1, 3):
            continue
        by[r["MonthId"]]["v"] += r.get("Value") or 0
        by[r["MonthId"]]["m"] += r.get("NetMass") or 0
    months = sorted(k for k, x in by.items() if x["m"] >= 50000)
    if not months:
        raise SystemExit("no HMRC import months with volume")
    latest = months[-1]
    x = by[latest]
    landed_kg = x["v"] / x["m"]
    van_kg = landed_kg * VAN_UPLIFT
    year, month = divmod(latest, 100)
    payload = {
        "gbp_per_kg": round(van_kg, 2),
        "gbp_per_lb": round(van_kg / KG_TO_LB, 2),
        "landed_gbp_per_kg": round(landed_kg, 2),
        "landed_gbp_per_lb": round(landed_kg / KG_TO_LB, 2),
        "uplift_pct": round((VAN_UPLIFT - 1) * 100),
        "month": "%04d-%02d" % (year, month),
        "tonnes": round(x["m"] / 1000, 1),
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "source": "HMRC UK imports of frozen Atlantic cod fillets + catering on-cost",
        "source_url": "https://www.uktradeinfo.com/",
        "kind": "van_pay",
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(payload)


if __name__ == "__main__":
    main()
