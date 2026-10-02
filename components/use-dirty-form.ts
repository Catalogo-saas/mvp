"use client";
import { useEffect } from "react";
import { useUnsavedChanges } from "@/components/unsaved-changes-provider";
export function useDirtyForm(dirty: boolean) {
  const { setHasUnsavedChanges } = useUnsavedChanges();
  useEffect(() => { setHasUnsavedChanges(dirty); return () => setHasUnsavedChanges(false); }, [dirty, setHasUnsavedChanges]);
}
