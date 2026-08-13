import type { Metadata } from "next";
import "../index.css";

export const metadata: Metadata = {
  title: "Data Migrator",
  description: "Legacy Data Migration App",
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
