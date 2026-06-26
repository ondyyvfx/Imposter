import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Шпион · Игра с друзьями",
  description:
    "Создай комнату, позови друзей по коду и сыграйте в Шпиона: один из вас — импостер и не знает загаданное слово.",
};

export const viewport: Viewport = {
  themeColor: "#0b1020",
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
      <body className="min-h-screen bg-slate-950 font-sans text-slate-100 antialiased">
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-indigo-600/25 blur-[120px]" />
          <div className="absolute top-1/3 -right-40 h-[26rem] w-[26rem] rounded-full bg-fuchsia-600/20 blur-[120px]" />
          <div className="absolute -bottom-40 left-1/4 h-[26rem] w-[26rem] rounded-full bg-cyan-500/15 blur-[120px]" />
        </div>
        {children}
      </body>
    </html>
  );
}
