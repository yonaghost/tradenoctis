# Limitações conhecidas

Este documento existe para não esconder debaixo do tapete nada que a IA que
construiu este projeto não conseguiu resolver de verdade. Cada item abaixo é
uma limitação técnica real, não um bug escondido.

## Tradução de texto

- **`GoogleWebDemoProvider` (provider padrão sem configuração)** usa o
  endpoint gratuito e não-oficial por trás de translate.google.com. Ele
  funciona (foi testado nesta sandbox), mas **não é uma API oficial,
  documentada ou estável** — pode ser bloqueada, alterada ou limitada por IP
  a qualquer momento pelo Google. Existe só para que um clone recém-baixado
  já traduza algo, sem exigir configuração. **Produção deve usar
  `TRANSLATION_PROVIDER=google-cloud` (Cloud Translation API, paga, oficial)
  ou `libretranslate` (self-hosted).**
- No Android, o ML Kit Translate tem **um único modelo "Chinês"**, sem
  distinguir simplificado/tradicional como o site faz (que usa `chi_sim` e
  `chi_tra` separados no Tesseract).
- O ML Kit não tem modo "auto-detect" embutido para tradução; o app roda o
  modelo separado de Language Identification primeiro. Isso é uma chamada a
  mais e pode falhar silenciosamente em textos muito curtos/ambíguos — nesse
  caso o texto original é mantido (nunca quebra a página).

## Tradução de imagens / OCR

- **Reconstrução de fundo é heurística, não inpainting generativo.** O
  pipeline (web e Android) amostra a cor ao redor da caixa de texto e pinta
  um gradiente por cima — funciona bem para balões de fala, banners e fundos
  lisos/levemente sombreados. Em fundos fotográficos complexos (uma foto com
  texto sobre uma textura detalhada), a região aparece "suavizada", não
  perfeitamente reconstruída. Um modelo de inpainting real (ex. LaMa) exigiria
  peso de modelo e GPU que não fazem parte deste MVP; a interface
  (`reconstructBackground`) foi isolada de propósito para permitir trocar a
  implementação depois sem mexer no resto do pipeline.
- **Texto traduzido é sempre desenhado na horizontal**, mesmo quando o
  original era vertical (mangá japonês, por exemplo). Isso é intencional:
  português/inglês/espanhol não são lidos de cima para baixo, então forçar
  layout vertical no idioma de destino prejudicaria a leitura. A orientação
  vertical detectada é usada apenas para agrupar corretamente o texto
  *original* antes de traduzir.
- **OCR vertical em CJK é mais forte no site do que no Android.** O
  Tesseract.js (site) tenta explicitamente os pacotes `_vert` (`jpn_vert`,
  `chi_sim_vert`, `chi_tra_vert`) e compara a confiança contra a versão
  horizontal. O ML Kit (Android) não expõe esse controle na API pública —
  ele lida razoavelmente bem com blocos de texto verticais simples, mas não
  há o mesmo mecanismo de comparação/otimização explícito.
- **O ML Kit não expõe confiança por palavra/linha** (diferente do
  Tesseract). O provider Android usa a contagem total de caracteres
  reconhecidos como um substituto heurístico para decidir qual "recognizer"
  (latim, chinês, japonês, coreano, devanagari) foi o melhor — é mais
  grosseiro que a métrica de confiança real usada no site.
- Tesseract.js precisa baixar os dados de idioma (`.traineddata`) na
  primeira vez que um idioma/script é usado (depois fica em cache em disco).
  Em ambientes com rede muito restrita, configure `TESSDATA_URL` para um
  espelho acessível (neste ambiente de desenvolvimento, por exemplo, o CDN
  padrão estava bloqueado, mas
  `https://raw.githubusercontent.com/naptha/tessdata/gh-pages/4.0.0_fast`
  funcionou nos testes).
- GIFs são tratados como imagem estática (primeiro frame) — não há tradução
  quadro a quadro de GIFs animados.

## Proxy / navegador web

- Formulários (`<form>`) **não** passam pelo proxy — eles são resolvidos
  contra o site original via `<base>`, então enviar um formulário tira o
  usuário do tradutor. Rewrite completo de `action` exigiria replicar
  método/encoding/CSRF do site original, fora do escopo deste MVP.
- O guard de SSRF (`assertPublicHttpUrl`) bloqueia literais óbvios
  (`localhost`, `127.0.0.1`, faixas privadas) mas **não resolve DNS** para
  pegar um hostname público que aponte para um IP interno (DNS rebinding).
  É defesa em profundidade, não uma sandbox completa.
- O iframe usa `sandbox="allow-scripts allow-same-origin ..."` — combinar
  essas duas flags é necessário para o script injetado funcionar (ele
  precisa rodar JS E fazer fetch same-origin para `/api/translate`), mas
  isso também significa que o JavaScript do **site proxied** roda com
  privilégio same-origin em relação ao domínio do Noctis. Como o Noctis não
  tem login, cookies de sessão ou dados de conta, o que esse script
  conseguiria acessar é limitado — mas isso é uma troca deliberada, não uma
  omissão, e uma futura área autenticada deveria rodar em subdomínio
  separado do proxy.
- O cache (tradução, OCR, imagens) vive em memória do processo Node. Em
  deploy serverless (onde cada requisição pode cair numa instância
  diferente), o cache efetivamente não persiste entre requisições — o
  pipeline continua funcionando, só sem o ganho de velocidade. Documentado
  em `web/src/lib/cache/memoryCache.ts`.

## PDF

- O export de PDF no site depende de um binário Chromium acessível ao
  processo Node (via Playwright). Em plataformas serverless de verdade
  (Vercel, AWS Lambda) não dá pra simplesmente `npx playwright install`
  — o sistema de arquivos é somente-leitura e cada requisição pode cair
  numa instância nova. Isso apareceu na prática: o primeiro deploy na
  Vercel falhou com `Executable does not exist at
  .../chromium_headless_shell.../chrome-headless-shell`.
- **Correção aplicada**: `src/lib/pdf/renderPdf.ts` agora tenta, nesta
  ordem: (1) `PLAYWRIGHT_CHROMIUM_PATH` explícito, (2)
  [`@sparticuz/chromium`](https://github.com/Sparticuz/chromium) — um
  build de Chromium empacotado especificamente para ambientes serverless
  (o mesmo binário compactado é extraído para `/tmp` na primeira
  requisição), (3) a resolução padrão do Playwright. `@sparticuz/chromium`
  é a solução padrão e amplamente usada pra esse exato erro — não foi
  inventada aqui — e foi testada nesta sessão com sucesso (gerou um PDF
  válido de 2 páginas neste sandbox, sem precisar de
  `PLAYWRIGHT_CHROMIUM_PATH`). O que não foi possível verificar aqui é o
  comportamento na própria Vercel (esta sessão não tem acesso a ela) —
  se depois do deploy o botão "Baixar PDF" ainda falhar, o próximo passo é
  checar os logs da function no painel da Vercel.
- Detalhe real encontrado à parte: builds recentes do Chrome removeram o
  "Old Headless mode"; se o binário Chromium disponível for de uma geração
  muito diferente da que o `playwright-core` instalado espera, o
  lançamento do browser falha com `Target page, context or browser has
  been closed` — a correção é manter `playwright-core` numa versão
  compatível com o binário disponível.

## Fetch da página alvo (bot-detection)

- `fetchGuarded` (usado pelo `/api/proxy` e pela busca de imagens) envia um
  `User-Agent` de navegador comum (Chrome/Windows) e `Accept-Language`
  `pt-BR`, exatamente como qualquer ferramenta de tradução de página faz.
  Isso evita bloqueios triviais por User-Agent (alguns sites devolviam 404
  quando o User-Agent se identificava como bot). **Isso não contorna
  proteção anti-bot de verdade** — Cloudflare/Akamai com desafio de
  JavaScript, fingerprinting de TLS, CAPTCHAs — nenhuma quantidade de
  cabeçalho HTTP resolve isso sem executar um browser completo do lado do
  servidor (o que o proxy do site, por design, não faz — só o `/api/pdf`
  roda um Chromium real). Sites fortemente protegidos contra scraping
  podem continuar retornando uma página de bloqueio em vez do conteúdo
  real.

## PDF (Android)

- `PrintDocumentAdapter.LayoutResultCallback`/`WriteResultCallback` têm
  construtor package-private em `android.print` — apps não conseguem
  instanciá-los. Isso significa que não existe API pública para dirigir o
  `PrintDocumentAdapter` de uma WebView e gravar um PDF em disco de forma
  totalmente silenciosa; o caminho suportado é `PrintManager.print(...)`,
  que abre a UI padrão de impressão do Android (com "Salvar como PDF" como
  um dos destinos). O botão "Baixar PDF" do app abre essa UI em vez de
  salvar direto, diferente do comportamento silencioso do site.

## Ambiente de desenvolvimento desta sessão

- O sandbox usado para construir este projeto **não tem o Android SDK
  instalado** e o Maven do Google (`dl.google.com`) estava bloqueado pela
  política de rede do ambiente — então o app Android não pôde ser
  compilado localmente aqui. Ele foi revisado manualmente com cuidado, mas
  a validação real de compilação/lint/testes acontece no
  `.github/workflows/android-ci.yml` a cada push. Verifique o resultado do
  CI antes de considerar o app pronto para uso.
- O site, por outro lado, foi validado de ponta a ponta nesta sessão:
  `npm run lint`, `npm run typecheck`, `npm run build` e os 35 testes
  unitários (`npm run test`) passaram, e o pipeline de OCR real
  (Tesseract.js) foi testado manualmente contra uma imagem sintética,
  reconhecendo o texto corretamente.
- Duas dependências continuam com avisos de `npm audit` mesmo após as
  atualizações feitas nesta sessão (Next.js 14→15.5.25, sharp 0.33→0.35.4):
  um problema moderado remanescente no Next 15.x só é resolvido pulando
  para o Next 16 (major muito recente, não testado aqui por prudência), e a
  cadeia de dependências do `vitest` (uma ferramenta *apenas* de
  desenvolvimento, não vai para produção) tem avisos que só uma major nova
  do vitest resolveria. Rode `npm audit` periodicamente e avalie a
  atualização conforme a maturidade dessas versões.

## Idiomas

A lista de idiomas na interface (`languages.ts` / `Languages.kt`) é apenas
para popular o seletor — não limita o que os providers conseguem traduzir.
Cobertura real depende do provider escolhido: Google Cloud Translation
cobre bem mais de 100 idiomas; LibreTranslate depende de quais modelos sua
instância tem instalados; ML Kit no Android tem uma lista fixa de idiomas
com modelo on-device disponível.
