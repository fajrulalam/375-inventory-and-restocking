import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Viewport configuration
export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "375 Dashboard",
  description: "Created by 375 Technology",
  metadataBase: new URL('http://localhost:3000'), // Replace with your production URL
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/assets/375_logo.png', type: 'image/png' },
    ],
    apple: [
      { url: '/assets/375_logo.png', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '375 Dashboard',
  },
  openGraph: {
    type: 'website',
    siteName: '375 Dashboard',
    title: '375 Dashboard',
    description: '375 Inventory and Restocking Dashboard',
    images: [
      {
        url: '/assets/375_logo.png',
        width: 512,
        height: 512,
        alt: '375 Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '375 Dashboard',
    description: '375 Inventory and Restocking Dashboard',
    images: ['/assets/375_logo.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
