//Most of this page is in its default condition except the last few lines 
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { EB_Garamond, Cinzel, Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/authProvider";
import backgroundStyles from "@/styles/Background.module.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const ebGaramond = EB_Garamond({
  variable: "--font-eb-garamond",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Spiral Analysis",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} antialiased`}
      >
        <div className={backgroundStyles.drawingContainer} />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

