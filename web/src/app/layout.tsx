import type { Metadata } from "next";
import { Figtree, Fraunces } from "next/font/google";
import { Shell } from "@/components/shell";
import "./globals.css";

const sans = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
});

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
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
