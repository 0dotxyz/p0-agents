import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "P0 Agents",
  description: "Agent API for the P0 credit protocol on Solana",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
