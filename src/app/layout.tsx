import type { Metadata } from "next";
import { Chakra_Petch, Fira_Code, Fira_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { AppShell } from "@/components/app-shell";

const chakraPetch = Chakra_Petch({
  variable: "--font-chakra",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
});

const firaSans = Fira_Sans({
  variable: "--font-fira-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
});

const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Event Radar",
  description: "Personal event discovery console",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`dark ${chakraPetch.variable} ${firaSans.variable} ${firaCode.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
