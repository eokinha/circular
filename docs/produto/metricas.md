# Métricas do MVP — Circular

Fonte: banco de produção (Supabase do MCP), só `SELECT` agregado.
**Exclusão de teste:** contas `*@example.com` e lojas 1 a 5 (carga fria) ficam fora de toda métrica "real".

## Definições

| Métrica | Fórmula | Fonte |
|---|---|---|
| Alunos reais | `usuarios` sem `@example.com` | `usuarios` |
| Alunos verificados | alunos reais com `matricula_validada` | `usuarios` |
| Vendedores reais | lojas reais (fora 1 a 5) com ao menos 1 anúncio | `produtos`, `lojas` |
| Anúncios ativos reais | `produtos.status = 'ativo'` e `renovado_em` nos últimos 60 dias, loja real | `produtos` |
| Interesses | linhas em `interesses` de comprador real (abrir conversa ou WhatsApp) | `interesses` |
| Conversas | `conversas` com comprador real; com resposta = ao menos 1 mensagem do vendedor | `conversas`, `mensagens` |
| Vendidos | `produtos.status = 'vendido'` (por `vendido_em`) | `produtos` |
| Avaliações aprovadas | `avaliacoes.status = 'aprovado'` | `avaliacoes` |
| Métrica norte (proposta) | conversas com resposta do vendedor por semana, por campus | `conversas`, `mensagens` |

Todas por campus (`instituicoes_id`) e por semana quando houver volume.

## Leituras

### 2026-11-02 (antes do lançamento)
- Alunos reais: **3** (todos verificados, criados em 2026-10-09; provavelmente a equipe); 1 deles sem campus. Contas de teste: 5. Admins: 1
- Instituições cadastradas: 12, todas com domínio
- Anúncios reais: **0** · vendedores reais: 0 · vendidos: 0
- Anúncios da carga fria: 180 ativos, todos renovados em 2026-10-31 → **vencem juntos em 2026-12-30**
- Interesses reais: 3 · conversas: 2 · mensagens: 3 · perguntas: 3 · avaliações: 0 · denúncias: 0 · favoritos reais: 3
- Leitura: ainda não há uso real; os números são de teste da equipe. Não há base para medir conversão.
