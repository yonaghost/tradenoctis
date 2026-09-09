import { TranslatorApp } from '../../components/TranslatorApp';
import { DEFAULT_TARGET_LANG } from '../../lib/languages';

export default async function TranslatePage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string; lang?: string }>;
}) {
  const params = await searchParams;
  return <TranslatorApp initialUrl={params.url ?? ''} initialLang={params.lang ?? DEFAULT_TARGET_LANG} />;
}
