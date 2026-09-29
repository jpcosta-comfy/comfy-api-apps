import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Comfy API Apps",
  description:
    "Product Relight, Image Upscaler, Sprite Generator, Virtual Try On, and Background Removal on personal Comfy deployments.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
