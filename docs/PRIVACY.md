# Privacidade

Noctis não tem contas, login ou perfil — não há dado pessoal identificável
armazenado pelo produto em si. Este documento lista, por plataforma, o que é
enviado a serviços de terceiros e por quê.

## Site

| Dado | Enviado para | Quando | Por quê |
|---|---|---|---|
| URL da página que o usuário quer traduzir | o site de destino (via nosso servidor, como um proxy) | ao clicar "Traduzir" | precisamos buscar o HTML da página |
| Textos extraídos do HTML/imagens da página | o provider de tradução configurado (`GOOGLE_TRANSLATE_API_KEY` / `LIBRETRANSLATE_URL`, ou o fallback de demonstração — ver `LIMITATIONS.md`) | a cada trecho de texto novo (com cache por hash para não reenviar o mesmo texto duas vezes) | é o provider que faz a tradução em si |
| Bytes das imagens da página | **ninguém além do próprio servidor Noctis** — o OCR (Tesseract.js) roda no processo Node do servidor, não em um serviço externo | ao processar uma imagem | reconhecer o texto antes de traduzir |

O servidor não grava HTML, textos ou imagens em disco além do cache
temporário em memória do processo (que existe só para acelerar repetições
na mesma sessão de servidor — ver limitações sobre isso). Nada é retido
propositalmente após a tradução.

## Android

| Dado | Enviado para | Quando |
|---|---|---|
| Texto da página / das imagens | **ninguém, por padrão** — OCR (ML Kit Text Recognition) e tradução (ML Kit Translate) rodam inteiramente no aparelho | nunca sai do dispositivo |
| Bytes das imagens da página | o próprio dispositivo baixa a imagem do site de origem (necessário para exibi-la de qualquer forma) | ao carregar a página |
| Modelos de tradução (~30MB por idioma) | baixados da infraestrutura do Google (Play Services / ML Kit) na primeira vez que um par de idiomas é usado | uma vez, depois ficam em cache no aparelho |

O app grava em disco (cache local do app, não acessível a outros apps): o
banco Room com resultados de OCR/tradução por hash de conteúdo, e as
imagens já processadas — tudo apagável pelo botão "Limpar cache" nas
Configurações.

## O que o Noctis nunca faz

- Não cria conta, não pede login, não tem "perfil".
- Não envia URLs navegadas para um servidor de analytics do Noctis (não
  existe tal servidor neste projeto).
- Não injeta rastreadores de terceiros nas páginas traduzidas.
- Não modifica ou intercepta tráfego HTTPS além de buscar e reescrever o
  HTML da própria página que o usuário pediu para traduzir.
