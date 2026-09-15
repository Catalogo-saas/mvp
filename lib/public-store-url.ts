type PublicStoreIdentity = {
  slug: string;
};

export function publicStoreHref(store: PublicStoreIdentity, suffix = "") {
  const normalizedSuffix = suffix && !suffix.startsWith("/") && !suffix.startsWith("?") ? `/${suffix}` : suffix;
  return `/${store.slug}${normalizedSuffix}`;
}

export function publicStoreCanonicalUrl(store: PublicStoreIdentity, suffix = "") {
  const normalizedSuffix = suffix && !suffix.startsWith("/") ? `/${suffix}` : suffix;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  return appUrl ? `${appUrl}/${store.slug}${normalizedSuffix}` : `/${store.slug}${normalizedSuffix}`;
}
