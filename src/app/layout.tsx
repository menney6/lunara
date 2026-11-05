import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "./globals.css";
import { ToastProvider } from "@/components/toast";

export const metadata: Metadata = {
  title: {
    default: "Lunara — Know your cycle",
    template: "%s · Lunara",
  },
  description:
    "Lunara is a private women's health companion for tracking your menstrual cycle, symptoms, mood and pregnancy — with personalised insights and clear education.",
  keywords: [
    "menstrual cycle",
    "period tracker",
    "ovulation",
    "fertile window",
    "symptom tracker",
    "women's health",
  ],
  openGraph: {
    title: "Lunara — Know your cycle",
    description: "Track your cycle, symptoms and wellbeing in one calm, private place.",
    type: "website",
    siteName: "Lunara",
  },
};

export const viewport: Viewport = {
  themeColor: "#FFF9F6",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-dvh bg-cream text-ink antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
