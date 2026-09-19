import type { Metadata } from "next";
import "@fontsource-variable/google-sans-flex"; // ✅ Added — loads Google Sans Flex variable font
import "./globals.css";
import NotificationInitializer from "../components/NotificationInitializer";

export const metadata: Metadata = {
  title: "Admerce",
  description: "Buy, sell, and provide services locally",
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