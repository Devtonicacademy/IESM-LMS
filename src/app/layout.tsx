import type { Metadata } from "next";
import { Montserrat, Geist_Mono } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IESM - Institute of Ergonomics and Safety Management",
  description:
    "Knowledge & Safety — Shaping healthier, safer, and smarter workplaces through training, certification, and workplace safety programs.",
};

import { AuthProvider } from "@/components/auth-provider";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { NavigationLoadingIndicator } from "@/components/navigation-loading-indicator";
import { TourProvider } from "@/components/tour-guide";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${montserrat.variable} ${geistMono.variable} font-sans antialiased min-h-screen bg-background`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <TourProvider>
              <NavigationLoadingIndicator />
              {children}
              <Toaster position="top-center" richColors />
            </TourProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
