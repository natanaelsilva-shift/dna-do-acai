# DNA do Acai

Estrutura inicial com Next.js, TypeScript, TailwindCSS e Supabase.

## Setup

1. Instale as dependencias:

```bash
npm install
```

2. Configure as variaveis de ambiente:

```bash
cp .env.example .env.local
```

Preencha no `.env.local` os valores do seu projeto Supabase:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sua-chave-publishable
```

3. Crie a tabela de pedidos no Supabase executando o SQL em:

```bash
supabase/orders.sql
```

4. Rode o projeto:

```bash
npm run dev
```
