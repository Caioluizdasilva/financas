# Controle Financeiro

Site (PWA) em formato de planilha, preto e amarelo, responsivo para celular e computador.

- **Painel geral:** entradas × gastos do ano, investimentos e reservas acumulados.
- **Uma aba por mês** (nov/2026 – out/2027): Entradas, Saídas por tipo, Investimentos, Gastos do mês, Fixos, Cartão/parcelas, Gastos por categoria (com pizza) e por tipo de pagamento.
- **Dívidas:** lista com o total.
- **Salvamento automático** a cada alteração (no navegador do aparelho). Backup: Painel → Exportar / Importar.

Sem build e sem dependências: HTML + CSS + JS.

## Publicar no GitHub Pages
1. Crie um repositório e envie todos os arquivos na raiz.
2. Settings → Pages → Deploy from a branch → `main` / `(root)`.
3. Abra `https://SEU-USUARIO.github.io/NOME-DO-REPO/` no celular e no PC.
4. Celular: "Adicionar à tela inicial".

## Rodar local
`python3 -m http.server` e abra http://localhost:8000

## Personalizar
Cores em `style.css` (`:root`). Categorias e tipos de pagamento em `seed.js` (`cats`, `tipos`) ou direto no app.
