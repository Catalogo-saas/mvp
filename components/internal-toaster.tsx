"use client";

import { Toaster } from "sonner";
import type { CSSProperties } from "react";

const toastColors = {
  "--normal-bg": "#ffffff",
  "--normal-border": "#e9e9f0",
  "--normal-text": "#25243b",
  "--success-bg": "#ebf7f0",
  "--success-border": "#cde9d9",
  "--success-text": "#287750",
  "--error-bg": "#fff0f0",
  "--error-border": "#f2c8cf",
  "--error-text": "#b23b4b",
  "--warning-bg": "#fff5dd",
  "--warning-border": "#f0dfb2",
  "--warning-text": "#8f6314"
} as CSSProperties;

export function InternalToaster() {
  return <Toaster position="top-right" theme="light" richColors closeButton duration={4000} style={toastColors} />;
}
