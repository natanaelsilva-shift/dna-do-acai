import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import "./globals.css";

// Uma família variável com dois papéis: títulos pesados e condensados (wdth)
// e texto corrido na largura normal. Aplicada só na loja via
// `.dna-store`; o painel admin mantém a fonte do sistema.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  // Sem o eixo opsz: a fonte cai de ~128 KB para ~76 KB (latin) e o
  // condensado dos títulos (wdth) continua igual.
  axes: ["wdth"],
  display: "swap",
  variable: "--font-bricolage",
});

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
  themeColor: "#1a0a1f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={bricolage.variable} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
