import { LoaderCircle } from "lucide-react";
import styles from "./storefront-quantity-value.module.css";

export function StorefrontQuantityValue({ quantity, verifying, productName }: { quantity: number; verifying: boolean; productName: string }) {
  return <span className={styles.value} role="status" aria-atomic="true">
    {verifying ? <>
      <LoaderCircle size={18} className={styles.spinner} aria-hidden="true" />
      <span className={styles.visuallyHidden}>Verificando stock y precios de {productName}.</span>
    </> : <><span className={styles.visuallyHidden}>Cantidad: </span>{quantity}</>}
  </span>;
}
