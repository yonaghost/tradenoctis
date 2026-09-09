import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Noctis — Traduza a internet no seu idioma',
  description:
    'Noctis traduz páginas da internet completamente, incluindo o texto dentro das imagens — mangás, prints, banners e infográficos.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-noctis-bg text-noctis-ink antialiased">{children}</body>
    </html>
  );
}
