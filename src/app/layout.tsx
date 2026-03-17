import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trello WhatsApp Notifier",
  description: "NotificaÃ§Ãµes de prazos do Trello via WhatsApp",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
