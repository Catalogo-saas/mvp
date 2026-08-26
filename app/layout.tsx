import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Landing SaaS — Catálogos con pedidos por WhatsApp",
    template: "%s | Landing SaaS"
  },
  description: "Crea una tienda simple, mobile-first y optimizada para compartir productos por WhatsApp.",
  metadataBase: new URL(process.env.NEXTAUTH_URL ?? "http://localhost:3000")
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}
