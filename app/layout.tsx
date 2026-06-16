import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { NavLinks } from "./nav-links";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Chem Tracker",
  description: "Cambridge Part II Chemistry past paper tracker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-zinc-50 text-zinc-900 min-h-screen antialiased`}>
        {/* Navigation */}
        <nav className="border-b border-zinc-200 bg-white sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-8">
            <Link href="/" className="font-semibold text-zinc-900 tracking-tight text-sm">
              Chem Tracker
            </Link>
            <NavLinks />
          </div>
        </nav>

        {/* Page content */}
        <main className="max-w-6xl mx-auto px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
