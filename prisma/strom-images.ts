import catalog from "./strom-catalog.json";
import brand from "./strom-brand.json";

const legacyImages = new Map<string, string>([
  ...catalog.map((product, index) => [`/strom/${index + 1}.webp`, product.image] as const),
  ["/strom/logo.webp", brand.logoUrl] as const
]);

// Replace only exact legacy asset references, including nested editor drafts.
// Merchant-uploaded URLs, routes, copy and unrelated tenants stay untouched.
export function replaceStromImageReferences<T>(value: T): T {
  if (typeof value === "string") return (legacyImages.get(value) ?? value) as T;
  if (Array.isArray(value)) return value.map(replaceStromImageReferences) as T;
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceStromImageReferences(item)])) as T;
  }
  return value;
}
