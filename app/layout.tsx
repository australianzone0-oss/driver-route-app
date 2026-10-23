import type { Metadata, Viewport } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "RouteRun: driver jobs and routes",
  description: "Plan multi-stop runs, complete jobs and notify customers.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "RouteRun", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#1d4ed8",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
