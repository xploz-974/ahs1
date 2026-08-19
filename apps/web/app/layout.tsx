import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AHS1 — Audio Hub Stream",
  description: "Plateforme de diffusion audio pour commerces",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
