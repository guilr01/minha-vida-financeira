# Minha Vida Financeira

Aplicativo de gestão financeira pessoal. HTML, CSS e JavaScript puros — sem
servidor, sem dependência, sem build.

**Os dados ficam no aparelho**, no `localStorage` do navegador. Nada é enviado
para servidor nenhum. Para levar os dados de um aparelho a outro, use
**Dados → Exportar** e **Dados → Importar**.

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.html` | A estrutura da página |
| `style.css` | Todo valor visual (cor, tipografia, espaçamento) em variáveis |
| `app.js` | O aplicativo: estado, cálculos, telas, gráficos e importação de extrato |

## Rodar

Abra `index.html` no navegador. Não precisa de servidor.

## O que ele faz

Entradas e saídas por mês, com recorrência (mensal, semanal, quinzenal, única) e
ajuste de valor mês a mês sem alterar os outros. Cartão de crédito com limite,
fatura e parcelas que caem sozinhas nos meses seguintes. Metas com cálculo do
aporte necessário, patrimônio, distribuição da renda, fluxo de caixa projetado e
indicadores.

Importa extrato do banco em **OFX** ou **CSV**, lido no próprio navegador. O
aplicativo **nunca pede a senha do banco** e não se conecta a instituição alguma.
