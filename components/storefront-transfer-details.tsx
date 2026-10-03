"use client";

import { useState } from "react";
import { Copy, Landmark } from "lucide-react";
import type { PaymentMethod } from "@/lib/commerce-settings";
import styles from "./storefront-checkout-page.module.css";

export function StorefrontTransferDetails({ payment }: { payment: PaymentMethod }) {
  const [feedback, setFeedback] = useState<{ message: string; failed: boolean } | null>(null);
  const fields = [
    { label: "Alias", value: payment.alias, copy: "Copiar alias" },
    { label: "CBU/CVU", value: payment.cbu, copy: "Copiar CBU/CVU" },
    { label: "Titular", value: payment.accountHolder },
    { label: "Banco / proveedor", value: payment.provider }
  ].filter(field => field.value.trim());

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setFeedback({ message: `${label} copiado.`, failed: false });
    } catch {
      setFeedback({ message: `No pudimos copiar ${label.toLowerCase()}. Seleccioná el dato y copialo manualmente.`, failed: true });
    }
  }

  if (!fields.length) return null;
  return <section className={styles.transferDetails} aria-label="Datos para transferir">
    <h3><Landmark size={21} aria-hidden="true"/>Datos para transferir</h3>
    <dl>{fields.map(field => <div className={styles.transferRow} key={field.label}>
      <div><dt>{field.label}</dt><dd>{field.value}</dd></div>
      {field.copy && <button type="button" className={styles.copyButton} onClick={() => void copy(field.value, field.label)}><Copy size={16} aria-hidden="true"/>{field.copy}</button>}
    </div>)}</dl>
    <p className={styles.copyFeedback} role={feedback?.failed ? "alert" : "status"} aria-atomic="true">{feedback?.message}</p>
  </section>;
}
