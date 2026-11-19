import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import { getTgConfig, tgSend, tgMsg, tgErr } from "../services/telegram";
import { REPORTS } from "../services/tgReports";

/* "Send to Telegram" button for a report: <TgButton kind="cash" /> */
export default function TgButton({ kind }) {
  const { locale, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const R = REPORTS[kind];
  if (!R) return null;
  const click = async () => {
    const cfg = getTgConfig();
    if (!cfg?.token || !cfg?.chatId) return toast(tgMsg(locale).setup, "error");
    setBusy(true);
    try { await tgSend(R.build(locale), cfg); toast(tgMsg(locale).sent, "success"); }
    catch (e) { toast(tgErr(locale, e), "error"); }
    finally { setBusy(false); }
  };
  return (
    <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={click}>
      📨 {locale === "ar" ? R.ar : R.en}
    </button>
  );
}
