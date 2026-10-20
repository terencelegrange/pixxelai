import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "PixxelAI",
  description: "PixxelAI Platform",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const theme = jar.get("pixxelai_theme")?.value ?? jar.get("bp_theme")?.value ?? "dark";

  return (
    <html lang="en" className={`h-full ${theme === "dark" ? "dark" : ""}`}>
      <body className="h-full bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
