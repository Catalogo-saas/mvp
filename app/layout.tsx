import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Mi negocio | Panel de gestión",
    template: "%s | Tu tienda online"
  },
  description: "Catálogos, pedidos y gestión para tiendas online.",
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
