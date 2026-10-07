"use client";

import Image from "next/image";
import { ShoppingBag } from "lucide-react";
import { useState } from "react";
import styles from "./storefront-product-thumbnail.module.css";

export function StorefrontProductThumbnail({ src }: { src: string | null }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return <div className={styles.thumbnail}>
    {src && src !== failedSrc
      ? <Image src={src} alt="" width={64} height={64} sizes="64px" onError={() => setFailedSrc(src)}/>
      : <ShoppingBag size={24} aria-hidden="true"/>}
  </div>;
}
