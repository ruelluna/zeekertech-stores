import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono, Yellowtail, Zilla_Slab } from "next/font/google";
import "./globals.css";
import { TrackVisitor } from "@/components/presence";
import { Toaster } from "@/components/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The kitchen-label voices (DESIGN.md): brush script for store names, stamped slab caps for short facts.
const yellowtail = Yellowtail({
  variable: "--font-yellowtail",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const zillaSlab = Zilla_Slab({
  variable: "--font-zilla-slab",
  weight: ["600", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  // Store pages set their own title and description; this covers shared pages (order status, legal, admin).
  title: "Order online · Zeeker Tech",
  description: "Order ahead from local stores for pickup and delivery.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${yellowtail.variable} ${zillaSlab.variable} h-full antialiased`}
    >
      <head>
        {/* Public config (Supabase URL, push key…) read at runtime, so the Docker image needs no build variables. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts -- must run before the app's own scripts */}
        <script src="/runtime-env" />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
        <Suspense>
          <TrackVisitor />
        </Suspense>
      </body>
    </html>
  );
}
