/* Telegram Bot API client (browser side).
   The bot token is stored in this browser only (localStorage) and requests go straight to
   api.telegram.org. Nothing is sent anywhere else. */

const KEY = "invsys_tg_cfg_v1";
const mem = {};

export function getTgConfig() {
  try {
    const raw = localStorage.getItem(KEY) ?? mem[KEY];
    const c = raw ? JSON.parse(raw) : null;
    return c && c.token ? c : null;
  } catch { return null; }
}
export function setTgConfig(cfg) {
  const raw = JSON.stringify(cfg);
  mem[KEY] = raw;
  try { localStorage.setItem(KEY, raw); } catch { /* memory only */ }
}
export function clearTgConfig() {
  delete mem[KEY];
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

const endpoint = (token, method) => `https://api.telegram.org/bot${token}/${method}`;

async function call(token, method, body) {
  let res;
  try {
    const init = body instanceof FormData
      ? { method: "POST", body }
      : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) };
    res = await fetch(endpoint(token, method), init);
  } catch {
    throw Object.assign(new Error("network"), { kind: "network" });
  }
  let data = null;
  try { data = await res.json(); } catch { /* not json */ }
  if (!res.ok || !data?.ok) {
    const kind = res.status === 401 || res.status === 404 ? "invalid_token"
      : res.status === 400 || res.status === 403 ? "chat"
        : res.status === 409 ? "webhook" : "service";
    throw Object.assign(new Error(data?.description || `HTTP ${res.status}`), { kind, status: res.status });
  }
  return data.result;
}

export const tgMe = (token) => call(token, "getMe");

/* Finds the private chat of whoever last wrote /start to the bot. */
export async function tgDetectChat(token) {
  const updates = await call(token, "getUpdates", { limit: 30, allowed_updates: ["message"] });
  const msg = [...updates].reverse().map((u) => u.message).find((m) => m?.chat?.type === "private");
  if (!msg) return null;
  const c = msg.chat;
  return { id: String(c.id), name: [c.first_name, c.last_name].filter(Boolean).join(" ") || c.username || "" };
}

function chunks(text, max = 3800) {
  const out = []; let cur = "";
  const push = () => { if (cur) out.push(cur); cur = ""; };
  for (let line of String(text).split("\n")) {
    while (line.length > max) { push(); out.push(line.slice(0, max)); line = line.slice(max); }   // Telegram refuses messages over 4096 characters
    if (cur && (cur + "\n" + line).length > max) push();
    cur = cur ? cur + "\n" + line : line;
  }
  push();
  return out.length ? out : [""];
}

export async function tgSend(text, cfg = getTgConfig()) {
  if (!cfg?.token || !cfg?.chatId) throw Object.assign(new Error("not_configured"), { kind: "not_configured" });
  for (const part of chunks(text)) {
    await call(cfg.token, "sendMessage", { chat_id: cfg.chatId, text: part, disable_web_page_preview: true });
  }
}

export async function tgSendFile(blob, filename, caption = "", cfg = getTgConfig()) {
  if (!cfg?.token || !cfg?.chatId) throw Object.assign(new Error("not_configured"), { kind: "not_configured" });
  const fd = new FormData();
  fd.append("chat_id", cfg.chatId);
  if (caption) fd.append("caption", caption.slice(0, 1000));
  fd.append("document", blob, filename);
  await call(cfg.token, "sendDocument", fd);
}

/* ---------- user-facing messages (ar / en) ---------- */
const MSG = {
  ar: {
    setup: "اضبط تيليجرام من الإعدادات أولاً (الرمز ورقم المحادثة).",
    sent: "تم الإرسال إلى تيليجرام ✅",
    eNet: "تعذّر الوصول إلى تيليجرام. تحقق من الاتصال بالإنترنت.",
    eToken: "رمز البوت غير صحيح.",
    eChat: "رفض تيليجرام الإرسال: تأكد من رقم المحادثة وأنك ضغطت Start في البوت.",
    eWebhook: "هذا البوت مرتبط بخدمة أخرى (Webhook) فلا يمكن قراءة المحادثة منه. أدخل رقم المحادثة يدوياً.",
    eSvc: "حدث خطأ من تيليجرام. حاول مجدداً.",
  },
  en: {
    setup: "Set up Telegram in Settings first (bot token and chat ID).",
    sent: "Sent to Telegram ✅",
    eNet: "Could not reach Telegram. Check your internet connection.",
    eToken: "The bot token is not valid.",
    eChat: "Telegram refused to send: check the chat ID and press Start in the bot.",
    eWebhook: "This bot is attached to another service (webhook), so its chat cannot be read. Enter the chat ID manually.",
    eSvc: "Telegram returned an error. Try again.",
  },
};
export const tgMsg = (locale) => MSG[locale === "ar" ? "ar" : "en"];
export const tgErr = (locale, e) => {
  const m = tgMsg(locale);
  return e?.kind === "not_configured" ? m.setup : e?.kind === "network" ? m.eNet : e?.kind === "invalid_token" ? m.eToken
    : e?.kind === "chat" ? m.eChat : e?.kind === "webhook" ? m.eWebhook : m.eSvc;
};
