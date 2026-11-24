import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AskAboutDemo } from "@/components/AskAboutDemo";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "PolicyMeter", template: "%s | PolicyMeter" },
  description: "Cited answers about Virginia AI policy, with every model call metered by agency and use case.",
};

// Runs before first paint so a dark-mode visitor never sees a white flash. Falls back to the OS setting.
const THEME_SCRIPT = "try{var t=localStorage.getItem(\"pm-theme\");if(t!==\"dark\"&&t!==\"light\")t=matchMedia(\"(prefers-color-scheme: dark)\").matches?\"dark\":\"light\";document.documentElement.dataset.theme=t}catch(e){}";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
      <body className="flex min-h-screen flex-col antialiased">
        <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:text-ink-900 focus:px-3 focus:py-2">
          Skip to content
        </a>
        <SiteNav />
        <div id="content" tabIndex={-1} className="flex-1 outline-none">{children}</div>
        <SiteFooter />
        <AskAboutDemo />
      </body>
    </html>
  );
}
