import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GasTrack ERP - Sistema de Gestión para Gas Envasado",
  description:
    "GasTrack ERP: sistema integral de gestión para gas envasado. Ventas, stock, repartidores, finanzas, rastreo GPS y WhatsApp en una sola plataforma.",
  keywords: [
    "GasTrack",
    "ERP",
    "gas envasado",
    "garrafas",
    "gestión",
    "repartidores",
    "Uruguay",
  ],
  authors: [{ name: "GasTrack" }],
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
