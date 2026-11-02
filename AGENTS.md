<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Circular — guia para agentes

Marketplace universitário (Next.js Page Router, TypeScript, Tailwind, Supabase). Antes de mudar código, leia:

- `CLAUDE.md` — fonte principal: estrutura, schema, RPCs, segurança, migrações e regras de desenvolvimento
- `negocio.mdc` — resumo das regras de negócio
- `DESIGN_SYSTEM.md` — obrigatório antes de qualquer mudança de interface

## Skills do projeto

As versões ficam em `skills-lock.json`; os arquivos não vão para o Git (`.agents/` e `.claude/skills/` no `.gitignore`).
Para instalar numa máquina nova:

```bash
npx skills experimental_install -y      # baixa para .agents/skills/
cp -r .agents/skills/* .claude/skills/  # o Claude Code lê de .claude/skills/
```

| Skill | Quando usar |
|---|---|
| `supabase`, `supabase-postgres-best-practices` | Migrações, RLS, RPCs, índices, cron |
| `vercel-react-best-practices` | Componentes e páginas React/Next |
| `web-design-guidelines` | Revisão de interface e acessibilidade |
| `agent-browser` | Abrir o site e conferir telas |
| `find-skills` | Procurar outras skills |

## Comandos

- Testes: `node --test src/lib/__tests__/*.test.ts` (no Windows, `npm test` não acha os arquivos)
- Tipos: `npx tsc --noEmit -p .` · Lint: `npx eslint <arquivos>`
- Não rodar prettier (o projeto não tem config; reformataria arquivos inteiros)

## Fluxo de trabalho

- Não instalar dependências sem perguntar
- Mudança de schema: arquivo novo numerado em `db/migrations/`; testar numa transação desfeita
  (simulando o aluno com `set_config('request.jwt.claims', …)`) antes de aplicar; depois rodar os advisors do Supabase
- Coluna nova que o cliente lê ou grava precisa de `GRANT` de coluna na migração (grants mínimos, migração 18)
- Push na `main` publica na Vercel (produção: circular.eokinha.com.br); só subir com o ok do responsável
- Nunca commitar segredos (`.env*`, chaves da Vettly, `MODERACAO_SEGREDO`, senhas de teste)
