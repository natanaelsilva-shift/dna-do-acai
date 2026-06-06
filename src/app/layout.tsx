import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000");

const title = "DNA do Açaí | Açaí de verdade, do seu jeito";
const description =
  "Monte seu pedido na DNA do Açaí e aproveite copos bem servidos, açaí cremoso e combinações caprichadas.";
const socialImage = "/images/og-dna-acai.png";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "DNA do Açaí",
  title,
  description,
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "DNA do Açaí",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title,
    description,
    siteName: "DNA do Açaí",
    locale: "pt_BR",
    type: "website",
    images: [
      {
        url: socialImage,
        width: 1200,
        height: 630,
        alt: "Logo da DNA do Açaí",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [socialImage],
  },
  other: {
    "whatsapp:image": socialImage,
    "instagram:image": socialImage,
    "facebook:image": socialImage,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#071b12",
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
