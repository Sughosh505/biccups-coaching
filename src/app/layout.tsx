import type { Metadata } from "next";
import { Archivo, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * The display face, used ONLY by the printed plan document (DESIGN.md §2, §4
 * Plan document) for its masthead and section bars. Nothing on screen uses it.
 * next/font self-hosts the file, so a document being rendered to PDF never waits
 * on a request to Google.
 */
const archivo = Archivo({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "Biccups",
  description: "Coaching CRM",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // print:h-auto — a 100%-height html reserves a full viewport on paper and
      // costs the document a spurious blank page.
      className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable} h-full antialiased print:h-auto`}
    >
      <body className="min-h-full flex flex-col print:min-h-0">{children}</body>
    </html>
  );
}
