import type { Metadata } from "next";
import { IBM_Plex_Mono, Manrope } from "next/font/google";
import { LanguageSwitcher } from "@/components/app/language-switcher";
import { LocaleProvider } from "@/components/app/locale-provider";
import { getRequestLocale } from "@/lib/i18n/server";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: {
    default: "Project Current",
    template: "%s | Project Current",
  },
  description:
    "Project money, capital, and team settlements explained in plain language.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();

  return (
    <html
      lang={locale}
      className={`${manrope.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LocaleProvider initialLocale={locale}>
          <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[38vh] bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.24),transparent_35%),radial-gradient(circle_at_top_right,rgba(251,191,36,0.18),transparent_28%)]" />
          <div className="fixed right-3 top-3 z-40 sm:right-4 sm:top-4">
            <LanguageSwitcher />
          </div>
          <div className="relative z-10 flex min-h-full flex-1 flex-col">{children}</div>
        </LocaleProvider>
      </body>
    </html>
  );
}
