import Stripe from "https://esm.sh/stripe@17.7.0?target=denonext";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const FOOD: Record<string, { name: string; pence: number; kids?: boolean; taster?: boolean }> = {
  codmeal: { name: "Large cod, med chips & mushy peas", pence: 1140 },
  haddockmeal: { name: "Medium haddock & med chips", pence: 940 },
  plaicemeal: { name: "Plaice & med chips", pence: 950 },
  goujonmeal: { name: "Cod goujons & med chips", pence: 920 },
  bitesmeal: { name: "Cod bites & med chips", pence: 920 },
  medcod: { name: "Medium cod", pence: 690 },
  largecod: { name: "Large cod", pence: 790 },
  medhaddock: { name: "Medium haddock", pence: 690 },
  largehaddock: { name: "Large haddock", pence: 790 },
  plaice: { name: "Plaice", pence: 700 },
  goujons: { name: "Cod goujons", pence: 670 },
  bites: { name: "Cod bites", pence: 670 },
  taster: { name: "Taster box", pence: 720, taster: true },
  sausagemeal: { name: "Sausage & med chips", pence: 410 },
  jumbomeal: { name: "Jumbo sausage & med chips", pence: 475 },
  bigfootmeal: { name: "Bigfoot sausage & med chips", pence: 580 },
  sausage: { name: "Battered sausage", pence: 160 },
  jumbo: { name: "Battered jumbo sausage", pence: 225 },
  bigfoot: { name: "Battered Bigfoot sausage", pence: 330 },
  chipsmall: { name: "Small chips", pence: 200 },
  chipmed: { name: "Medium chips", pence: 250 },
  chiplarge: { name: "Large chips", pence: 350 },
  nuggetmeal: { name: "9 nuggets and med chips", pence: 740 },
  spicymeal: { name: "Spicy chicken strips & med chips", pence: 625 },
  nug6: { name: "Chicken nuggets (6)", pence: 280 },
  nug9: { name: "Chicken nuggets (9)", pence: 390 },
  spicy: { name: "Spicy chicken strips (4)", pence: 375 },
  scampimeal: { name: "9 scampi & med chips", pence: 850 },
  scampi6: { name: "Medium scampi (6)", pence: 395 },
  scampi9: { name: "Large scampi (9)", pence: 560 },
  peas: { name: "Mushy peas", pence: 100 },
  curry: { name: "Curry sauce", pence: 100 },
  gravy: { name: "Gravy", pence: 100 },
  ketchup: { name: "Tomato ketchup pot", pence: 25 },
  tartare: { name: "Pot of tartare sauce", pence: 40 },
  cakemeal: { name: "Jumbo fish cake & med chips", pence: 420 },
  cake: { name: "Jumbo fish cake", pence: 170 },
  mozz: { name: "Mozzarella sticks", pence: 220 },
  spring: { name: "Spring roll", pence: 200 },
  veg: { name: "Veg roll", pence: 200 },
  roll: { name: "Buttered roll", pence: 85 },
  pineapple: { name: "Pineapple fritter", pence: 135 },
  mars: { name: "Battered Mars bar", pence: 150 },
  kidssausage: { name: "Kids sausage, chips & a drink", pence: 400, kids: true },
  kidsfishcake: { name: "Kids fishcake, chips & a drink", pence: 400, kids: true },
  kidsnug: { name: "Kids 4 chicken nuggets, chips & a drink", pence: 400, kids: true },
  kidscod: { name: "Kids 4 cod bits, chips & a drink", pence: 400, kids: true },
  kidscodfish: { name: "Kids cod, chips & a drink", pence: 400, kids: true },
};

const CANS: Record<string, string> = {
  coke: "Coke",
  orangetango: "Orange Tango",
  appletango: "Apple Tango",
  pepsimax: "Pepsi Max",
  drpepper: "Dr Pepper",
  lemonade: "Lemonade",
  shootapple: "Fruit Shoot apple",
  shootblack: "Fruit Shoot blackcurrant",
};

const CHIPS: Record<string, string> = {
  chipsmall: "small chips",
  chipmed: "med chips",
  chiplarge: "large chips",
};

const SLOTS = ["4:30", "4:45", "5:00", "5:15", "5:30", "5:45", "6:00", "6:15", "6:30", "6:45", "7:00"];

function londonDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
}

function quote(id: string) {
  if (FOOD[id]) return { name: FOOD[id].name, pence: FOOD[id].pence };
  if (CANS[id]) return { name: CANS[id], pence: 100 };
  const parts = id.split(":");
  if (parts.length !== 2) return null;
  const base = FOOD[parts[0]];
  const extra = parts[1];
  if (!base) return null;
  if (base.taster && FOOD[extra] && ["gravy", "curry", "peas"].includes(extra)) {
    return { name: "Taster box & " + FOOD[extra].name.toLowerCase(), pence: base.pence };
  }
  if (base.kids && CANS[extra]) {
    return { name: base.name.replace("a drink", CANS[extra]), pence: base.pence };
  }
  if (CHIPS[extra] && FOOD[extra]) {
    return { name: base.name + " & " + CHIPS[extra], pence: base.pence + FOOD[extra].pence };
  }
  return null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!stripeKey || !url || !serviceKey) return json({ error: "Card payment is not switched on yet." });

  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") || "", {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData.user;
  if (!user) return json({ error: "Log in first." }, 401);

  const admin = createClient(url, serviceKey);
  const body = await req.json().catch(() => ({}));
  const stripe = new Stripe(stripeKey);

  if (body.action === "confirm") {
    const session = await stripe.checkout.sessions.retrieve(String(body.session_id || ""));
    if (session.payment_status !== "paid" || session.metadata?.user_id !== user.id) {
      return json({ error: "Payment not finished." });
    }
    const orderId = session.metadata?.order_id || "";
    await admin.from("orders").update({ status: "new" }).eq("id", orderId).eq("status", "unpaid");
    return json({ ok: true, slot: session.metadata?.slot || "" });
  }

  const slot = String(body.slot || "");
  if (!SLOTS.includes(slot)) return json({ error: "Pick a time from the list." });
  const rows = Array.isArray(body.items) ? body.items : [];
  const items: { name: string; qty: number; pence: number }[] = [];
  for (const row of rows) {
    const qty = Math.floor(Number(row.qty));
    const priced = quote(String(row.id || ""));
    if (!priced || qty < 1 || qty > 20) return json({ error: "That basket is not valid." });
    items.push({ name: priced.name, qty, pence: priced.pence });
  }
  if (!items.length) return json({ error: "The basket is empty." });
  const total = items.reduce((sum, item) => sum + item.qty * item.pence, 0);
  if (total < 30) return json({ error: "The card payment has to be at least 30p." });

  const day = londonDate();
  await admin.from("orders").delete().eq("status", "unpaid").lt("created_at", new Date(Date.now() - 20 * 60 * 1000).toISOString());

  const { data: profile } = await admin.from("profiles").select("name,address").eq("id", user.id).maybeSingle();
  const { data: order, error: insertError } = await admin.from("orders").insert({
    user_id: user.id,
    name: profile?.name || "",
    address: profile?.address || "",
    slot,
    day,
    items,
    total_pence: total,
    status: "unpaid",
  }).select("id").single();
  if (insertError || !order) {
    const taken = insertError?.code === "23505";
    return json({ error: taken ? "That time has just gone." : "Could not hold that time." });
  }

  const site = "https://thebrotherschipsandfish.co.uk/order.html?v=12";
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,
      success_url: site + "&paid=1&session_id={CHECKOUT_SESSION_ID}",
      cancel_url: site + "&paid=0",
      metadata: { order_id: order.id, user_id: user.id, slot },
      line_items: items.map((item) => ({
        quantity: item.qty,
        price_data: {
          currency: "gbp",
          unit_amount: item.pence,
          product_data: { name: item.name },
        },
      })),
    });
    return json({ url: session.url });
  } catch (_err) {
    await admin.from("orders").delete().eq("id", order.id).eq("status", "unpaid");
    return json({ error: "Could not open the card payment." });
  }
});
