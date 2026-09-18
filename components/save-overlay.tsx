"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useRef } from "react";

import { useLockBodyScroll } from "@/components/use-lock-body-scroll";

export function SaveOverlay({ title }: { title: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useLockBodyScroll(true);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;

    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="m-auto w-[min(90vw,380px)] border-0 bg-transparent p-0 backdrop:bg-ink/60 backdrop:backdrop-blur-sm"
      aria-labelledby="save-overlay-title"
      aria-describedby="save-overlay-description"
      onCancel={(event) => event.preventDefault()}
    >
      <div className="panel grid justify-items-center gap-4 p-8 text-center shadow-2xl" aria-live="assertive" aria-busy="true">
        <LoaderCircle className="animate-spin text-brand" size={42} aria-hidden="true" />
        <div>
          <h2 id="save-overlay-title" className="text-xl font-black">{title}</h2>
          <p id="save-overlay-description" className="mt-2 text-sm font-semibold text-muted">No cierres esta ventana.</p>
        </div>
      </div>
    </dialog>
  );
}
