import type { Metadata, Viewport } from "next";
import "@fontsource-variable/google-sans-flex";
import "./globals.css";
import NotificationInitializer from "../components/NotificationInitializer";

export const metadata: Metadata = {
  title: "Admerce",
  description: "Buy, sell, and provide services locally",
  manifest: "/manifest.webmanifest", // ✅ Added — links the PWA manifest
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Admerce",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0504AA",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <NotificationInitializer />
        {children}
      </body>
    </html>
  );
}