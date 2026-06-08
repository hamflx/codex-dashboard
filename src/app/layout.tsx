import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Codex TTFT Dashboard",
  description: "Regional Codex time to first token monitoring dashboard.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
