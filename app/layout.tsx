import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BEYI POWA — Kampala's Phone Marketplace",
  description: "Buy and sell genuine phones in Kampala.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="light">
      <body className="bg-zinc-50 text-zinc-900 antialiased min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}