# Assets definitivos — DNA do Açaí

O redesign está no ar com **assets provisórios**. Esta lista especifica o que
precisa ser produzido (sessão de fotos de produto ou geração de imagem/vídeo
com direção de arte) para a experiência ficar no nível de campanha.

Regras gerais:

- **Fotografia realista de alimento.** Nada de ilustração, emoji, cartoon ou
  vetor. Todas as fotos com a mesma luz, o mesmo copo e a mesma paleta.
- **Luz:** fundo escuro (#1A0A1F a #2A1230), luz principal roxa suave vinda
  de trás/cima, recorte de luz verde fraco na base. Condensação visível no
  copo (gotículas), sensação de gelado.
- **Copo:** o copo transparente real da loja, com o adesivo redondo da DNA.
- **Licença:** apenas material próprio ou com licença comercial comprovada.
  As imagens `public/images/Açai puro de 700.jpg` e `acai-puro-300.jpg`
  parecem vir de bancos de imagem e devem ser substituídas.
- **Entrega:** arquivo-mestre em alta (PNG 16 bits ou TIFF) + versões web
  geradas (o time de dev converte para AVIF/WebP).

Onde trocar no código:

| Uso | Arquivo de configuração |
|---|---|
| Hero (pôster + vídeo) | `src/data/experience.ts` → `heroAssets` |
| Ingredientes da montagem e do builder | `src/data/experience.ts` → `ingredientCues[].asset` |
| Fotos de produto, combos | `src/data/product-visuals.ts` → `cupImages` / `productVisuals` |

---

## 1. Hero

| Arquivo | Finalidade | Formato | Resolução | Fundo | Enquadramento / ângulo | Animação |
|---|---|---|---|---|---|---|
| `hero/cup-empty.webp` | Copo vazio que abre a montagem | PNG mestre → AVIF/WebP | 1440×2560 | Transparente | Copo inteiro centralizado, câmera na altura do copo, leve plongée (5–10°) | Entra subindo com blur → nítido |
| `hero/cup-final.webp` | Copo finalizado (pôster/LCP) | PNG mestre → AVIF/WebP (≤ 60 KB em 720 px) | 1440×2560 | Transparente | Mesmo ângulo e posição do copo vazio (troca sem salto) | Pôster até o vídeo carregar |
| `videos/hero-cup-loop.webm` + `.mp4` (HEVC com alpha p/ Safari) | Copo finalizado girando devagar | WebM VP9 com alpha + MP4 HEVC alpha | 720×1280, 24 fps, 6–8 s em loop perfeito, ≤ 1,5 MB | Transparente | Mesmo enquadramento do pôster | Primeiro quadro = pôster; sem marca d'água |
| `videos/acai-pour.webm` | Açaí entrando no copo | WebM VP9 alpha + MP4 HEVC alpha | 720×1280, 2–3 s, sem loop | Transparente | Mesmo enquadramento | Toca uma vez na intro |
| `videos/condensed-milk-drizzle.webm` | Fio de leite condensado atravessando | WebM VP9 alpha + MP4 HEVC alpha | 720×1280, 1,5–2 s | Transparente | Fio entra pelo alto, cai sobre o topo do copo | Toca uma vez, depois do último ingrediente |

## 2. Ingredientes (montagem + builder)

Mesma luz do hero. Cada peça isolada, como se estivesse caindo/suspensa.
`asset` em `ingredientCues` aceita `{ src, width, height }`.

| Arquivo | Finalidade | Formato | Resolução | Fundo | Enquadramento / ângulo | Animação |
|---|---|---|---|---|---|---|
| `ingredients/banana.webp` | Rodelas de banana | PNG → WebP | 800×800 | Transparente | 3–4 rodelas, vista 3/4 | Caem girando no copo |
| `ingredients/morango.webp` | Morango em pedaços + 1 inteiro | PNG → WebP | 800×800 | Transparente | 3/4, gotículas | Caem girando |
| `ingredients/leite-em-po.webp` | Montinho/nuvem de leite em pó | PNG → WebP | 800×800 | Transparente | Lateral | Complementa as partículas do canvas |
| `ingredients/granola.webp` | Punhado de granola | PNG → WebP | 800×800 | Transparente | 3/4 | Cai em grupo |
| `ingredients/pacoca.webp` | Paçoca esfarelada + pedaço | PNG → WebP | 800×800 | Transparente | 3/4 | Cai em grupo |
| `ingredients/leite-condensado.webp` | Fio/gota de leite condensado | PNG → WebP | 800×1200 | Transparente | Vertical | Escorre (ou usar o vídeo do item 1) |
| `ingredients/<id>-layer.webp` | Camada no copo do builder (opcional) | PNG → WebP | 1440×2560 | Transparente | **Exatamente** o enquadramento do `cup-final` | Sobreposta ao copo quando o complemento é marcado |

## 3. Produtos

| Arquivo | Finalidade | Formato | Resolução | Fundo | Enquadramento / ângulo | Observação |
|---|---|---|---|---|---|---|
| `acai/cup-300.webp` | DNA Explosão 300 ml | PNG → AVIF/WebP | 1200×1600 | Transparente | Frontal, copo inteiro, base no mesmo ponto | Escalas reais entre 300/500/700 |
| `acai/cup-500.webp` | DNA Supremo 500 ml | idem | 1200×1600 | Transparente | idem | |
| `acai/cup-700.webp` | Extra Supremo 700 ml | idem | 1200×1600 | Transparente | idem | |
| `acai/pure-300.webp` / `pure-500` / `pure-700` | Açaí puro | idem | 1200×1600 | Transparente | idem, com o swirl de açaí no topo | Substitui o recorte provisório |

## 4. Combos

| Arquivo | Finalidade | Formato | Resolução | Fundo | Enquadramento | Observação |
|---|---|---|---|---|---|---|
| `combos/<combo-id>.webp` | Foto do combo com 2 ou 3 copos | PNG → AVIF/WebP | 1600×1200 | Transparente | Copos lado a lado, o do meio à frente | Hoje a composição é montada no código com o mesmo copo repetido |

IDs: `combo-explosao-dna`, `combo-supremo-dna`, `combo-dna-gigante`,
`combo-triplo-explosao`, `combo-triplo-supremo`.

## 5. Batidinhas (quando forem cadastradas)

| Arquivo | Finalidade | Formato | Resolução | Fundo | Observação |
|---|---|---|---|---|---|
| `batidinhas/<id>.webp` | Batidinha 500 ml | PNG → AVIF/WebP | 1200×1600 | Transparente | Copo diferente do açaí (visualmente distinto); só após o produto existir no catálogo |

## 6. Fundos e texturas

| Arquivo | Finalidade | Formato | Resolução | Observação |
|---|---|---|---|---|
| `backgrounds/acai-macro.avif` | Macro de açaí (textura cremosa) para seções | AVIF | 2400×1600 (≤ 150 KB) | Opcional, para "Isso é DNA" / CTA final |
| `textures/condensation.webp` | Gotículas de condensação em vidro | WebP com alpha | 1200×1200 | Opcional, sobreposição sutil |

---

## Assets provisórios em uso

| Uso | Arquivo atual | Problema |
|---|---|---|
| Hero, builder, cards "brand" | `assets/dna/hero/cup-poster-*.{avif,webp}` (quadro do `videos/acai-hero.mp4`) | Fundo opaco (resolvido com máscara), marca d'água no canto do vídeo (escondida pela máscara) |
| Vídeo do hero | `videos/acai-hero.mp4` (2,1 MB) | Sem alpha, sem WebM |
| Açaí puro | `assets/dna/acai/pure-cup.webp` (recorte de `images/Açai puro de 700.jpg`) | Recorte automático; origem/licença a confirmar |
| — | `videos/Acai ringue.mp4` | **Não usado**: mostra marcas da UFC (risco de uso de marca de terceiros) |
