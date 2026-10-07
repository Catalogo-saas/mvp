import styles from "./storefront-loading.module.css";

type StorefrontLoadingVariant = "home" | "catalog" | "product" | "contact" | "checkout" | "order" | "account";

const loadingLabels: Record<StorefrontLoadingVariant, string> = {
  home: "Cargando tienda…",
  catalog: "Cargando productos…",
  product: "Cargando producto…",
  contact: "Cargando contacto…",
  checkout: "Cargando compra…",
  order: "Cargando pedido…",
  account: "Cargando tu cuenta…"
};

function Lines({ count = 3 }: { count?: number }) {
  return <div className={styles.lines}>{Array.from({ length: count }, (_, index) => <span className={styles.line} key={index}/>)}</div>;
}

function ProductCards({ count = 4 }: { count?: number }) {
  return <div className={styles.productGrid}>{Array.from({ length: count }, (_, index) => <article className={styles.productCard} key={index}>
    <span className={styles.productImage}/>
    <div className={styles.productCopy}><span className={styles.line}/><span className={`${styles.line} ${styles.shortLine}`}/><span className={`${styles.line} ${styles.priceLine}`}/></div>
  </article>)}</div>;
}

export function StorefrontLoading({ variant = "home" }: { variant?: StorefrontLoadingVariant }) {
  return <div className={styles.page} data-variant={variant} aria-busy="true">
    <p className={styles.srOnly} role="status">{loadingLabels[variant]}</p>
    <header className={styles.header} aria-hidden="true">
      <span className={`${styles.block} ${styles.icon} ${styles.menu}`}/>
      <span className={`${styles.block} ${styles.brand}`}/>
      <nav className={styles.nav}><span className={styles.block}/><span className={styles.block}/><span className={styles.block}/></nav>
      <div className={styles.tools}><span className={`${styles.block} ${styles.search}`}/><span className={`${styles.block} ${styles.icon}`}/><span className={`${styles.block} ${styles.icon}`}/></div>
    </header>

    <main className={styles.content} aria-hidden="true">
      {variant === "home" && <>
        <span className={`${styles.block} ${styles.hero}`}/>
        <div className={styles.sectionHeading}><span className={`${styles.block} ${styles.heading}`}/><span className={`${styles.block} ${styles.subheading}`}/></div>
        <ProductCards count={4}/>
      </>}

      {variant === "catalog" && <>
        <div className={styles.pageHeading}><span className={`${styles.block} ${styles.heading}`}/><span className={`${styles.block} ${styles.subheading}`}/></div>
        <div className={styles.catalogToolbar}><span className={`${styles.block} ${styles.filter}`}/><span className={`${styles.block} ${styles.filter}`}/></div>
        <ProductCards count={8}/>
      </>}

      {variant === "product" && <>
        <div className={styles.productLayout}><span className={`${styles.block} ${styles.detailImage}`}/><div className={styles.detailCopy}>
          <span className={`${styles.block} ${styles.heading}`}/><Lines count={2}/><span className={`${styles.block} ${styles.priceLine}`}/><span className={`${styles.block} ${styles.action}`}/>
        </div></div>
        <div className={styles.sectionHeading}><span className={`${styles.block} ${styles.heading}`}/></div><ProductCards count={4}/>
      </>}

      {variant === "contact" && <>
        <div className={styles.pageHeading}><span className={`${styles.block} ${styles.heading}`}/><span className={`${styles.block} ${styles.subheading}`}/></div>
        <div className={styles.columns}><div className={styles.infoGroup}><Lines count={5}/></div><span className={`${styles.block} ${styles.infoPanel}`}/></div>
      </>}

      {(variant === "checkout" || variant === "order" || variant === "account") && <>
        <div className={styles.pageHeading}><span className={`${styles.block} ${styles.heading}`}/><span className={`${styles.block} ${styles.subheading}`}/></div>
        <div className={styles.columns}>
          <section className={styles.panel}><Lines count={variant === "account" ? 4 : 6}/>{variant === "checkout" && <><span className={`${styles.block} ${styles.field}`}/><span className={`${styles.block} ${styles.field}`}/><span className={`${styles.block} ${styles.action}`}/></>}</section>
          <section className={styles.panel}><Lines count={variant === "order" ? 5 : 3}/>{variant === "account" && <span className={`${styles.block} ${styles.field}`}/>}</section>
        </div>
      </>}
    </main>
    <footer className={styles.footer} aria-hidden="true"><span className={`${styles.block} ${styles.footerLine}`}/><span className={`${styles.block} ${styles.footerLine} ${styles.shortLine}`}/></footer>
  </div>;
}
