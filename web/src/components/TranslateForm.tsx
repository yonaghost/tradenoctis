'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LANGUAGES, DEFAULT_TARGET_LANG } from '../lib/languages';

function normalizeToUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[\w-]+(\.[\w-]+)+([/?#].*)?$/.test(trimmed)) return `https://${trimmed}`;
  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
}

export function TranslateForm({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [lang, setLang] = useState(DEFAULT_TARGET_LANG);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = normalizeToUrl(value);
    if (!url) return;
    router.push(`/translate?url=${encodeURIComponent(url)}&lang=${encodeURIComponent(lang)}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`flex w-full flex-col gap-3 sm:flex-row ${compact ? 'max-w-xl' : 'max-w-2xl'}`}
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Cole uma URL ou pesquise..."
        className="min-w-0 flex-1 rounded-lg border border-noctis-border bg-noctis-card px-4 py-3 text-noctis-ink placeholder:text-noctis-muted focus:border-noctis-accent focus:outline-none"
      />
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        className="rounded-lg border border-noctis-border bg-noctis-card px-3 py-3 text-noctis-ink focus:border-noctis-accent focus:outline-none"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="rounded-lg bg-noctis-accent px-6 py-3 font-semibold text-noctis-bg transition hover:bg-noctis-accentDark"
      >
        Traduzir →
      </button>
    </form>
  );
}
