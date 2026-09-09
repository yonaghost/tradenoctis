# Arquitetura

## Visão geral

Noctis tem duas implementações independentes do mesmo conceito — "navegador
mínimo + tradução de HTML + tradução de imagens via OCR" — porque web e
Android têm mecanismos fundamentalmente diferentes disponíveis:

| | Web | Android |
|---|---|---|
| Como a página é carregada | reverse proxy próprio (`/api/proxy`) servida num `<iframe>` same-origin | `WebView` carregando a URL real diretamente |
| OCR | Tesseract.js, rodando no processo Node do servidor | Google ML Kit Text Recognition, on-device |
| Tradução | provider HTTP plugável (Google Cloud / LibreTranslate / fallback de demo) | Google ML Kit Translate, on-device |
| Cache | `Map` em memória por processo, por hash de conteúdo | Room (SQLite) + arquivos em cache dir, por hash de conteúdo |
| Comunicação JS ↔ backend | `fetch()` same-origin para `/api/translate` e `/api/ocr-translate` | `WebView.addJavascriptInterface` (bridge nativa) + `evaluateJavascript` |
| PDF | Playwright (Chromium headless) imprimindo a própria página do proxy | `WebView.createPrintDocumentAdapter` (framework de impressão do Android) |

Ambos compartilham o mesmo desenho conceitual de interfaces
(`TranslationProvider` / `OCRProvider`) e a mesma estratégia de cache por
hash de conteúdo, para que trocar de mecanismo no futuro não exija reescrever
o pipeline.

## Web (`web/`)

### Por que um proxy reverso?

Para traduzir o HTML de qualquer site mantendo links, rolagem e imagens
funcionando, a página precisa ser servida a partir da **nossa própria
origem** — assim o script de tradução injetado pode chamar
`fetch('/api/translate')` sem CORS, e o iframe pode ser lido/controlado pela
página React (`TranslatorApp`) porque tecnicamente é same-origin.

Fluxo:

1. `GET /api/proxy?url=&lang=&scale=` busca o HTML da página alvo
   (`src/lib/net/fetchGuarded.ts`, com proteção básica contra SSRF).
2. `src/lib/html/rewrite.ts` usa `cheerio` para: injetar uma tag `<base>`
   (assim toda URL relativa — imagens, CSS, JS, forms — continua resolvendo
   contra o site original sem precisarmos reescrever cada uma), reescrever
   `<a href>` para voltar a passar pelo proxy, remover metatags de CSP
   embutidas que bloqueariam nosso script, e injetar
   `public/noctis-inject.js`.
3. Esse script roda **dentro do iframe** (mesma origem que o Next.js, então
   `fetch` funciona), percorre os nós de texto do `document.body`
   (ignorando `<script>`, `<style>`, `<code>`, `contenteditable`, etc.),
   embrulha cada um em `<span class="noctis-text">`, e envia lotes para
   `/api/translate`.
4. Imagens são observadas com `IntersectionObserver` (prioriza o que está
   visível) e `MutationObserver` (pega imagens adicionadas depois —
   lazy-load, infinite scroll). Cada imagem entra numa fila com
   concorrência limitada e é enviada para `/api/ocr-translate`.

### Pipeline de imagem (`src/lib/image/pipeline.ts`)

```
baixar bytes -> normalizar (sharp) -> hash do conteúdo -> cache?
  -> OCR (Tesseract.js, via OCRProvider)
  -> agrupar palavras em linhas (lineGrouping.ts — horizontal ou vertical)
  -> para cada linha: amostrar cor de fundo e cor do texto (regionReconstruction.ts)
  -> reconstruir o fundo (gradiente a partir da amostra) -> cache "estágio OCR"
  -> traduzir cada linha (TranslationProvider, cacheado por texto+idiomas)
  -> compor o texto traduzido de volta na região (textCompositor.ts,
     encolhendo a fonte até caber) -> cache "composto final" (por escala de fonte)
```

Separar o cache em **estágios** (fundo limpo × traduções × composição final)
é o que permite o slider de tamanho de fonte recompor a imagem quase
instantaneamente sem rodar OCR ou tradução de novo.

### Providers plugáveis

- `src/lib/providers/translation/` — interface `TranslationProvider` +
  `GoogleCloudTranslationProvider`, `LibreTranslateProvider`,
  `GoogleWebDemoProvider` (fallback sem configuração — ver
  `LIMITATIONS.md`), todos decorados por `CachingTranslationProvider`.
- `src/lib/providers/ocr/` — interface `OCRProvider` +
  `TesseractOCRProvider` (com detecção de script via OSD do Tesseract e
  agrupamento de linhas próprio).

## Android (`android/`)

Kotlin + Jetpack Compose, um único `MainActivity` alternando entre três
telas (`HomeScreen`, `TranslatorScreen`, `SettingsScreen`) sem navegação
complexa — de propósito, já que o app não é um navegador completo.

`TranslatorScreen` hospeda um `WebView` puro (não um proxy): como o OCR e a
tradução rodam **no aparelho** via ML Kit, não existe o problema de CORS que
motivou o proxy no site — o script injetado fala com o Kotlin nativo através
de `window.NoctisBridge` (`browser/NoctisBridge.kt`), que expõe métodos
`@JavascriptInterface` e responde de forma assíncrona chamando
`webView.evaluateJavascript(...)` quando o ML Kit termina.

O pipeline de imagem (`image/ImagePipeline.kt`) espelha o do site
(reconstrução heurística de fundo + composição de texto ajustada à caixa),
mas usa `Bitmap`/`Canvas` do Android em vez de `@napi-rs/canvas`, e persiste
o cache em Room (`cache/`) em vez de um `Map` em memória — o que dá ao
Android uma vantagem real sobre o site: o cache sobrevive a reinícios do
app.

PDF usa `WebView.createPrintDocumentAdapter` + `PrintManager.print(...)`, o
mesmo mecanismo por trás do "Imprimir" do Android — paginação e altura da
página são resolvidas pelo próprio motor de renderização do sistema. Isso
abre a UI padrão de impressão do Android (onde "Salvar como PDF" é um dos
destinos), em vez de salvar silenciosamente como no site — ver
`docs/LIMITATIONS.md` para o porquê (a API do framework de impressão não
permite gerar o arquivo sem passar pela UI do sistema).
