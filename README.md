This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Configuração do Supabase

Este projeto depende do Supabase para banco de dados, autenticação e storage.

1.  **Variáveis de Ambiente**: Renomeie `.env.local.example` (ou crie um novo `.env.local`) e preencha as chaves:
    ```bash
    NEXT_PUBLIC_SUPABASE_URL=sua-url-do-supabase
    NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon
    ```

2.  **Banco de Dados**: Vá ao **SQL Editor** do seu projeto no Supabase e execute o conteúdo do arquivo `db/setup_completo.sql`. Ele criará todas as tabelas, triggers, políticas de segurança (RLS) e buckets de storage necessários.

3.  **Migrações**: Em seguida, execute os arquivos de `db/migrations/` na ordem descrita em `CLAUDE.md` (seção "Migrações"). Elas protegem os dados pessoais e criam as funções (RPC) usadas no painel, no chat e no admin.

4.  **Administrador**: Para acessar `/admin`, marque seu usuário como admin no SQL Editor:
    ```sql
    UPDATE usuarios SET is_admin = true WHERE email = 'seu-email';
    ```

5.  **Dados de Teste**: Se desejar popular o banco com dados de exemplo, use `db/seed/carga_fria.sql` após as migrações (ver "Carga fria" no `CLAUDE.md`).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `src/pages/index.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
