# Controle Financeiro

App web (PWA) para acompanhar renda, despesas por mês, dívidas e ver o gráfico de pizza de pra onde o dinheiro vai. Feito a partir da planilha original (nov/2026 – out/2027).

- Sem build, sem dependências: só HTML + JS.
- Os dados ficam salvos no navegador do aparelho (localStorage). Use **Dados → Exportar backup** de vez em quando.

## Publicar no GitHub Pages
1. Crie um repositório (ex.: `financas`) e envie estes arquivos na raiz.
2. No GitHub: **Settings → Pages → Deploy from a branch → main / (root)**.
3. Abra `https://SEU-USUARIO.github.io/financas/` no celular.
4. Adicione à tela inicial (Safari: Compartilhar → Adicionar à Tela de Início; Chrome: ⋮ → Instalar app).

## Rodar local
`python3 -m http.server` e abra http://localhost:8000
