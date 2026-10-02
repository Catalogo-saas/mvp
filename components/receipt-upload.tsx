"use client";
import { useState } from "react";

export function ReceiptUpload({ token, hasReceipt }: { token: string; hasReceipt: boolean }) {
  const [uploaded, setUploaded] = useState(hasReceipt);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true); setMessage("");
    const form = new FormData(); form.set("hash", token); form.set("file", file);
    try {
      const response = await fetch("/api/orders/receipt", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setUploaded(true); setMessage("Comprobante adjuntado. El pago sigue pendiente hasta que la tienda lo verifique.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo subir el comprobante."); }
    finally { setBusy(false); }
  }
  return <section className="mt-5 rounded-xl border border-slate-200 p-5 text-sm sm:p-7"><h2 className="text-lg font-bold">Comprobante de pago</h2><p className="mt-2 text-slate-600">Podés adjuntarlo ahora o volver más tarde desde este enlace. Formatos JPG, PNG, WebP o PDF, hasta 10 MB.</p><label className="mt-4 inline-flex cursor-pointer rounded-lg border px-4 py-3 font-semibold">{busy ? "Subiendo…" : uploaded ? "Reemplazar comprobante" : "Adjuntar comprobante"}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={busy} onChange={event => void upload(event.currentTarget.files?.[0])}/></label>{uploaded ? <a className="ml-4 font-semibold underline" href={`/api/orders/receipt?hash=${encodeURIComponent(token)}`}>Ver comprobante</a> : null}{message ? <p className="mt-3" role="status">{message}</p> : null}</section>;
}
