# Relatório do site com base nas skills do projeto

Data: 02/11/2026 · Base: `main` em `fd48efa` · Produção: https://circular.eokinha.com.br

## Skills instaladas (`skills-lock.json`)

| Skill | Origem | Uso neste relatório |
|---|---|---|
| `supabase` | supabase/agent-skills | Checklist de segurança (Auth, RLS, `SECURITY DEFINER`, chaves) + advisors do projeto |
| `supabase-postgres-best-practices` | supabase/agent-skills | Índices, políticas RLS, volume das tabelas |
| `web-design-guidelines` | vercel-labs/agent-skills | Acessibilidade, formulários, animação, tipografia, SEO básico (regras de `web-interface-guidelines/command.md`) |
| `vercel-react-best-practices` | vercel-labs/agent-skills | Performance de React/Next — ver **`docs/plano-otimizacao-next.md`** |
| `agent-browser` | vercel-labs/agent-browser | Não usada: o CLI `agent-browser` não está instalado (instalar seria dependência nova). As páginas públicas foram vistas com o Edge headless |
| `find-skills` | vercel-labs/skills | Só serve para descobrir skills; não se aplica |

As pastas das skills (`.claude/skills/`, `.agents/`) estão no `.gitignore`; só o `skills-lock.json` é versionado.

## Status geral

O site está **sólido na segurança de dados**: RLS em todas as tabelas, grants mínimos por coluna, gravação sensível só por RPC,
CSP e headers de segurança, chave publicável no cliente (nenhuma `service_role` exposta). A UI segue o design system
(tokens, foco visível com `focus-visible` quase em todo lugar, confirmações dentro do site).

Os problemas encontrados são, em ordem: **um texto da home que contradiz o produto**, **acessibilidade de formulários e do
carrossel**, **ajustes de configuração no Supabase Auth** e **higiene de permissões/índices** que ainda não pesam com o volume
atual (8 usuários, 180 anúncios), mas que é barato resolver agora.

## Problemas encontrados

### Prioridade alta

| # | Problema | Onde | Por que importa | Correção |
|---|---|---|---|---|
| 1 | Home diz "O contato é pelo WhatsApp, direto com o colega" | `src/pages/index.tsx:79` | Desde a migração 26 o contato principal é o chat e o WhatsApp é opcional (FAQ e Termos já dizem isso). Primeira impressão do visitante contradiz o produto | Trocar para algo como "Vocês conversam pelo chat do Circular, sem expor o telefone" |
| 2 | `<html>` sem `lang` | não existe `src/pages/_document.tsx` (HTML de produção: `<html>`) | Leitor de tela lê o português com pronúncia de inglês; o Chrome oferece "traduzir esta página"; buscadores não sabem o idioma | Criar `_document.tsx` com `<Html lang="pt-BR">` |
| 3 | Rótulos não associados aos campos | `login.tsx:226,240` · `cadastro.tsx:193,204,257` · `esqueci-senha.tsx:72` · `redefinir-senha.tsx:101,116` | Sem `htmlFor`/`id`, o campo fica sem nome acessível (WCAG 1.3.1/4.1.2) e clicar no rótulo não foca o campo. São as telas de entrada do funil | `id` no input + `htmlFor` no label (padrão já usado em `onboarding.tsx` e no e-mail do cadastro) |
| 4 | Carrossel do hero troca a cada 6 s sem pausa e anuncia cada troca | `src/components/HeroSection.tsx:62` (timer) e `:236` (`aria-live="polite"`) | Movimento automático sem botão de pausa (WCAG 2.2.2); ignora `prefers-reduced-motion`; leitor de tela é interrompido a cada 6 s | Pausar no hover/foco e com `prefers-reduced-motion`; botão Pausar; tirar o `aria-live` da área que roda sozinha (deixar só quando o aluno troca o slide) |

### Segurança (skill `supabase` + advisors)

| # | Achado | Nível | Análise | Recomendação |
|---|---|---|---|---|
| 5 | **Proteção contra senha vazada desligada** no Supabase Auth | WARN | O app checa HIBP no navegador (`src/lib/senha-vazada.ts`), mas quem cadastra direto pela API do Auth não passa por essa checagem | Ligar em Authentication → Providers → Email (segundo a documentação, recurso do plano Pro em diante — conferir o plano) |
| 6 | `anon` executa 5 funções `SECURITY DEFINER` | WARN | `resumo_loja_compartilhada` e `resumo_anuncio_compartilhado` são públicas de propósito (QR code). `definir_nome_publico_loja` e `sincronizar_nome_loja` são funções de gatilho (não dá para chamar como RPC), mas o `EXECUTE` sobrou. `usuario_publico(id)` deixa o visitante descobrir se um id de aluno tem anúncio ativo | Migração: `REVOKE EXECUTE … FROM anon, authenticated` nas duas de gatilho; revogar `usuario_publico` de `anon` (conferir antes que nenhuma política `TO anon` a usa — hoje `anon` não lê `usuarios`) |
| 7 | 54 funções `SECURITY DEFINER` executáveis por `authenticated` | WARN | Esperado: a arquitetura é "tudo por RPC" e cada função confere `auth.uid()`/`is_admin()` por dentro. Mas os **helpers de política** (`campus_da_loja`, `campus_do_usuario`, `campus_do_produto`, `loja_tem_contato`, `participa_da_conversa`, `pode_usar_topico_realtime`) também viraram endpoints: `campus_do_usuario(id)` permite listar o campus de qualquer aluno por id | A skill recomenda tirar `SECURITY DEFINER` que não é API do schema exposto: mover os helpers para o schema `privado` (fora da API) e ajustar as políticas. Fazer com teste das políticas, em migração própria |
| 8 | Cadastro pela API sem aceitar os Termos cria a conta | — | `handle_new_user` grava `termos_aceitos_em` só quando `termos_aceitos = 'true'` nos metadados; sem isso a conta nasce com `NULL` e nada cobra o aceite depois | Recusar o signup sem aceite (como já faz com domínio) ou pedir o aceite no onboarding quando `termos_aceitos_em` for nulo |
| 9 | 7 tabelas com RLS ligado e nenhuma política | INFO | Intencional: `avaliacoes`, `conversas`, `denuncias`, `interesses`, `mensagens`, `moderacoes_conta`, `perguntas` são acessadas só por RPC. Nada a fazer | Manter; já documentado no `CLAUDE.md` ("só via RPC") |

Itens da checklist da skill que **passaram**: `user_metadata` só é usado para nome/sobrenome no signup (nunca para autorizar);
não há views em `public`/`privado` (logo, nenhuma burla de RLS por view); `auth.role()` não aparece; cliente usa chave publicável; middleware usa `getUser()`
(valida o token no servidor); `aplicar_moderacao` é protegida por segredo com hash no banco.

### Banco (skill `supabase-postgres-best-practices` + advisors de performance)

| # | Achado | Análise | Recomendação |
|---|---|---|---|
| 10 | 15 chaves estrangeiras sem índice | As que entram no caminho quente: `produtos.loja_id` (perfil, painel, catálogo), `produtos.categoria_id` (filtro da listagem), `favoritos.produto_id`, `conversas.loja_id`, `interesses.produto_id`. Com 180 anúncios não pesa; com alguns campi vai pesar, e apagar loja/produto faz varredura nas tabelas filhas | Uma migração com `CREATE INDEX` nessas 5 (e nas de `denuncias` se a fila crescer) |
| 11 | Várias políticas permissivas na mesma ação (`lojas`, `produtos`, `usuarios`) | Cada política roda em toda consulta; ex.: `produtos` SELECT avalia `admin_manage`, `owner_manage` e `select_campus` | Juntar em uma política por ação com `OR`. Ganho pequeno hoje; fazer junto da migração dos helpers (#7) |
| 12 | 6 índices nunca usados (`idx_lojas_slug`, `conversas_ultima_idx` …) | O site tem pouco tráfego; "não usado" ainda não é sinal confiável | Não apagar agora; reavaliar com 1–2 meses de uso |

### Interface (skill `web-design-guidelines`)

| # | Achado | Onde |
|---|---|---|
| 13 | `"..."` em vez de `"…"` em 17 textos de carregamento e placeholders | `cadastro.tsx:297`, `login.tsx:210,261`, `esqueci-senha.tsx:88`, `redefinir-senha.tsx:133`, `confirmar-email.tsx:81`, `onboarding.tsx:141`, `ConfiraEmail.tsx:119`, `PainelEstudante.tsx:176`, `SecaoPerfil.tsx:376,403,504,549,634,673`, `anunciar.tsx:497`, `admin/lojas.tsx:248` |
| 14 | Sem link "Pular para o conteúdo" | `src/pages/_app.tsx` (o `<main>` existe; falta o link e um `id`) |
| 15 | Home sem `meta description` nem `og:*` (só `<title>`); `sitemap.xml` dá 404 | `src/pages/index.tsx`; o catálogo exige login, então o que importa indexar é home, `/ajuda`, `/termos`, `/privacidade` |
| 16 | "Esqueceu a senha?" em `text-xs`, alvo de toque menor que 44 px | `src/pages/login.tsx` (link acima do campo de senha) |
| 17 | Campos sem `autoComplete`/`spellCheck`: nome e sobrenome (`given-name`/`family-name`), e-mail do cadastro e do "esqueci a senha" (`email`, `spellCheck={false}`) | `cadastro.tsx`, `esqueci-senha.tsx` |
| 18 | `transition-all` | `src/components/HeroSection.tsx` (listar as propriedades) |
| 19 | 23 `<img>` sem `width`/`height` (risco de layout pular) e nenhum `next/image` | detalhado no plano de otimização |

Passaram: botões só de ícone com `aria-label`, nenhum `<div onClick>`, foco visível nos links "esticados" dos cards
(`has-[a:focus-visible]`), sem `user-scalable=no`, sem bloquear colar, ações destrutivas com confirmação.

## Melhorias sugeridas (ordem de execução)

1. **Um PR rápido de conteúdo e acessibilidade** (itens 1, 2, 3, 13, 14, 16, 17, 18): só front-end, baixo risco.
2. **Carrossel do hero** (item 4): pausa, `prefers-reduced-motion` e `aria-live` só na troca manual.
3. **Painel do Supabase**: ligar a proteção de senha vazada (item 5).
4. **Migração 29 — higiene de permissões e índices** (itens 6, 8, 10): revogar `EXECUTE` sobrando, exigir aceite dos Termos,
   criar os 5 índices. Rodar `get_advisors` depois.
5. **Migração 30 — helpers fora da API** (itens 7 e 11): mover helpers de política para `privado`, consolidar políticas;
   precisa de teste das políticas campus a campus.
6. **SEO das páginas públicas** (item 15) e o **plano de performance** (`docs/plano-otimizacao-next.md`).

## O que não foi verificado

- Fluxos logados (painel, chat, anunciar, admin): não entrei em conta em produção.
- Larguras reais de celular: o Edge headless não renderiza abaixo de ~500 px.
- Lighthouse/Core Web Vitals: não há ferramenta instalada; números de bundle estão no plano de otimização.
- `agent-browser`: CLI não instalado.
