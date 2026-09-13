import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Tu tienda online — Vendé con tu marca",
    template: "%s | Tu tienda online"
  },
  description: "Una tienda online personalizable para mostrar productos, recibir pedidos y administrar tu negocio desde un solo lugar.",
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
