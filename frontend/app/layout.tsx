import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import { spaceGrotesk, inter } from "./fonts";

export const metadata: Metadata = {
  title: "Miro Lite",
  description: "A lightweight collaborative whiteboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}