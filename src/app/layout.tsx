import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Шпион · Игра с друзьями",
  description:
    "Создай комнату, позови друзей по коду и сыграйте в Шпиона: один из вас — импостер и не знает загаданное слово.",
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-bg font-sans text-fg antialiased">
        {children}
      </body>
    </html>
  );
}
