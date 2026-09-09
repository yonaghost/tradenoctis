import Link from 'next/link';
import { Logo } from '../components/Logo';
import { TranslateForm } from '../components/TranslateForm';
import { APK_DOWNLOAD_URL } from '../lib/config';

const FEATURES = [
  { title: 'Tradução completa da página', desc: 'HTML, links e formatação preservados.' },
  { title: 'OCR avançado para imagens', desc: 'Detecta e traduz texto dentro de fotos, prints e banners.' },
  { title: 'Múltiplos idiomas', desc: 'Português, inglês, japonês, coreano, chinês e muito mais.' },
  { title: 'Baixe em PDF', desc: 'Exporte a página já traduzida para ler offline.' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-noctis-border bg-noctis-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo />
          <nav className="hidden items-center gap-8 text-sm text-noctis-muted sm:flex">
            <Link href="/translate" className="hover:text-noctis-ink">
              Tradutor
            </Link>
            <a href="#recursos" className="hover:text-noctis-ink">
              Recursos
            </a>
          </nav>
          <a
            href={APK_DOWNLOAD_URL}
            className="rounded-lg bg-noctis-accent px-4 py-2 text-sm font-semibold text-noctis-bg hover:bg-noctis-accentDark"
          >
            Baixar aplicativo
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16">
        <section className="max-w-3xl">
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
            Traduza páginas da internet no <span className="text-noctis-accent">seu idioma.</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg text-noctis-muted">
            Noctis traduz textos e imagens com precisão, para você entender o mundo sem barreiras — inclusive o
            texto dentro de fotos, mangás e banners.
          </p>

          <div className="mt-8">
            <TranslateForm />
          </div>

          <div id="recursos" className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-noctis-border bg-noctis-card p-4">
                <p className="font-medium text-noctis-ink">{f.title}</p>
                <p className="mt-1 text-sm text-noctis-muted">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 flex flex-col items-start gap-6 rounded-2xl border border-noctis-border bg-noctis-surface p-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Leve o Noctis com você</h2>
            <p className="mt-2 max-w-md text-noctis-muted">
              Baixe o aplicativo Android e traduza páginas e imagens de qualquer lugar, com OCR local no
              dispositivo.
            </p>
          </div>
          <a
            href={APK_DOWNLOAD_URL}
            className="whitespace-nowrap rounded-lg bg-noctis-accent px-6 py-3 font-semibold text-noctis-bg hover:bg-noctis-accentDark"
          >
            ⬇ Baixar APK para Android
          </a>
        </section>
      </main>

      <footer className="border-t border-noctis-border bg-noctis-surface py-8 text-center text-sm text-noctis-muted">
        Noctis — Tradução sem limites.
      </footer>
    </div>
  );
}
