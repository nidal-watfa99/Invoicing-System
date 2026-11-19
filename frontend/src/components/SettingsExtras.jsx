import React, { useRef, useState } from "react";
import { useApp } from "../context/AppContext";
import { getTgConfig, setTgConfig, clearTgConfig, tgMe, tgDetectChat, tgSend, tgErr } from "../services/telegram";
import { buildAlerts } from "../services/tgReports";
import { downloadBackup, restoreBackup, lastExport } from "../services/backup";

const TX = {
  ar: {
    bTitle: "النسخ الاحتياطي (تصدير / استيراد)",
    bHelp: "بياناتك محفوظة داخل هذا المتصفح فقط. صدّر نسخة بانتظام، فمسح بيانات المتصفح أو تغيير الجهاز يحذفها. الاستيراد يستبدل البيانات الحالية.",
    bMedia: "تضمين الصور والفيديو (يكبّر الملف)",
    bSecrets: "تضمين مفاتيح الذكاء الاصطناعي ورمز تيليجرام (لا تشارك الملف مع أحد)",
    bExport: "تصدير نسخة احتياطية", bImport: "استيراد نسخة",
    bLast: "آخر تصدير", bNever: "لم تُصدَّر نسخة بعد",
    bExported: "تم تصدير النسخة الاحتياطية ✅", bExpFail: "تعذّر التصدير.", bImported: "تم الاستيراد ✅ جارٍ إعادة التحميل…",
    bBad: "الملف غير صالح كنسخة احتياطية. لم يتغير شيء.",
    bConfirm: "سيتم استبدال بياناتك الحالية بمحتوى الملف. هل تريد المتابعة؟ (يُفضّل تصدير نسخة من بياناتك الحالية أولاً)",
    tTitle: "تيليجرام",
    tHelp: "اربط بوتك لتصلك التقارير والتنبيهات. 1) افتح البوت في تيليجرام واضغط Start وأرسل أي رسالة. 2) الصق رمز البوت (من @BotFather) هنا. 3) اضغط «اتصال».",
    tToken: "رمز البوت (Bot Token)", tChat: "رقم المحادثة (Chat ID)", tAuto: "إرسال تنبيهات يومية عند فتح التطبيق (نقص المخزون، الشحنات، العقود)",
    tConnect: "اتصال", tSave: "حفظ", tTest: "رسالة تجربة", tAlerts: "إرسال التنبيهات الآن", tRemove: "إزالة",
    tSec: "الرمز يُحفظ في هذا المتصفح فقط. إن ظننت أنه تسرّب فجدّده من @BotFather.",
    tConnected: "تم الاتصال بالبوت", tNoChat: "لم أجد محادثة: افتح البوت واضغط Start ثم أعد «اتصال»، أو أدخل الرقم يدوياً.",
    tTestMsg: "✅ تم ربط نظام الفوترة بتيليجرام بنجاح.", tSaved: "تم الحفظ", tRemoved: "تمت إزالة إعدادات تيليجرام", tNone: "لا توجد تنبيهات حالياً ✅", tNeed: "أدخل الرمز ورقم المحادثة أولاً.",
  },
  en: {
    bTitle: "Backup (export / import)",
    bHelp: "Your data lives in this browser only. Export a copy regularly — clearing browser data or switching devices deletes it. Importing replaces the current data.",
    bMedia: "Include photos & videos (makes the file bigger)",
    bSecrets: "Include AI keys and Telegram token (never share the file)",
    bExport: "Export backup", bImport: "Import backup",
    bLast: "Last export", bNever: "No backup exported yet",
    bExported: "Backup exported ✅", bExpFail: "Export failed.", bImported: "Imported ✅ reloading…",
    bBad: "This file is not a valid backup. Nothing was changed.",
    bConfirm: "Your current data will be replaced by the file's content. Continue? (Export a copy of the current data first.)",
    tTitle: "Telegram",
    tHelp: "Connect your bot to receive reports and alerts. 1) Open the bot in Telegram, press Start and send any message. 2) Paste the bot token (from @BotFather) here. 3) Press Connect.",
    tToken: "Bot token", tChat: "Chat ID", tAuto: "Send daily alerts when the app opens (low stock, shipments, contracts)",
    tConnect: "Connect", tSave: "Save", tTest: "Send test message", tAlerts: "Send alerts now", tRemove: "Remove",
    tSec: "The token is stored in this browser only. If you think it leaked, regenerate it in @BotFather.",
    tConnected: "Connected to bot", tNoChat: "No chat found: open the bot, press Start, then Connect again — or type the chat ID manually.",
    tTestMsg: "✅ Invoicing System is now linked to Telegram.", tSaved: "Saved", tRemoved: "Telegram settings removed", tNone: "No alerts right now ✅", tNeed: "Enter the token and chat ID first.",
  },
};
const pick = (l) => TX[l === "ar" ? "ar" : "en"];
const row = { display: "flex", gap: "0.5rem", alignItems: "center", fontSize: "var(--text-sm)" };

export function BackupCard() {
  const { locale, toast } = useApp(), x = pick(locale);
  const [secrets, setSecrets] = useState(false), [media, setMedia] = useState(true), [busy, setBusy] = useState(false);
  const fileRef = useRef(null), last = lastExport();

  const doExport = async () => {
    setBusy(true);
    try { await downloadBackup({ secrets, media }); toast(x.bExported, "success"); }
    catch { toast(x.bExpFail, "error"); }
    finally { setBusy(false); }
  };
  const doImport = async (e) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    if (!window.confirm(x.bConfirm)) return;
    setBusy(true);
    try { await restoreBackup(await file.text()); toast(x.bImported, "success"); setTimeout(() => window.location.reload(), 800); }
    catch { toast(x.bBad, "error"); setBusy(false); }
  };

  return (
    <div className="glass card" id="backup" style={{ display: "grid", gap: "0.7rem" }}>
      <h3 style={{ margin: 0 }}>{x.bTitle}</h3>
      <p style={{ margin: 0, color: "var(--text-2)", fontSize: "var(--text-sm)" }}>{x.bHelp}</p>
      <label style={row}><input type="checkbox" checked={media} onChange={(e) => setMedia(e.target.checked)} />{x.bMedia}</label>
      <label style={row}><input type="checkbox" checked={secrets} onChange={(e) => setSecrets(e.target.checked)} />{x.bSecrets}</label>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={doExport}>⬇ {x.bExport}</button>
        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}>⬆ {x.bImport}</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={doImport} />
      </div>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-3)" }}>
        {x.bLast}: {last ? <bdi dir="ltr">{new Date(last).toLocaleString()}</bdi> : x.bNever}
      </div>
    </div>
  );
}

export function TelegramCard() {
  const { locale, toast } = useApp(), x = pick(locale), saved = getTgConfig();
  const [token, setToken] = useState(saved?.token || ""), [chatId, setChatId] = useState(saved?.chatId || "");
  const [auto, setAuto] = useState(!!saved?.auto), [bot, setBot] = useState(saved?.bot || ""), [busy, setBusy] = useState("");

  const cfgNow = (extra = {}) => ({ token: token.trim(), chatId: String(chatId).trim(), auto, bot, ...extra });
  const guard = (fn, tag) => async () => {
    setBusy(tag);
    try { await fn(); } catch (e) { toast(tgErr(locale, e), "error"); } finally { setBusy(""); }
  };

  const connect = guard(async () => {
    const tk = token.trim();
    if (!tk) return toast(x.tNeed, "error");
    const me = await tgMe(tk);
    let id = String(chatId).trim();
    try {
      const c = await tgDetectChat(tk);
      if (c) { id = c.id; setChatId(c.id); } else if (!id) toast(x.tNoChat, "info");
    } catch (e) { if (e.kind === "webhook" && !id) toast(tgErr(locale, e), "info"); else if (e.kind !== "webhook") throw e; }
    setBot(me.username || "");
    setTgConfig(cfgNow({ chatId: id, bot: me.username || "" }));
    toast(`${x.tConnected} @${me.username}`, "success");
  }, "c");

  const save = () => {
    if (!token.trim() || !String(chatId).trim()) return toast(x.tNeed, "error");
    setTgConfig(cfgNow()); toast(x.tSaved, "success");
  };
  const test = guard(async () => {
    if (!token.trim() || !String(chatId).trim()) return toast(x.tNeed, "error");
    const cfg = cfgNow(); setTgConfig(cfg);
    await tgSend(x.tTestMsg, cfg); toast(pickSent(locale), "success");
  }, "t");
  const sendAlerts = guard(async () => {
    const text = buildAlerts(locale);
    if (!text) return toast(x.tNone, "info");
    await tgSend(text); toast(pickSent(locale), "success");
  }, "a");
  const toggleAuto = (v) => { setAuto(v); const c = getTgConfig(); if (c) setTgConfig({ ...c, auto: v }); };
  const remove = () => { clearTgConfig(); setToken(""); setChatId(""); setAuto(false); setBot(""); toast(x.tRemoved, "success"); };

  return (
    <div className="glass card" id="telegram" style={{ display: "grid", gap: "0.7rem" }}>
      <h3 style={{ margin: 0 }}>📨 {x.tTitle}{bot ? ` — @${bot}` : ""}</h3>
      <p style={{ margin: 0, color: "var(--text-2)", fontSize: "var(--text-sm)" }}>{x.tHelp}</p>
      <div className="field">
        <label>{x.tToken}</label>
        <input className="input" type="password" dir="ltr" autoComplete="off" style={{ textAlign: "start" }} value={token} onChange={(e) => setToken(e.target.value)} />
      </div>
      <div className="field">
        <label>{x.tChat}</label>
        <input className="input" dir="ltr" inputMode="numeric" autoComplete="off" style={{ textAlign: "start" }} value={chatId} onChange={(e) => setChatId(e.target.value)} />
      </div>
      <label style={row}><input type="checkbox" checked={auto} onChange={(e) => toggleAuto(e.target.checked)} />{x.tAuto}</label>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button className="btn btn-primary btn-sm" disabled={!!busy} onClick={connect}>{x.tConnect}</button>
        <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={save}>{x.tSave}</button>
        <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={test}>{x.tTest}</button>
        <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={sendAlerts}>{x.tAlerts}</button>
        <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={remove}>{x.tRemove}</button>
      </div>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-3)" }}>{x.tSec}</div>
    </div>
  );
}

const pickSent = (locale) => (locale === "ar" ? "تم الإرسال إلى تيليجرام ✅" : "Sent to Telegram ✅");
