#!/usr/bin/env python3
"""Pull UK supermarket cod-fillet unit prices and write data/cod-price.json."""
import json
import re
import statistics
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

URL = "https://allsupers.co.uk/browse/meat-poultry-and-fish/fresh-fish/cod-fillets"
OUT = Path("data/cod-price.json")
KG_TO_LB = 2.20462

def main():
    req = urllib.request.Request(
        URL,
        headers={"User-Agent": "Mozilla/5.0 (compatible; BrothersChipsPriceBot/1.0; +https://www.thebrotherschipsandfish.co.uk/)"},
    )
    html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
    raw = [float(x) for x in re.findall(r"£(\d+\.\d+)(?:<!-- -->)?/(?:<!-- -->)?kg", html)]
    uniq = []
    seen = set()
    for v in raw:
        if 5 <= v <= 60 and v not in seen:
            seen.add(v)
            uniq.append(v)
    if len(uniq) < 5:
        raise SystemExit("not enough supermarket prices (%s)" % len(uniq))
    kg = statistics.median(uniq)
    payload = {
        "gbp_per_kg": round(kg, 2),
        "gbp_per_lb": round(kg / KG_TO_LB, 2),
        "low_kg": round(min(uniq), 2),
        "high_kg": round(max(uniq), 2),
        "n": len(uniq),
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "source": "UK supermarket cod fillets",
        "source_url": URL,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(payload)

if __name__ == "__main__":
    main()
