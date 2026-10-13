# SECURITY-AUDIT — DNA do Açaí

Auditoria feita em 2026-10-13, durante o planejamento do redesign visual
(branch `redesign-immersive-acai`).

**Nenhum destes problemas foi corrigido no redesign.** Eles existiam antes e
serão tratados numa etapa dedicada de segurança. O redesign não altera banco,
RLS, rotas de API nem a lógica de pedidos.

Severidade: **Crítica** = exposição de dados pessoais ou impacto direto na
operação; **Alta** = fraude ou abuso simples de executar; **Média** = depende de
condições adicionais.

---

## 1. Painel admin sem autenticação — Crítica

- `src/app/admin/page.tsx` e `src/app/admin/pedidos/page.tsx` renderizam o
  `AdminDashboard` para qualquer visitante.
- Não existe `middleware.ts` / `proxy.ts` nem verificação de sessão no server
  component.
- O botão "Sair" (`AdminDashboard.tsx`, `logoutAdmin`) apenas chama
  `auth.signOut()` e redireciona para `/`; nunca houve login.
- Efeito: qualquer pessoa que acesse `/admin/pedidos` vê todos os pedidos,
  muda status, abre/fecha a loja e dispara reimpressões.
- Observação: as rotas `/api/printing/*` já exigem `auth.getUser()`, mas como
  não há tela de login, essas funções provavelmente retornam 401 no painel.

**Correção sugerida:** login com Supabase Auth (e-mail do operador), `proxy.ts`
protegendo `/admin/*` e `/api/orders*` (exceto `POST /api/orders`), e
verificação de sessão também dentro das rotas.

## 2. `GET /api/orders` público — Crítica

- `src/app/api/orders/route.ts` → `GET` retorna `select("*")` de `orders` sem
  autenticação.
- Expõe nome, telefone, endereço, bairro, itens, valores e observações de todos
  os clientes (dados pessoais — LGPD).

**Correção sugerida:** exigir sessão de admin; o cliente nunca precisa listar
pedidos.

## 3. RLS excessivamente permissivo — Crítica

Em `supabase/orders.sql`:

| Tabela | Policy | Papel | Regra | Risco |
|---|---|---|---|---|
| `orders` | `orders_public_select` | `anon` | `using (true)` | Leitura de todos os pedidos direto pela API REST do Supabase usando a chave pública que está no bundle do site |
| `orders` | `orders_public_update_status` | `anon` | `using (true)` | Qualquer um altera qualquer pedido |
| `orders` | `orders_public_insert` | `anon` | `with check (true)` | Insert sem validação de conteúdo (ver item 6) |
| `store_settings` | `store_settings_public_update` | `anon, authenticated` | `id = 'main'` | Qualquer um abre/fecha a loja |

Como `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` é pública por definição, essas
policies valem para qualquer pessoa na internet, **mesmo sem passar pelas rotas
do Next.js**.

Funções `security definer` com `grant execute ... to anon`:
`claim_order_print`, `complete_order_print`, `fail_order_print`,
`register_order_reprint` — permitem a um anônimo marcar pedidos como impressos
ou com falha.

**Correção sugerida:** `select`/`update` em `orders` e `update` em
`store_settings` apenas para `authenticated` com papel de admin; manter insert
anônimo apenas via rota do servidor (ou via função RPC que valida o pedido);
revogar `anon` das funções de impressão.

## 4. Possibilidade de alterar pedidos — Crítica

- `PATCH /api/orders/[id]` (`src/app/api/orders/[id]/route.ts`) sem
  autenticação aceita `status` **e `delivery_fee`**, recalculando `total`.
- Efeito: alterar status de pedidos de terceiros, cancelar pedidos, alterar a
  taxa de entrega e o total cobrado.
- `POST /api/orders/[id]/print` também sem autenticação (ações `claim`,
  `complete`, `fail`, `reprint`).

## 5. Possibilidade de fechar a loja — Alta

- `PATCH /api/store-status` sem autenticação + policy de update anônimo em
  `store_settings`.
- Um único request deixa a loja "fechada" e bloqueia todos os pedidos
  (`POST /api/orders` retorna 409).

## 6. Preço confiado pelo navegador — Alta

- O carrinho calcula `unitPrice` no cliente (`MenuCatalog`) e envia no payload.
- `normalizeItems` em `POST /api/orders` aceita qualquer `unitPrice` ≥ 0 e só
  recalcula `totalPrice = quantity × unitPrice` e o `subtotal`.
- Também não valida: `productId` existente, produto ativo, complementos
  existentes, limite de complementos por tamanho, preço dos extras pagos.
- Efeito: pedido de R$ 0,01 com comanda impressa normalmente.

## 7. Validação de preço necessária no servidor — Alta

O servidor deve recalcular o pedido a partir do catálogo, nunca do payload:

1. Resolver cada `productId` no catálogo do servidor (`src/data/menu.ts` hoje;
   tabela do Supabase no futuro).
2. Recalcular o preço base + extras pagos a partir dos IDs de complementos.
3. Validar limites (`complementLimit`, `maxSelections`, grupos obrigatórios,
   copos de combo).
4. Rejeitar o pedido se o total recebido divergir do recalculado.

Pré-requisito: o payload precisa carregar IDs de opções (hoje carrega apenas
nomes formatados em `customization`). Isso altera o contrato do pedido e por
isso **não** foi feito no redesign.

## 8. Itens adicionais (Média)

- **Catálogo do admin só em `localStorage`**: edições de produto/preço feitas no
  painel não chegam aos clientes (não é falha de segurança, mas é risco
  operacional — o operador pode achar que mudou o preço e não mudou).
- **`POST /api/qz/sign`**: assina qualquer payload QZ; a checagem de origem
  aceita requests **sem** header `Origin` (ex.: `curl`). Permite usar a chave
  privada QZ da loja para assinar comandos arbitrários.
- **Mensagens de erro do banco** (`error.message`) retornadas ao cliente nas
  rotas de API.
- **Sem rate limiting** em `POST /api/orders` (spam de pedidos → spam de
  comandas impressas).
- **Dependências em `"latest"`** no `package.json`: um `npm install` sem lock
  pode trazer versões maiores sem revisão.

---

## Ordem sugerida para a etapa de segurança

1. Autenticação do admin + proteção de `/admin` e das rotas administrativas.
2. Endurecer RLS (`orders`, `store_settings`) e revogar `anon` das RPCs de
   impressão.
3. Validação/recálculo de preço no servidor.
4. Rate limiting no `POST /api/orders` e `qz/sign` exigindo sessão.
5. Fixar versões de dependências.
