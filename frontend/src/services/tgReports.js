/* Plain-text reports sent to Telegram. Every number is computed here from the same business
   data the pages use (no AI involved). */
import { getBiz, totals, fmt, getLow, stockLeft, todayStr } from "./biz";
import { goodsOwed, fxFor, brandSales, contractState } from "./agencies";
import { getTgConfig, tgSend } from "./telegram";

const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);

const D = {
  ar: {
    cash: "💰 الصندوق اليومي", salesCount: "عدد المبيعات", total: "إجمالي المبيعات (مع الضريبة)", tax: "الضريبة",
    net: "الصافي قبل التكلفة", cost: "التكلفة", profit: "الربح التقديري", owed: "دَين على الزبائن", noSales: "لا توجد مبيعات في هذا اليوم.",
    top: "الأكثر مبيعاً", m: { cash: "نقداً", card: "بطاقة", transfer: "حوالة", wallet: "محفظة" },
    low: "⚠️ أصناف وصلت لحد إعادة الطلب", noLow: "لا توجد أصناف تحتاج إعادة طلب ✅", left: "المتبقي", min: "الحد", more: "… وأصناف أخرى",
    ag: "🏢 ملخص الوكالات", noAg: "لا توجد وكالات مسجّلة.", target: "الهدف السنوي", rebate: "مكافأة مستحقة", contract: "العقد",
    st: { expired: "منتهٍ", soon: "ينتهي قريباً", active: "ساري" }, until: "حتى",
    ships: "📦 الشحنات غير المستلمة", noShips: "لا توجد شحنات قيد الانتظار.", payable: "المتبقي للمورّد", late: "متأخرة",
    alerts: "🔔 تنبيهات اليوم", contracts: "📄 عقود وكالات تحتاج انتباهاً", shipSoon: "📦 شحنات تصل خلال أسبوع أو متأخرة",
    status: { ordered: "مطلوبة", shipped: "مشحونة", customs: "في الجمارك", received: "مستلمة" },
  },
  en: {
    cash: "💰 Daily cash", salesCount: "Sales", total: "Total sales (with tax)", tax: "Tax",
    net: "Net before cost", cost: "Cost", profit: "Estimated profit", owed: "Owed by customers", noSales: "No sales on this day.",
    top: "Top sellers", m: { cash: "Cash", card: "Card", transfer: "Transfer", wallet: "Wallet" },
    low: "⚠️ Items at reorder level", noLow: "No items need reordering ✅", left: "Left", min: "Min", more: "… and more items",
    ag: "🏢 Agencies summary", noAg: "No agencies registered.", target: "Annual target", rebate: "Rebate due", contract: "Contract",
    st: { expired: "Expired", soon: "Ending soon", active: "Active" }, until: "until",
    ships: "📦 Shipments not received", noShips: "No shipments waiting.", payable: "Left to pay the supplier", late: "late",
    alerts: "🔔 Today's alerts", contracts: "📄 Agency contracts needing attention", shipSoon: "📦 Shipments due within a week or late",
    status: { ordered: "Ordered", shipped: "Shipped", customs: "In customs", received: "Received" },
  },
};
const tx = (locale) => D[locale === "ar" ? "ar" : "en"];
const plusDays = (ymd, n) => { const d = new Date(ymd + "T00:00:00"); d.setDate(d.getDate() + n); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

/* ---------- library ---------- */
export function dailyCashText(locale, day = todayStr()) {
  const T = tx(locale), biz = getBiz(), cur = biz.currency;
  const sales = biz.invoices.filter((i) => i.pos && i.issueDate === day), fx = (i) => Number(i.fx) || 1;
  const head = `${T.cash} — ${day}`;
  if (!sales.length) return `${head}\n${T.noSales}`;
  const total = sum(sales, (i) => totals(i).total * fx(i)), taxAmt = sum(sales, (i) => totals(i).tax * fx(i));
  const net = total - taxAmt, cost = sum(sales, (i) => Number(i.cost) || 0);
  const byM = ["cash", "card", "transfer", "wallet"].map((m) => [m, sum(sales.filter((i) => i.method === m), (i) => (Number(i.paidAmount) || 0) * fx(i))]).filter(([, v]) => v > 0);
  const owed = sum(sales, (i) => Math.max(totals(i).total - (Number(i.paidAmount) || 0), 0) * fx(i));
  const top = Object.entries(sales.flatMap((i) => i.items || []).reduce((m, x) => { m[x.desc] = (m[x.desc] || 0) + Number(x.qty); return m; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const out = [head, `${T.salesCount}: ${sales.length}`, `${T.total}: ${fmt(total)} ${cur}`, `${T.tax}: ${fmt(taxAmt)} ${cur}`, `${T.net}: ${fmt(net)} ${cur}`, `${T.cost}: ${fmt(cost)} ${cur}`, `${T.profit}: ${fmt(net - cost)} ${cur}`];
  if (byM.length) out.push("", ...byM.map(([m, v]) => `• ${T.m[m]}: ${fmt(v)} ${cur}`));
  if (owed > 0) out.push("", `${T.owed}: ${fmt(owed)} ${cur}`);
  if (top.length) out.push("", `${T.top}:`, ...top.map(([n, q]) => `• ${n} × ${q}`));
  return out.join("\n");
}

export function lowStockText(locale, max = 25) {
  const T = tx(locale), low = getLow(getBiz());
  if (!low.length) return T.noLow;
  const rows = low.slice(0, max).map((i) => `• ${i.name} — ${T.left}: ${fmt(stockLeft(i))} / ${T.min}: ${fmt(Number(i.minQty) || 0)}`);
  if (low.length > max) rows.push(T.more);
  return [`${T.low} (${low.length})`, ...rows].join("\n");
}

/* ---------- agencies ---------- */
export function agenciesText(locale) {
  const T = tx(locale), biz = getBiz(), cur = biz.currency, today = todayStr(), year = today.slice(0, 4);
  if (!biz.agencies.length) return T.noAg;
  const out = [T.ag];
  biz.agencies.forEach((a) => {
    const st = contractState(a, today), sales = brandSales(biz, a.brand, `${year}-01-01`, `${year}-12-31`), target = Number(a.target) || 0;
    out.push("", `🏷 ${a.brand}${a.principal ? ` (${a.principal})` : ""}`, `${T.contract}: ${T.st[st]}${a.end ? ` — ${T.until} ${a.end}` : ""}`);
    if (target > 0) {
      out.push(`${T.target} ${year}: ${fmt(sales)} / ${fmt(target)} ${cur} (${Math.round((sales / target) * 100)}%)`);
      if (sales >= target && Number(a.rebate) > 0) out.push(`${T.rebate}: ${fmt((sales * a.rebate) / 100)} ${cur}`);
    }
  });
  return out.join("\n");
}

export function shipmentsText(locale) {
  const T = tx(locale), biz = getBiz(), today = todayStr();
  const list = biz.shipments.filter((s) => !s.received && s.status !== "received").sort((a, b) => (a.eta || "9999").localeCompare(b.eta || "9999"));
  if (!list.length) return T.noShips;
  const out = [`${T.ships} (${list.length})`];
  list.forEach((s) => {
    const ag = biz.agencies.find((a) => a.id === s.agencyId), left = goodsOwed(s).left * fxFor(biz, s.currency, s.fx);
    const late = s.eta && s.eta < today ? ` ⏰ ${T.late}` : "";
    out.push(`• ${s.no || ""} ${ag?.brand || ""} — ${T.status[s.status] || s.status || ""}${s.eta ? ` — ETA ${s.eta}` : ""}${late}${left > 0 ? ` — ${T.payable}: ${fmt(left)} ${biz.currency}` : ""}`);
  });
  return out.join("\n");
}

/* ---------- daily alerts (low stock, due shipments, contracts) ---------- */
export function buildAlerts(locale) {
  const T = tx(locale), biz = getBiz(), today = todayStr(), parts = [];
  const low = getLow(biz);
  if (low.length) parts.push(lowStockText(locale, 15));
  const soon = biz.shipments.filter((s) => !s.received && s.status !== "received" && s.eta && s.eta <= plusDays(today, 7));
  if (soon.length) {
    parts.push([T.shipSoon, ...soon.map((s) => { const ag = biz.agencies.find((a) => a.id === s.agencyId); return `• ${s.no || ""} ${ag?.brand || ""} — ETA ${s.eta}${s.eta < today ? ` ⏰ ${T.late}` : ""}`; })].join("\n"));
  }
  const ending = biz.agencies.filter((a) => contractState(a, today) !== "active");
  if (ending.length) parts.push([T.contracts, ...ending.map((a) => `• ${a.brand} — ${T.st[contractState(a, today)]}${a.end ? ` (${a.end})` : ""}`)].join("\n"));
  return parts.length ? [`${T.alerts} — ${today}`, ...parts].join("\n\n") : "";
}

const LAST = "invsys_tg_last";
/* Called when the app opens: sends the alerts once per day if the user switched this on. */
export async function maybeSendDailyAlerts(locale) {
  const cfg = getTgConfig();
  if (!cfg?.auto || !cfg.chatId) return false;
  const today = todayStr();
  try { if (localStorage.getItem(LAST) === today) return false; localStorage.setItem(LAST, today); } catch { /* ignore */ }
  const text = buildAlerts(locale);
  if (!text) return false;
  try { await tgSend(text, cfg); return true; } catch { try { localStorage.removeItem(LAST); } catch { /* ignore */ } return false; }
}

export const REPORTS = {
  cash: { ar: "الصندوق اليومي", en: "Daily cash", build: dailyCashText },
  low: { ar: "نقص المخزون", en: "Low stock", build: lowStockText },
  agencies: { ar: "ملخص الوكالات", en: "Agencies summary", build: agenciesText },
  ships: { ar: "الشحنات", en: "Shipments", build: shipmentsText },
};
