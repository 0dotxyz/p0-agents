import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "DeFi for AI Agents | Project 0",
  description: "Yield and credit infrastructure layer for the agentic economy.",
  icons: { icon: "/favicon.svg" },
  other: { "theme-color": "#171721" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen overflow-x-hidden">{children}</body>
    </html>
  );
}
