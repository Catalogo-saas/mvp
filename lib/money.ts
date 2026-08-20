export function formatMoney(cents: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(cents);
}

export function parsePriceToCents(value: FormDataEntryValue | null) {
  const raw = String(value ?? "0").replace(",", ".").trim();
  const number = Number(raw);
  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }
  return Math.round(number);
}
