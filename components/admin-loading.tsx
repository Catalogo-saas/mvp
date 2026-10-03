type LoadingVariant = "summary" | "list" | "form" | "design";

export function AdminLoading({ title, variant = "list" }: { title?: string; variant?: LoadingVariant }) {
  return <section className={`admin-loading admin-loading--${variant}`} aria-busy="true" aria-label={title ? `Cargando ${title}` : "Cargando gestión"}>
    <p className="sr-only" role="status">{title ? `Cargando ${title}…` : "Cargando…"}</p>
    <div className="admin-loading-heading">{title ? <h1>{title}</h1> : <span className="admin-skeleton admin-skeleton-title" aria-hidden="true"/>}<span className="admin-skeleton admin-skeleton-description" aria-hidden="true"/></div>
    <div className="admin-loading-content" aria-hidden="true">
      {variant === "summary" ? <><div className="admin-loading-metrics">{[0, 1, 2].map(index => <div className="admin-loading-panel" key={index}><span className="admin-skeleton admin-skeleton-label"/><span className="admin-skeleton admin-skeleton-value"/></div>)}</div><div className="admin-loading-panel"><span className="admin-skeleton admin-skeleton-chart"/></div></>
      : variant === "design" ? <><div className="admin-loading-panel admin-loading-controls">{[0, 1, 2, 3].map(index => <span key={index} className="admin-skeleton admin-skeleton-field"/>)}</div><div className="admin-loading-panel admin-loading-preview"><span className="admin-skeleton admin-skeleton-chart"/></div></>
      : <div className="admin-loading-panel">{variant === "list" && <span className="admin-skeleton admin-skeleton-field"/>}{[0, 1, 2, 3, 4].map(index => <div key={index} className="admin-loading-row"><span className="admin-skeleton admin-skeleton-label"/><span className={`admin-skeleton ${variant === "form" ? "admin-skeleton-field" : "admin-skeleton-line"}`}/></div>)}</div>}
    </div>
  </section>;
}
