import { randomUUID } from "node:crypto";

import { slugify } from "./slug";

export function buildProductSlug(name: string, identifier = randomUUID().replaceAll("-", "").slice(0, 8)) {
  const baseSlug = slugify(name) || "producto";
  const suffix = slugify(identifier).replaceAll("-", "").slice(0, 8) || randomUUID().replaceAll("-", "").slice(0, 8);
  return `${baseSlug}-${suffix}`;
}
