import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { pt } from "@biska/shared";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Biska+ · Profissionais verificados em Luanda",
  description: pt.intro,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-AO" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
