# Modo Leitura Fácil

Extensão de navegador (Manifest V3) que adapta qualquer página web para pessoas com dislexia, TDAH ou deficiência cognitiva. Projeto final da disciplina de Tecnologias Assistivas (opção: Interface Adaptativa / Motor de Assistência Integrado).

## Funcionalidades

| Recurso | O que faz | Critério WCAG relacionado |
|---|---|---|
| Modo foco | Esconde menus, anúncios e barras laterais, mantendo só o conteúdo principal | 2.2.2, 2.4.1 |
| Ajuste de texto | Tamanho, espaço entre linhas, letras e palavras, e fonte legível/dislexia | 1.4.4, 1.4.12 |
| Temas de contraste | Modo escuro, alto contraste e fundo suave | 1.4.3, 1.4.6 |
| Leitura em voz alta | Lê a página (ou a seleção) com `speechSynthesis`, narrando imagens pelo atributo `alt` (imagens sem `alt` são avisadas; `alt=""` é tratado como decorativo). A imagem lida ganha contorno amarelo e uma legenda na tela com o texto alternativo | 1.1.1, 1.4.5 |
| Régua de leitura | Destaca a linha sob o mouse ou o foco do teclado | 1.4.8 |

O popup é totalmente navegável por teclado (Tab, Espaço e setas) e compatível com leitores de tela (rótulos associados, `aria-live` para mensagens de status). O atalho **Alt+Shift+L** abre o painel sem mouse.

## Acessibilidade da própria extensão

- **Leitor de tela:** `lang="pt-BR"`, landmark `<main>`, `<h1>`, todos os campos com `<label for>`, grupos em `<fieldset>/<legend>`, `aria-valuetext` nos controles deslizantes (fala "120%"), região `aria-live="polite"` que anuncia cada mudança ("Modo foco ativado"). Elementos puramente visuais (régua e legenda da imagem) usam `aria-hidden="true"`.
- **Teclado:** painel abre com Alt+Shift+L; Tab/Shift+Tab, Espaço e setas operam tudo; foco sempre visível; **Esc** interrompe a leitura em voz alta; a régua acompanha o foco do teclado.
- **Contraste:** painel com 16:1 (texto) e 6,4:1 (botão); temas com 16:1 (escuro), 19,6:1 (alto contraste) e 12,8:1 (suave), acima do mínimo AA (4,5:1) e AAA (7:1).
- **Movimento:** respeita `prefers-reduced-motion`.

## Instalação (modo desenvolvedor)

1. Abra `chrome://extensions` (ou `edge://extensions`).
2. Ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e escolha a pasta `modo-leitura-facil`.
4. Fixe a extensão na barra e abra uma página qualquer.

Para testar com a página de exemplo, rode na pasta do projeto:

```bash
python -m http.server 8000
# abra http://localhost:8000/teste/
```

## Estrutura

```
manifest.json   configuração da extensão (MV3, permissão: storage)
popup.html/css/js   painel de controle (grava as opções em chrome.storage.sync)
content.js/css      aplica as adaptações na página e executa a leitura em voz alta
icons/              ícones da extensão
teste/index.html    página de teste "antes e depois" (com imagem e texto alternativo)
teste/leitura.svg   imagem de exemplo
```

## API de configurações (`chrome.storage.sync`)

| Chave | Tipo | Padrão | Valores |
|---|---|---|---|
| `focus` | boolean | `false` | ativa o modo foco |
| `textAdjust` | boolean | `false` | ativa os ajustes de texto |
| `font` | string | `"default"` | `default`, `legivel`, `dislexia` |
| `fontSize` | number | `120` | 100 a 200 (%) |
| `lineHeight` | number | `1.8` | 1.2 a 2.5 |
| `letterSpacing` | number | `0.05` | 0 a 0.3 (em) |
| `wordSpacing` | number | `0.1` | 0 a 0.5 (em) |
| `theme` | string | `"default"` | `default`, `escuro`, `contraste`, `suave` |
| `ruler` | boolean | `false` | ativa a régua |
| `speechRate` | number | `1` | 0.5 a 2 |

Mensagens aceitas pelo content script (`chrome.tabs.sendMessage`): `{type: "speak"}`, `{type: "stop"}`, `{type: "status"}`.

## Casos de uso

- **Dislexia:** fonte legível, mais espaçamento e régua de leitura.
- **TDAH:** modo foco para eliminar distrações.
- **Baixa visão ou fadiga visual:** alto contraste, texto maior e leitura em voz alta.

## Limitações conhecidas

- O modo foco usa uma heurística; em alguns sites pode não achar o texto principal.
- Fontes OpenDyslexic e Atkinson Hyperlegible só são usadas se estiverem instaladas no computador (há fontes de reserva).
- Não funciona em páginas internas do navegador (`chrome://`).
