import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AskAboutDemo } from "@/components/AskAboutDemo";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PolicyMeter",
  description: "Cited answers about Virginia AI policy, with every model call metered by agency and use case.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <AskAboutDemo />
        <footer className="border-t px-4 py-4 text-center text-xs text-neutral-500">
          Independent demo. Not affiliated with or endorsed by VITA or the Commonwealth of Virginia. Built by{" "}
          {process.env.NEXT_PUBLIC_BUILDER_NAME ?? "the builder"}.
        </footer>
      </body>
    </html>
  );
}
