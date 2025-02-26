import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import dynamic from "next/dynamic";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Bouncing Ball",
  description: "Viral TikTok bouncing ball animation",
};

const DynamicComponents = dynamic(() => import("../components/DynamicComponents"), {
  ssr: true,
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style>{`
          #nprogress .bar {
            background: #FFCB3C !important;
            height: 3px !important;
          }
          #nprogress .peg {
            box-shadow: 0 0 10px #FFCB3C, 0 0 5px #FFCB3C !important;
          }
        `}</style>
      </head>
      <body className={inter.className}>
        <DynamicComponents />
        <div className="fixed inset-0 -z-10 bg-[url('/Clocks-Money-BG.png')] opacity-10" />
        <Suspense
          fallback={
            <div className="min-h-screen bg-gray-700 flex items-center justify-center">
              <div className="text-white text-xl">Loading...</div>
            </div>
          }
        >
          {children}
        </Suspense>
      </body>
    </html>
  );
}