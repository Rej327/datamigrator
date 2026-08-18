import type { Metadata } from "next";
import "../index.css";

export const metadata: Metadata = {
  title: "DataMigrator - Enterprise Data Migration",
  description: "Legacy Data Migration, Anomaly Diagnostics & Schema Mapping Tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
