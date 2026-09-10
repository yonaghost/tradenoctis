'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Logo } from './Logo';
import { LANGUAGES } from '../lib/languages';

interface Props {
  initialUrl: string;
  initialLang: string;
}

function proxyUrlFor(url: string, lang: string, scale: number): string {
  return `/api/proxy?url=${encodeURIComponent(url)}&lang=${encodeURIComponent(lang)}&scale=${scale}`;
}

function pdfUrlFor(url: string, lang: string, scale: number): string {
  return `/api/pdf?url=${encodeURIComponent(url)}&lang=${encodeURIComponent(lang)}&scale=${scale}`;
}

function labelForLangCode(code: string): string {
  const match = LANGUAGES.find((l) => l.code.toLowerCase() === code.toLowerCase());
  if (match) return match.label.replace(/\s*\(.*\)$/, '');
  return code.toUpperCase();
}

export function TranslatorApp({ initialUrl, initialLang }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [addressValue, setAddressValue] = useState(initialUrl);
  const [lang, setLang] = useState(initialLang);
  const [mode, setMode] = useState<'translated' | 'original'>('translated');
  const [fontScale, setFontScale] = useState(1);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [loading, setLoading] = useState(!!initialUrl);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [detectedSourceLang, setDetectedSourceLang] = useState<string | null>(null);

  const iframeSrc = currentUrl ? proxyUrlFor(currentUrl, lang, fontScale) : '';

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || !event.data || event.data.source !== 'noctis') return;
      if (event.data.type === 'noctis-progress') {
        setProgress({ done: event.data.imagesDone ?? 0, total: event.data.imagesTotal ?? 0 });
      } else if (event.data.type === 'noctis-ready') {
        setLoading(false);
      } else if (event.data.type === 'noctis-source-lang' && typeof event.data.lang === 'string') {
        setDetectedSourceLang(event.data.lang);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  function postToFrame(message: Record<string, unknown>) {
    iframeRef.current?.contentWindow?.postMessage(message, window.location.origin);
  }

  function navigateTo(url: string) {
    setProgress({ done: 0, total: 0 });
    setLoading(true);
    setDetectedSourceLang(null);
    setCurrentUrl(url);
    setAddressValue(url);
  }

  function handleAddressSubmit(e: React.FormEvent) {
    e.preventDefault();
    let value = addressValue.trim();
    if (!value) return;
    if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
    navigateTo(value);
  }

  function handleFrameLoad() {
    setLoading(false);
    try {
      const frameUrl = new URL(iframeRef.current?.contentWindow?.location.href ?? '');
      const originalUrl = frameUrl.searchParams.get('url');
      if (originalUrl) setAddressValue(originalUrl);
    } catch {
      // Cross-context read can fail transiently during navigation — ignore.
    }
  }

  function goBack() {
    iframeRef.current?.contentWindow?.history.back();
  }
  function goForward() {
    iframeRef.current?.contentWindow?.history.forward();
  }
  function reload() {
    setProgress({ done: 0, total: 0 });
    setLoading(true);
    setDetectedSourceLang(null);
    iframeRef.current?.contentWindow?.location.reload();
  }
  function goHome() {
    navigateTo(initialUrl);
  }

  function toggleMode() {
    const next = mode === 'translated' ? 'original' : 'translated';
    setMode(next);
    postToFrame({ type: 'noctis-set-mode', mode: next });
  }

  function changeLang(newLang: string) {
    setLang(newLang);
    setLoading(true);
    setProgress({ done: 0, total: 0 });
  }

  const applyScale = useCallback((value: number) => {
    setFontScale(value);
    postToFrame({ type: 'noctis-set-scale', scale: value });
  }, []);

  async function downloadPdf() {
    if (!currentUrl) return;
    setPdfBusy(true);
    try {
      window.open(pdfUrlFor(currentUrl, lang, fontScale), '_blank');
    } finally {
      setTimeout(() => setPdfBusy(false), 1500);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-noctis-bg">
      <header className="flex flex-col gap-3 border-b border-noctis-border bg-noctis-surface px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Logo size={24} />
          </Link>

          <div className="flex items-center gap-1 text-noctis-muted">
            <ToolbarButton label="Voltar" onClick={goBack} icon="←" />
            <ToolbarButton label="Avançar" onClick={goForward} icon="→" />
            <ToolbarButton label="Recarregar" onClick={reload} icon="⟳" />
            <ToolbarButton label="Início" onClick={goHome} icon="⌂" />
          </div>

          <form onSubmit={handleAddressSubmit} className="flex flex-1 items-center">
            <input
              value={addressValue}
              onChange={(e) => setAddressValue(e.target.value)}
              className="w-full rounded-lg border border-noctis-border bg-noctis-card px-3 py-2 text-sm text-noctis-ink focus:border-noctis-accent focus:outline-none"
              placeholder="https://example.com"
            />
          </form>

          <div className="flex items-center gap-1.5 whitespace-nowrap text-sm text-noctis-muted">
            <span>
              {detectedSourceLang ? (
                <>
                  De <span className="text-noctis-ink">{labelForLangCode(detectedSourceLang)}</span> para
                </>
              ) : (
                'Traduzir para'
              )}
            </span>
            <select
              value={lang}
              onChange={(e) => changeLang(e.target.value)}
              aria-label="Idioma de destino"
              className="rounded-lg border border-noctis-border bg-noctis-card px-2 py-2 text-sm text-noctis-ink"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={downloadPdf}
            disabled={!currentUrl || pdfBusy}
            className="whitespace-nowrap rounded-lg bg-noctis-accent px-3 py-2 text-sm font-semibold text-noctis-bg hover:bg-noctis-accentDark disabled:opacity-50"
          >
            ⬇ Baixar PDF
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <button
            onClick={toggleMode}
            className="flex items-center gap-2 text-sm"
            aria-pressed={mode === 'translated'}
          >
            <span
              className={`relative h-5 w-9 rounded-full transition ${mode === 'translated' ? 'bg-noctis-accent' : 'bg-noctis-border'}`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-noctis-bg transition ${mode === 'translated' ? 'left-4' : 'left-0.5'}`}
              />
            </span>
            <span className="text-noctis-ink">{mode === 'translated' ? 'Tradução' : 'Original'}</span>
          </button>

          <div className="flex items-center gap-2 text-sm text-noctis-muted">
            <span>Tamanho da fonte</span>
            <button onClick={() => applyScale(Math.max(0.7, +(fontScale - 0.1).toFixed(2)))} className="px-1 text-xs">
              A
            </button>
            <input
              type="range"
              min={0.7}
              max={1.8}
              step={0.1}
              value={fontScale}
              onChange={(e) => applyScale(Number(e.target.value))}
              className="w-28 accent-noctis-accent"
            />
            <button onClick={() => applyScale(Math.min(1.8, +(fontScale + 0.1).toFixed(2)))} className="px-1 text-base">
              A
            </button>
          </div>

          {(loading || progress.total > 0) && (
            <div className="flex items-center gap-2 rounded-lg border border-noctis-border bg-noctis-card px-3 py-1.5 text-xs text-noctis-muted">
              <span className="h-2 w-2 animate-pulse rounded-full bg-noctis-accent" />
              {loading && progress.total === 0
                ? 'Traduzindo...'
                : `Traduzindo imagens: ${Math.min(progress.done, progress.total)}/${progress.total}`}
            </div>
          )}
        </div>
      </header>

      <div className="relative flex-1">
        {!currentUrl ? (
          <div className="flex h-full items-center justify-center text-noctis-muted">
            Cole uma URL acima para começar a traduzir.
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            onLoad={handleFrameLoad}
            className="h-full w-full border-0 bg-white"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            title="Página traduzida"
          />
        )}
      </div>
    </div>
  );
}

function ToolbarButton({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-noctis-ink hover:bg-noctis-card"
    >
      {icon}
    </button>
  );
}
