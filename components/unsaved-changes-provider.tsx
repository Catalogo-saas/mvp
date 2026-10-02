"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AdminDialog } from "@/components/admin-ui";

const UNSAVED_CHANGES_MESSAGE = "Tenés cambios sin guardar. ¿Querés salir sin guardar los cambios?";

export type ConfirmationOptions = {
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type UnsavedChangesContextValue = {
  confirm: (options: ConfirmationOptions) => Promise<boolean>;
  confirmNavigation: () => Promise<boolean>;
  setHasUnsavedChanges: (hasUnsavedChanges: boolean) => void;
};

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null);

export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [hasUnsavedChanges, setDirty] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationOptions | null>(null);
  const hasUnsavedChangesRef = useRef(false);
  const confirmationResolver = useRef<((confirmed: boolean) => void) | null>(null);
  const setHasUnsavedChanges = useCallback((value: boolean) => { hasUnsavedChangesRef.current = value; setDirty(value); }, []);

  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  const confirm = useCallback((options: ConfirmationOptions) => new Promise<boolean>((resolve) => {
    if (confirmationResolver.current) {
      resolve(false);
      return;
    }
    confirmationResolver.current = resolve;
    setConfirmation(options);
  }), []);

  const settleConfirmation = useCallback((confirmed: boolean) => {
    const resolve = confirmationResolver.current;
    confirmationResolver.current = null;
    setConfirmation(null);
    resolve?.(confirmed);
  }, []);

  const confirmNavigation = useCallback(async () => {
    if (!hasUnsavedChangesRef.current) {
      return true;
    }

    const shouldLeave = await confirm({ title: "Cambios sin guardar", message: UNSAVED_CHANGES_MESSAGE, confirmLabel: "Salir sin guardar" });
    if (shouldLeave) {
      hasUnsavedChangesRef.current = false;
      setHasUnsavedChanges(false);
    }
    return shouldLeave;
  }, [confirm, setHasUnsavedChanges]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!hasUnsavedChangesRef.current) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    }

    function handleDocumentClick(event: MouseEvent) {
      if (
        !hasUnsavedChangesRef.current ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target instanceof Element ? event.target.closest("a") : null;
      if (!target || target.hasAttribute("download") || target.target === "_blank") {
        return;
      }

      const href = target.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }

      const destination = new URL(href, window.location.href);
      if (
        destination.origin !== window.location.origin ||
        (destination.pathname === window.location.pathname && destination.search === window.location.search)
      ) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      void confirmNavigation().then((shouldLeave) => {
        if (shouldLeave) router.push(destination.pathname + destination.search + destination.hash);
      });
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [confirmNavigation, router]);

  return (
    <UnsavedChangesContext.Provider value={{ confirm, confirmNavigation, setHasUnsavedChanges }}>
      {children}
      {confirmation && <AdminDialog
        open
        centeredMobile
        title={confirmation.title ?? "Confirmar acción"}
        onClose={() => settleConfirmation(false)}
        footer={<>
          <button type="button" className="btn-secondary" onClick={() => settleConfirmation(false)}>{confirmation.cancelLabel ?? "Cancelar"}</button>
          <button type="button" className={confirmation.destructive ? "btn-primary admin-confirm-danger" : "btn-primary admin-confirm-primary"} onClick={() => settleConfirmation(true)}>{confirmation.confirmLabel ?? "Confirmar"}</button>
        </>}
      >
        <p>{confirmation.message}</p>
      </AdminDialog>}
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChanges() {
  const context = useContext(UnsavedChangesContext);
  if (!context) {
    throw new Error("useUnsavedChanges debe usarse dentro de UnsavedChangesProvider");
  }
  return context;
}
