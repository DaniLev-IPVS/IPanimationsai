import type { Metadata, Viewport } from "next";
import { Grandstander, Manrope } from "next/font/google";
import "./globals.css";
import { brand, hero } from "@/content/site";

const display = Grandstander({
  subsets: ["latin"],
  weight: ["800", "900"],
  display: "swap",
  variable: "--font-display",
});

const text = Manrope({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
  variable: "--font-text",
});

const title = `${brand.name} — animated videos people actually finish`;

export const metadata: Metadata = {
  metadataBase: new URL(`https://${brand.domain}`),
  title,
  description: hero.sub,
  icons: { icon: "/brand/favicon.svg", apple: "/brand/app-icon-charcoal.png" },
  openGraph: {
    title,
    description: hero.sub,
    url: `https://${brand.domain}`,
    siteName: brand.name,
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#FFF6EA",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${text.variable}`}>
      <body>{children}</body>
    </html>
  );
}
