import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'File Upload UI',
  description: 'Next.js + Tailwind v4 project',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
