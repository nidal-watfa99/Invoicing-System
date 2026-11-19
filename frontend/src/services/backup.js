/* Backup: one JSON file with all business data, the local database, settings and (optionally)
   photos/videos and secret keys. Import validates the file first. */
import { exportBackup, importBackup } from "./biz";
import { dumpMedia, restoreMedia } from "./media";

const LAST = "invsys_last_export";
export const lastExport = () => { try { return localStorage.getItem(LAST) || ""; } catch { return ""; } };

export async function downloadBackup({ secrets = false, media = true } = {}) {
  const obj = JSON.parse(exportBackup({ secrets }));
  if (media) { try { obj.media = await dumpMedia(); } catch { obj.media = []; } }
  const url = URL.createObjectURL(new Blob([JSON.stringify(obj)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url; a.download = `invoicing-system-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  try { localStorage.setItem(LAST, new Date().toISOString()); } catch { /* ignore */ }
}

/* Throws when the file is not a valid backup (nothing is changed in that case). */
export async function restoreBackup(text) {
  importBackup(text);
  try {
    const d = JSON.parse(text);
    if (Array.isArray(d.media)) await restoreMedia(d.media);
  } catch { /* media is optional */ }
}
