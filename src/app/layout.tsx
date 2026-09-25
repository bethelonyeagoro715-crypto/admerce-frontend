import type { Metadata, Viewport } from "next";
import "@fontsource-variable/google-sans-flex";
import "./globals.css";
import NotificationInitializer from "../components/NotificationInitializer";

export const metadata: Metadata = {
  title: "Admerce",
  description: "Buy, sell, and provide services locally",
  manifest: "/manifest.json", // ✅ fixed — was "/manifest.webmanifest" which 404s
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent", // ✅ matches brand-blue status bar
    title: "Admerce",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
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