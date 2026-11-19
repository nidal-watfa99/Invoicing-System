/* Photos & videos live in IndexedDB (not localStorage), so there is no 5 MB cap. */
const open = () => new Promise((res, rej) => {
  const r = indexedDB.open("invsys_media", 1);
  r.onupgradeneeded = () => r.result.createObjectStore("m");
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
const run = async (mode, fn) => {
  const db = await open();
  return new Promise((res, rej) => { const tx = db.transaction("m", mode); const rq = fn(tx.objectStore("m")); tx.oncomplete = () => res(rq?.result); tx.onerror = () => rej(tx.error); });
};
export const putMedia = (id, blob) => run("readwrite", (s) => s.put(blob, id));
export const getMedia = (id) => run("readonly", (s) => s.get(id));
export const delMedia = (id) => run("readwrite", (s) => s.delete(id)).catch(() => {});
export async function compressImage(file, max = 1100) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob((b) => res(b), "image/jpeg", 0.82));
}

/* backup / restore of all photos & videos (as data URLs inside the backup file) */
const toDataUrl = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
export async function dumpMedia() {
  const db = await open();
  const [keys, vals] = await new Promise((res, rej) => {
    const tx = db.transaction("m", "readonly"), st = tx.objectStore("m"), k = st.getAllKeys(), v = st.getAll();
    tx.oncomplete = () => res([k.result, v.result]); tx.onerror = () => rej(tx.error);
  });
  const out = [];
  for (let i = 0; i < keys.length; i++) if (vals[i] instanceof Blob) out.push({ id: keys[i], data: await toDataUrl(vals[i]) });
  return out;
}
export async function restoreMedia(items) {
  for (const m of items) {
    if (!m || !m.id || typeof m.data !== "string") continue;
    const blob = await (await fetch(m.data)).blob();
    await putMedia(m.id, blob);
  }
}
