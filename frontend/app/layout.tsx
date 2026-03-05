import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DocuMind AI — RAG Document Intelligence",
  description: "Ask anything. Get answers from your documents. Instantly. 100% local, open-source RAG intelligence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} dark scroll-smooth`}>
      <head />
      <body className="font-sans antialiased bg-background text-white selection:bg-white selection:text-black min-h-screen">
        {children}
      </body>
    </html>
  );
}
