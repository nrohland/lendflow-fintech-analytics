import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import { Shell } from "@/components/shell";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const display = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
});

export const metadata: Metadata = {
  title: "LendFlow",
  description:
    "Synthetic auto-loan product analytics. Approval isn't the finish line. Funding is.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="min-h-screen bg-paper font-sans text-ink antialiased">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
