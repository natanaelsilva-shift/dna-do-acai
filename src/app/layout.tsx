import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DNA do Açaí",
  description: "Monte seu açaí, escolha açaí puro ou aproveite os combos DNA.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
