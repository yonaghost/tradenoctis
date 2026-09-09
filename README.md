# Noctis

Noctis traduz páginas da internet no seu idioma — incluindo o texto que está
**dentro das imagens** (mangás, prints, banners, infográficos, fotos).

Não é um navegador completo. É uma ferramenta de tradução que usa um
navegador mínimo apenas como meio de acesso à página. A prioridade do
projeto é a **qualidade da tradução**, com destaque para tradução de imagens
via OCR + reconstrução visual.

Este repositório contém dois produtos que compartilham a mesma arquitetura
conceitual (`OCRProvider` / `TranslationProvider` / cache por hash):

- **`web/`** — aplicação Next.js (site + tradutor web).
- **`android/`** — aplicativo Android (Kotlin + Jetpack Compose).

## Estrutura

```
tradenoctis/
├── web/       Site + tradutor web (Next.js/TypeScript)
├── android/   App Android (Kotlin/Compose)
├── docs/      Arquitetura, limitações conhecidas e privacidade
└── .github/workflows/   CI (build do site, build/APK do Android)
```

Leia primeiro:

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — como o pipeline de
  tradução (HTML e imagens) funciona de ponta a ponta.
- [`docs/LIMITATIONS.md`](docs/LIMITATIONS.md) — limitações técnicas reais e
  por que elas existem (nada de solução fictícia escondida).
- [`docs/PRIVACY.md`](docs/PRIVACY.md) — o que é enviado a serviços externos.

## Site / Tradutor Web (`web/`)

```bash
cd web
npm install
npm run dev     # http://localhost:3000
```

### Variáveis de ambiente (`web/.env.local`, nunca commitado)

| Variável | Obrigatória | Descrição |
|---|---|---|
| `TRANSLATION_PROVIDER` | não | `google-cloud` \| `libretranslate` \| `google-web` (padrão de demonstração, ver limitações) |
| `GOOGLE_TRANSLATE_API_KEY` | se usar `google-cloud` | Chave da Cloud Translation API v2 |
| `LIBRETRANSLATE_URL` | se usar `libretranslate` | URL da sua instância LibreTranslate |
| `LIBRETRANSLATE_API_KEY` | não | Chave opcional da instância |
| `NOCTIS_APK_URL` | não | URL do APK mais recente (padrão: última release do GitHub) |

Nenhuma chave real está no código-fonte — tudo é lido via `process.env`.

### Testes

```bash
npm run test        # testes unitários (lógica pura, sem rede)
npm run build        # build de produção / typecheck
```

## App Android (`android/`)

Build (requer Android SDK — validado via GitHub Actions neste ambiente, já
que este sandbox de desenvolvimento não tem o SDK instalado):

```bash
cd android
./gradlew assembleDebug
```

O app usa **ML Kit on-device** (Google) para OCR e tradução — processamento
local, sem chave de API, funciona offline após baixar os modelos de idioma
uma vez.

## CI/CD

- `.github/workflows/web-ci.yml`: lint, typecheck, testes e build do site a
  cada push/PR.
- `.github/workflows/android-ci.yml`: compila o app (`assembleDebug`), sobe
  o APK como artefato de build e, em push para `main`, publica/atualiza uma
  release `latest-android` no GitHub Releases com o APK real gerado pelo
  próprio CI (é esse APK que o botão "Baixar aplicativo" do site aponta).

## Licença

Este projeto é original — nenhuma identidade visual, nome ou código de
terceiros (ex.: Mangu Translate) foi copiado. Apenas o conceito funcional
(navegador + tradução de imagem) foi usado como referência.

<!-- ci-trigger-diagnostic -->
