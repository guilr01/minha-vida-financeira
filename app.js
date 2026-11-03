/* =========================================================================
   MINHA VIDA FINANCEIRA
   Aplicativo de gestao financeira pessoal — HTML/CSS/JS puro, sem backend.

   Organizacao do arquivo:
     1. Utilidades (numero, dinheiro, datas, dom)
     2. Estado e persistencia (localStorage)  ......... Store
     3. Dados de demonstracao ......................... Demo
     4. Recorrencia (ocorrencias de um item num mes) .. Recorrencia
     5. Cartoes de credito e parcelas ................. Cartoes
     6. Calculos financeiros .......................... Calc
     7. Graficos (SVG/CSS, sem biblioteca) ............ Graf
     8. Telas ......................................... Telas
     9. Formularios e modais .......................... Form
    10. Eventos e inicializacao

   A estrutura de dados e deliberadamente plana e serializavel: cada colecao
   e um array de objetos com id proprio. E o formato que vai para o JSON de
   exportacao e o que migra para tabelas do Supabase sem reescrita.
   ========================================================================= */
'use strict';

/* =========================== 1. UTILIDADES =========================== */

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const pad = n => String(n).padStart(2, '0');

/** Arredonda para centavos. Usado SO na apresentacao — nunca no meio de uma soma. */
const cent = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtBRL0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const brl = n => fmtBRL.format(cent(n || 0));
const brlCurto = n => {
  const v = cent(n || 0);
  return Math.abs(v % 1) < 0.005 ? fmtBRL0.format(v) : fmtBRL.format(v);
};
const pct = (parte, total, casas = 0) => (!total ? 0 : (parte / total) * 100).toFixed(casas);
/** Mesma conta, escrita em portugues. pct() fica cru porque alimenta width: no CSS. */
const pctBR = (parte, total, casas = 0) => pct(parte, total, casas).replace('.', ',');

/** Aceita "1.234,56", "1234.56", "1234,5" ou numero. */
function paraNumero(v) {
  if (typeof v === 'number') return v;
  if (!v) return 0;
  let s = String(v).trim().replace(/[R$\s]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MESES_CURTOS = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

const mesDe = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const mesDeHoje = () => mesDe(new Date());
const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

function addMeses(mes, n) {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return mesDe(d);
}
const difMeses = (de, ate) => {
  const [a1, m1] = de.split('-').map(Number), [a2, m2] = ate.split('-').map(Number);
  return (a2 - a1) * 12 + (m2 - m1);
};
const nomeMes = mes => { const [a, m] = mes.split('-').map(Number); return `${MESES[m - 1]} ${a}`; };
const nomeMesCurto = mes => { const [, m] = mes.split('-').map(Number); return MESES_CURTOS[m - 1]; };
const diasNoMes = mes => { const [a, m] = mes.split('-').map(Number); return new Date(a, m, 0).getDate(); };
const dataNoMes = (mes, dia) => `${mes}-${pad(Math.min(Math.max(1, dia || 1), diasNoMes(mes)))}`;
const diaDe = iso => Number(iso.slice(8, 10));
const mesDeISO = iso => iso.slice(0, 7);

const el = (sel, raiz = document) => raiz.querySelector(sel);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const iniciais = nome => String(nome || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();

const ICONES = {
  visao: '<path d="M3 12l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  entradas: '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>',
  saidas: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  plano: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.6" fill="currentColor"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  busca: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  fechar: '<path d="M18 6 6 18M6 6l12 12"/>',
  pontos: '<circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none"/>',
  cartao: '<rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20"/>',
  meta: '<path d="M4 21V4h12l-1.5 3.5L16 11H4"/>',
  cofre: '<path d="M3 10h18v9H3z"/><path d="M7 10V7a5 5 0 0 1 10 0v3"/>',
  grafico: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  lapis: '<path d="M16 3.5a2.1 2.1 0 0 1 3 3L8 17.5 4 19l1.5-4z"/>',
  lixo: '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>',
  copia: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  baixar: '<path d="M12 4v11"/><path d="m7 11 5 5 5-5"/><path d="M4 20h16"/>',
  subir: '<path d="M12 20V9"/><path d="m7 13 5-5 5 5"/><path d="M4 4h16"/>',
  escudo: '<path d="M12 3 5 6v6c0 4 3 7.5 7 9 4-1.5 7-5 7-9V6z"/>',
  carteira: '<path d="M3 7h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h12"/><circle cx="16.5" cy="13" r="1.2" fill="currentColor" stroke="none"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>',
};
const ic = (nome, tam = 20, largura = 1.9) =>
  `<svg width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${largura}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[nome] || ''}</svg>`;

/* ====================== 2. ESTADO E PERSISTENCIA ====================== */

const CHAVE = 'mvf.dados.v1';

const COLECOES = ['entradas', 'despesas', 'investimentos', 'cartoes', 'compras', 'metas', 'patrimonio'];

/** Molde do estado. Cada colecao vira uma tabela quando isto for para o Supabase. */
const estadoVazio = () => ({
  versao: 1,
  demo: false,
  criadoEm: new Date().toISOString(),
  config: { mes: mesDeHoje(), tema: 'light', telaAtual: 'visao' },
  entradas: [],
  despesas: [],
  investimentos: [],
  cartoes: [],
  compras: [],
  metas: [],
  patrimonio: [],
  faturasPagas: {},   // "cartaoId|2026-09": true
  importados: {},     // chave do lancamento de extrato ja aproveitado
  simulador: {},      // premissas da projecao, escolhidas pela pessoa
});

const Store = {
  dados: estadoVazio(),

  carregar() {
    let bruto = null;
    try { bruto = localStorage.getItem(CHAVE); } catch (e) { /* modo privado */ }
    if (!bruto) { this.dados = Demo.montar(); this.salvar(); return; }
    try {
      this.dados = this.normalizar(JSON.parse(bruto));
    } catch (e) {
      console.warn('Dados ilegiveis, comecando do zero.', e);
      this.dados = estadoVazio();
    }
  },

  /** Garante que todo campo esperado existe, venha de onde vier (import, versao antiga). */
  normalizar(d) {
    const base = estadoVazio();
    const out = Object.assign(base, d || {});
    out.config = Object.assign(base.config, d && d.config);
    COLECOES.forEach(c => { if (!Array.isArray(out[c])) out[c] = []; });
    if (!out.faturasPagas || typeof out.faturasPagas !== 'object') out.faturasPagas = {};
    if (!out.importados || typeof out.importados !== 'object') out.importados = {};
    if (!out.simulador || typeof out.simulador !== 'object') out.simulador = {};
    [...out.entradas, ...out.despesas, ...out.investimentos].forEach(i => {
      if (!i.ajustes || typeof i.ajustes !== 'object') i.ajustes = {};
      if (!i.id) i.id = uid();
    });
    return out;
  },

  salvar() {
    try { localStorage.setItem(CHAVE, JSON.stringify(this.dados)); }
    catch (e) { toast('Não consegui salvar neste navegador. Exporte seus dados.'); }
  },

  /** Unico caminho de escrita: muda, salva, redesenha. */
  mudar(fn) {
    fn(this.dados);
    this.salvar();
    render();
  },

  lista(colecao) { return this.dados[colecao] || []; },
  achar(colecao, id) { return this.lista(colecao).find(i => i.id === id); },

  inserir(colecao, item) {
    this.mudar(d => { item.id = item.id || uid(); item.criadoEm = new Date().toISOString(); d[colecao].unshift(item); });
    return item;
  },
  atualizar(colecao, id, campos) {
    this.mudar(d => {
      const i = d[colecao].findIndex(x => x.id === id);
      if (i >= 0) d[colecao][i] = Object.assign({}, d[colecao][i], campos);
    });
  },
  remover(colecao, id) {
    this.mudar(d => {
      d[colecao] = d[colecao].filter(x => x.id !== id);
      if (colecao === 'cartoes') d.compras = d.compras.filter(c => c.cartaoId !== id);
    });
  },

  vazio() { return COLECOES.every(c => this.lista(c).length === 0); },
  get mes() { return this.dados.config.mes; },
  set mes(m) { this.dados.config.mes = m; this.salvar(); },
};

/* ======================== 3. DADOS DE DEMONSTRACAO ======================== */

const Demo = {
  montar() {
    const d = estadoVazio();
    d.demo = true;
    const m = mesDeHoje();
    const seis = addMeses(m, -6), tres = addMeses(m, -3), um = addMeses(m, -1);

    const ent = (nome, categoria, tipo, valor, dia, inicio, extra = {}) =>
      Object.assign({ id: uid(), nome, categoria, tipo, valor, frequencia: 'mensal', dia, inicio, fim: null, status: 'previsto', obs: '', ajustes: {} }, extra);

    d.entradas = [
      ent('Aulas CrossFit', 'Trabalho', 'fixa', 4500, 5, seis, { status: 'realizado', ajustes: { [m]: { valor: 4800 } } }),
      ent('Personal', 'Personal', 'variavel', 2000, 10, seis),
      ent('Consultorias', 'Consultoria', 'variavel', 1000, 20, tres),
      ent('Aulas particulares', 'Renda extra', 'variavel', 500, 15, tres),
      ent('Venda da bike antiga', 'Outros', 'extraordinaria', 1200, 12, m, { frequencia: 'unica' }),
    ];

    const desp = (nome, categoria, tipo, valor, dia, pagamento, inicio = seis) =>
      ({ id: uid(), nome, categoria, tipo, valor, frequencia: 'mensal', dia, inicio, fim: null, pagamento, status: 'previsto', obs: '', ajustes: {} });

    d.despesas = [
      desp('Aluguel', 'Moradia', 'fixa', 1600, 5, 'Pix'),
      desp('Condomínio', 'Moradia', 'fixa', 480, 5, 'Boleto'),
      desp('Energia', 'Moradia', 'fixa', 180, 12, 'Débito'),
      desp('Internet', 'Moradia', 'fixa', 120, 8, 'Débito'),
      desp('Celular', 'Serviços', 'fixa', 60, 15, 'Crédito'),
      desp('Seguro do carro', 'Transporte', 'fixa', 190, 20, 'Débito'),
      desp('Assinaturas', 'Serviços', 'fixa', 55, 3, 'Crédito'),
      desp('Alimentação', 'Alimentação', 'variavel', 900, 30, 'Débito'),
      desp('Combustível', 'Transporte', 'variavel', 420, 30, 'Crédito'),
      desp('Restaurantes', 'Restaurantes', 'variavel', 300, 30, 'Crédito'),
      desp('Lazer', 'Lazer', 'variavel', 250, 30, 'Pix'),
      desp('Financiamento do carro', 'Financiamento', 'fixa', 890, 10, 'Débito'),
    ];

    const inv = (nome, categoria, valor, dia) =>
      ({ id: uid(), nome, categoria, tipo: 'fixa', valor, frequencia: 'mensal', dia, inicio: seis, fim: null, status: 'previsto', obs: '', ajustes: {} });

    d.investimentos = [
      inv('Reserva de emergência', 'Reserva', 800, 6),
      inv('Tesouro Selic', 'Renda fixa', 700, 6),
      inv('FIIs', 'FIIs', 300, 6),
      inv('Bitcoin', 'Bitcoin', 200, 6),
    ];

    const cartaoId = uid();
    d.cartoes = [{ id: cartaoId, nome: 'Cartão principal', limite: 8000, fechamento: 28, vencimento: 5 }];
    d.compras = [
      { id: uid(), cartaoId, descricao: 'Mercado do mês', categoria: 'Alimentação', valor: 350, parcelas: 3, data: dataNoMes(um, 14), obs: '' },
      { id: uid(), cartaoId, descricao: 'Tênis de treino', categoria: 'Compras', valor: 600, parcelas: 6, data: dataNoMes(um, 2), obs: '' },
      { id: uid(), cartaoId, descricao: 'Farmácia', categoria: 'Saúde', valor: 120, parcelas: 1, data: dataNoMes(m, 3), obs: '' },
    ];

    d.metas = [
      { id: uid(), nome: 'Reserva financeira', objetivo: 40000, atual: 5000, prazo: addMeses(m, 18), aporteMensal: 800, obs: '' },
      { id: uid(), nome: 'Viagem', objetivo: 8000, atual: 1200, prazo: addMeses(m, 10), aporteMensal: 400, obs: '' },
    ];

    d.patrimonio = [
      { id: uid(), nome: 'Conta corrente', tipo: 'Conta corrente', valor: 3000, atualizadoEm: hojeISO() },
      { id: uid(), nome: 'CDB liquidez diária', tipo: 'Renda fixa', valor: 12000, atualizadoEm: hojeISO() },
      { id: uid(), nome: 'Tesouro Selic', tipo: 'Tesouro', valor: 8000, atualizadoEm: hojeISO() },
      { id: uid(), nome: 'Bitcoin', tipo: 'Bitcoin', valor: 2000, atualizadoEm: hojeISO() },
    ];
    return d;
  },
};

/* ============================ 4. RECORRENCIA ============================ */
/* Um item (entrada, despesa, investimento) e uma REGRA, nao um lancamento.
   Cada mes pergunta a regra quantas vezes ela acontece e por quanto.
   O ajuste por mes (item.ajustes["2026-09"]) sobrepoe valor e status daquele
   mes sem tocar nos demais — e o que permite "em setembro recebi 5.400". */

const Recorrencia = {
  ativo(item, mes) {
    if (!item.inicio) return true;
    if (mes < item.inicio) return false;
    if (item.fim && mes > item.fim) return false;
    return true;
  },

  /** Datas (ISO) em que o item acontece dentro do mes. */
  ocorrencias(item, mes) {
    if (!this.ativo(item, mes)) return [];
    const f = item.frequencia || 'mensal';
    if (f === 'unica') return item.inicio === mes ? [dataNoMes(mes, item.dia)] : [];
    if (f === 'mensal') return [dataNoMes(mes, item.dia)];

    const passo = f === 'semanal' ? 7 : 14;
    const primeira = new Date(dataNoMes(item.inicio, item.dia) + 'T12:00:00');
    const inicioMes = new Date(mes + '-01T12:00:00');
    const fimMes = new Date(mes + '-' + pad(diasNoMes(mes)) + 'T12:00:00');
    if (primeira > fimMes) return [];
    // salta direto para a primeira ocorrencia do mes, sem laco longo
    const dias = Math.floor((inicioMes - primeira) / 86400000);
    const saltos = dias > 0 ? Math.ceil(dias / passo) : 0;
    const cursor = new Date(primeira);
    cursor.setDate(cursor.getDate() + saltos * passo);
    const datas = [];
    while (cursor <= fimMes && datas.length < 10) {
      datas.push(`${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(cursor.getDate())}`);
      cursor.setDate(cursor.getDate() + passo);
    }
    return datas;
  },

  ajuste(item, mes) { return (item.ajustes && item.ajustes[mes]) || {}; },

  valor(item, mes) {
    const a = this.ajuste(item, mes);
    return a.valor != null ? Number(a.valor) : Number(item.valor || 0);
  },

  /** Total do item no mes = valor x numero de ocorrencias. */
  total(item, mes) {
    const n = this.ocorrencias(item, mes).length;
    return n ? this.valor(item, mes) * n : 0;
  },

  status(item, mes) {
    const a = this.ajuste(item, mes);
    if (a.status) return a.status;
    if (item.frequencia === 'unica' || item.inicio === mes) return item.status || 'previsto';
    return 'previsto';
  },

  definirAjuste(colecao, id, mes, campos) {
    Store.mudar(d => {
      const item = d[colecao].find(x => x.id === id);
      if (!item) return;
      if (!item.ajustes) item.ajustes = {};
      item.ajustes[mes] = Object.assign({}, item.ajustes[mes], campos);
    });
  },

  /** Itens de uma colecao que acontecem no mes, ja com valor/status resolvidos. */
  doMes(colecao, mes) {
    return Store.lista(colecao)
      .map(item => {
        const datas = this.ocorrencias(item, mes);
        if (!datas.length) return null;
        return {
          item, colecao, datas,
          valorUnitario: this.valor(item, mes),
          total: this.valor(item, mes) * datas.length,
          status: this.status(item, mes),
          dia: diaDe(datas[0]),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.dia - b.dia || b.total - a.total);
  },
};

/* ========================= 5. CARTOES E PARCELAS ========================= */

const Cartoes = {
  /** Divide o total em n parcelas fechando a conta exata nos centavos. */
  parcelas(total, n) {
    n = Math.max(1, Number(n) || 1);
    const base = cent(total / n);
    const vals = Array(n).fill(base);
    vals[n - 1] = cent(total - base * (n - 1));
    return vals;
  },

  /** Mes de vencimento da parcela i (0-based) de uma compra. */
  mesParcela(compra, cartao, i) {
    const dia = diaDe(compra.data);
    let ciclo = mesDeISO(compra.data);
    if (cartao && dia > Number(cartao.fechamento || 31)) ciclo = addMeses(ciclo, 1);
    const fecha = Number(cartao && cartao.fechamento) || 28;
    const vence = Number(cartao && cartao.vencimento) || 10;
    const mesVenc = vence <= fecha ? addMeses(ciclo, 1) : ciclo;
    return addMeses(mesVenc, i);
  },

  /** Todas as parcelas de todas as compras de um cartao. */
  todasParcelas(cartaoId) {
    const cartao = Store.achar('cartoes', cartaoId);
    const out = [];
    Store.lista('compras').filter(c => c.cartaoId === cartaoId).forEach(compra => {
      const vals = this.parcelas(Number(compra.valor || 0), compra.parcelas);
      vals.forEach((v, i) => out.push({
        compra, indice: i + 1, de: vals.length, valor: v,
        mes: this.mesParcela(compra, cartao, i),
      }));
    });
    return out;
  },

  fatura(cartaoId, mes) {
    const itens = this.todasParcelas(cartaoId).filter(p => p.mes === mes);
    return { itens, total: itens.reduce((s, p) => s + p.valor, 0), paga: !!Store.dados.faturasPagas[`${cartaoId}|${mes}`] };
  },

  /** Limite comprometido = parcelas de faturas ainda nao pagas. */
  usado(cartaoId) {
    return this.todasParcelas(cartaoId)
      .filter(p => !Store.dados.faturasPagas[`${cartaoId}|${p.mes}`])
      .reduce((s, p) => s + p.valor, 0);
  },

  totalFaturas(mes) {
    return Store.lista('cartoes').reduce((s, c) => s + this.fatura(c.id, mes).total, 0);
  },
};

/* ========================== 6. CALCULOS ========================== */

const CATS_COMPROMISSO = ['Financiamento', 'Parcelamento', 'Dívida', 'Cartão', 'Empréstimo'];
const grupoDespesa = d => CATS_COMPROMISSO.includes(d.categoria) ? 'compromisso' : (d.tipo === 'fixa' ? 'fixa' : 'variavel');

const Calc = {
  totais(mes) {
    const entradas = Recorrencia.doMes('entradas', mes);
    const despesas = Recorrencia.doMes('despesas', mes);
    const investimentos = Recorrencia.doMes('investimentos', mes);

    const soma = arr => arr.reduce((s, r) => s + r.total, 0);
    const porGrupo = g => soma(despesas.filter(r => grupoDespesa(r.item) === g));

    const faturas = Cartoes.totalFaturas(mes);
    const renda = soma(entradas);
    const fixas = porGrupo('fixa');
    const variaveis = porGrupo('variavel');
    const compromissos = porGrupo('compromisso') + faturas;
    const invTotal = soma(investimentos);
    const reserva = soma(investimentos.filter(r => r.item.categoria === 'Reserva'));
    const saidas = fixas + variaveis + compromissos;

    return {
      mes, entradas, despesas, investimentos,
      renda, fixas, variaveis, compromissos, faturas,
      investimentos_total: invTotal, reserva,
      saidas,
      saldo: renda - saidas - invTotal,
      recebido: entradas.filter(r => r.status === 'realizado').reduce((s, r) => s + r.total, 0),
      pago: despesas.filter(r => r.status === 'realizado').reduce((s, r) => s + r.total, 0),
      comprometido: saidas + invTotal,
      rendaFixa: soma(entradas.filter(r => r.item.tipo === 'fixa')),
      rendaVariavel: soma(entradas.filter(r => r.item.tipo === 'variavel')),
      rendaExtra: soma(entradas.filter(r => r.item.tipo === 'extraordinaria')),
      taxaPoupanca: renda ? (invTotal / renda) * 100 : 0,
      comprometimento: renda ? ((fixas + compromissos) / renda) * 100 : 0,
    };
  },

  /** Composicao da renda por fonte, ordenada, para o donut. */
  fontesRenda(mes) {
    return Recorrencia.doMes('entradas', mes)
      .map(r => ({ nome: r.item.nome, valor: r.total, categoria: r.item.categoria }))
      .filter(f => f.valor > 0)
      .sort((a, b) => b.valor - a.valor);
  },

  despesasPorCategoria(mes) {
    const mapa = new Map();
    Recorrencia.doMes('despesas', mes).forEach(r => {
      mapa.set(r.item.categoria, (mapa.get(r.item.categoria) || 0) + r.total);
    });
    const faturas = Cartoes.totalFaturas(mes);
    if (faturas > 0) mapa.set('Cartão de crédito', (mapa.get('Cartão de crédito') || 0) + faturas);
    return [...mapa.entries()].map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);
  },

  /** Distribuicao da renda — a resposta de "para onde meu dinheiro vai". */
  distribuicao(mes) {
    const t = this.totais(mes);
    const essenciais = t.fixas + t.compromissos;
    const invSemReserva = t.investimentos_total - t.reserva;
    const livre = t.renda - essenciais - t.variaveis - t.investimentos_total;
    return {
      renda: t.renda,
      fatias: [
        { nome: 'Despesas essenciais', valor: essenciais, cor: 'var(--c1)' },
        { nome: 'Despesas variáveis', valor: t.variaveis, cor: 'var(--c4)' },
        { nome: 'Investimentos', valor: invSemReserva, cor: 'var(--c3)' },
        { nome: 'Reserva', valor: t.reserva, cor: 'var(--c2)' },
        { nome: livre < 0 ? 'Acima da renda' : 'Livre', valor: Math.abs(livre), cor: livre < 0 ? 'var(--negativo)' : 'var(--c6)', negativo: livre < 0 },
      ].filter(f => f.valor > 0.005),
    };
  },

  patrimonioTotal() { return Store.lista('patrimonio').reduce((s, a) => s + Number(a.valor || 0), 0); },

  patrimonioPorTipo() {
    const mapa = new Map();
    Store.lista('patrimonio').forEach(a => mapa.set(a.tipo, (mapa.get(a.tipo) || 0) + Number(a.valor || 0)));
    return [...mapa.entries()].map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);
  },

  fluxo(mes, antes = 1, depois = 4) {
    const out = [];
    for (let i = -antes; i <= depois; i++) {
      const m = addMeses(mes, i);
      const t = this.totais(m);
      out.push({ mes: m, entradas: t.renda, saidas: t.saidas, investimentos: t.investimentos_total, saldo: t.saldo, atual: m === mes });
    }
    return out;
  },

  rendaMedia(mes, n = 3) {
    let s = 0;
    for (let i = 0; i < n; i++) s += this.totais(addMeses(mes, -i)).renda;
    return s / n;
  },

  /** Somas do ano ate o mes selecionado (inclusive). */
  ano(mes) {
    const ano = mes.slice(0, 4);
    let recebido = 0, gasto = 0, investido = 0;
    const ate = Number(mes.slice(5, 7));
    for (let m = 1; m <= ate; m++) {
      const t = this.totais(`${ano}-${pad(m)}`);
      recebido += t.renda; gasto += t.saidas; investido += t.investimentos_total;
    }
    return { ano, recebido, gasto, investido, ate };
  },

  meta(m) {
    const objetivo = Number(m.objetivo || 0), atual = Number(m.atual || 0);
    const falta = Math.max(0, objetivo - atual);
    const meses = m.prazo ? Math.max(0, difMeses(Store.mes, m.prazo)) : 0;
    return {
      objetivo, atual, falta,
      progresso: objetivo ? Math.min(100, (atual / objetivo) * 100) : 0,
      meses,
      aporteNecessario: meses > 0 ? falta / meses : falta,
      noPrazo: meses > 0 ? Number(m.aporteMensal || 0) * meses >= falta : falta === 0,
    };
  },
};

/* ============================ 7. GRAFICOS ============================ */
/* Tudo desenhado a mao em SVG/CSS: nenhuma biblioteca, nenhum enfeite.
   Cada grafico responde a uma pergunta que a lista sozinha nao responde. */

const CORES = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)'];

const Graf = {
  donut(fatias, { tamanho = 108, espessura = 15, rotulo = 'total' } = {}) {
    const total = fatias.reduce((s, f) => s + f.valor, 0);
    const r = (tamanho - espessura) / 2;
    const C = 2 * Math.PI * r;
    let acc = 0;
    const arcos = total > 0 ? fatias.map((f, i) => {
      const frac = f.valor / total;
      const off = -acc * C;
      acc += frac;
      // deixa um fio de respiro entre fatias quando ha mais de uma
      const traco = Math.max(0, frac * C - (fatias.length > 1 ? 2 : 0));
      return `<circle cx="${tamanho / 2}" cy="${tamanho / 2}" r="${r}" fill="none" stroke="${f.cor || CORES[i % CORES.length]}" stroke-width="${espessura}" stroke-dasharray="${traco} ${C}" stroke-dashoffset="${off}"/>`;
    }).join('') : `<circle cx="${tamanho / 2}" cy="${tamanho / 2}" r="${r}" fill="none" stroke="var(--superficie-2)" stroke-width="${espessura}"/>`;

    return `<div class="donut" style="width:${tamanho}px;height:${tamanho}px">
      <svg width="${tamanho}" height="${tamanho}" viewBox="0 0 ${tamanho} ${tamanho}" role="img" aria-label="Composição: ${esc(fatias.map(f => f.nome + ' ' + pctBR(f.valor, total) + '%').join(', '))}">${arcos}</svg>
      <div class="centro"><span class="v num">${brlCurto(total)}</span><span class="r">${esc(rotulo)}</span></div>
    </div>`;
  },

  legenda(fatias, { max = 6 } = {}) {
    const total = fatias.reduce((s, f) => s + f.valor, 0);
    const mostra = fatias.slice(0, max);
    const resto = fatias.slice(max);
    const linhas = mostra.map((f, i) => `<div class="li">
        <span class="ponto" style="background:${f.cor || CORES[i % CORES.length]}"></span>
        <span class="n">${esc(f.nome)}</span>
        <span class="v num">${brlCurto(f.valor)}</span>
        <span class="cinza num" style="font-size:11.5px;width:38px;text-align:right">${pctBR(f.valor, total)}%</span>
      </div>`).join('');
    const extra = resto.length ? `<div class="li">
        <span class="ponto" style="background:var(--c6)"></span>
        <span class="n">Outros (${resto.length})</span>
        <span class="v num">${brlCurto(resto.reduce((s, f) => s + f.valor, 0))}</span>
        <span class="cinza num" style="font-size:11.5px;width:38px;text-align:right">${pctBR(resto.reduce((s, f) => s + f.valor, 0), total)}%</span>
      </div>` : '';
    return `<div class="legenda">${linhas}${extra}</div>`;
  },

  barrasFluxo(linhas) {
    const max = Math.max(1, ...linhas.map(l => Math.max(l.entradas, l.saidas + l.investimentos)));
    const alt = v => Math.max(3, (v / max) * 100);
    const colunas = linhas.map(l => `
      <button type="button" class="fluxo-col" data-acao="ir-mes" data-mes="${l.mes}" aria-pressed="${l.atual}" title="${esc(nomeMes(l.mes))} — saldo ${brl(l.saldo)}">
        <span class="hastes">
          <i class="haste e" style="height:${alt(l.entradas)}%"></i>
          <i class="haste s" style="height:${alt(l.saidas)}%"></i>
          <i class="haste i" style="height:${alt(l.investimentos)}%"></i>
        </span>
        <span class="mes">${nomeMesCurto(l.mes)}</span>
      </button>`).join('');
    return `<div class="fluxo-graf">${colunas}</div>
      <div class="legenda-inline">
        <span><i style="background:var(--positivo)"></i>Entradas</span>
        <span><i style="background:color-mix(in srgb, var(--negativo) 78%, transparent)"></i>Saídas</span>
        <span><i style="background:var(--c3)"></i>Investimentos</span>
      </div>`;
  },

  barra(valor, total, cor = 'var(--principal)') {
    return `<div class="barra"><i style="width:${Math.min(100, Math.max(0, pct(valor, total, 1)))}%;background:${cor}"></i></div>`;
  },
};

/* ===================== 8. COMPONENTES COMPARTILHADOS ===================== */

const cartao = (corpo, { classe = '', titulo = '', acao = '' } = {}) => `
  <section class="cartao ${classe}">
    ${titulo ? `<div class="cartao-cabeca"><h2 class="rotulo forte">${esc(titulo)}</h2>${acao}</div>` : ''}
    ${corpo}
  </section>`;

const vazio = (icone, titulo, texto, botao = '') => `
  <div class="vazio">
    <div class="icone">${ic(icone, 24)}</div>
    <h3>${esc(titulo)}</h3>
    <p>${esc(texto)}</p>
    ${botao}
  </div>`;

const ROTULO_STATUS = {
  entradas: { previsto: 'Previsto', realizado: 'Recebido' },
  despesas: { previsto: 'Prevista', realizado: 'Paga' },
  investimentos: { previsto: 'Previsto', realizado: 'Aportado' },
};

const TIPO_ROTULO = { fixa: 'Fixa', variavel: 'Variável', extraordinaria: 'Extraordinária' };
const FREQ_ROTULO = { mensal: 'Mensal', semanal: 'Semanal', quinzenal: 'Quinzenal', unica: 'Única' };

/** A linha de um registro na lista. Mesma forma em entradas, saidas e investimentos. */
function linhaItem(r, { sinal = '', cor = '' } = {}) {
  const st = ROTULO_STATUS[r.colecao] || ROTULO_STATUS.entradas;
  const feito = r.status === 'realizado';
  const ajustado = Recorrencia.ajuste(r.item, Store.mes).valor != null;
  const vezes = r.datas.length > 1 ? `<span class="pill frio">${r.datas.length}x ${brlCurto(r.valorUnitario)}</span>` : '';
  return `<div class="registro">
  <div class="item">
    <span class="item-marca" aria-hidden="true">${esc(iniciais(r.item.nome))}</span>
    <button type="button" class="item-corpo" style="border:0;background:transparent;padding:0;text-align:left;cursor:pointer" data-acao="editar" data-colecao="${r.colecao}" data-id="${r.item.id}">
      <span class="item-nome">${esc(r.item.nome)}</span>
      <span class="item-meta">
        <span>dia ${r.dia}</span>
        <span>·</span>
        <span>${esc(r.item.categoria || '—')}</span>
        ${r.item.frequencia !== 'mensal' ? `<span class="pill frio">${FREQ_ROTULO[r.item.frequencia]}</span>` : ''}
        ${vezes}
        ${ajustado ? '<span class="pill frio">ajustado</span>' : ''}
      </span>
    </button>
    <span class="item-lado">
      <button type="button" class="item-valor num ${cor}" data-acao="valor-rapido" data-colecao="${r.colecao}" data-id="${r.item.id}" title="Tocar para ajustar o valor deste mês">${sinal}${brlCurto(r.total)}</button>
      <button type="button" class="item-menu" data-acao="menu" data-colecao="${r.colecao}" data-id="${r.item.id}" aria-label="Opções de ${esc(r.item.nome)}">${ic('pontos', 18)}</button>
    </span>
  </div>
  <div class="item-status">
    <button type="button" class="pill tem-botao ${feito ? 'ok' : 'pendente'}" data-acao="alternar-status" data-colecao="${r.colecao}" data-id="${r.item.id}">
      ${feito ? ic('check', 12, 2.6) : ''} ${st[r.status]}
    </button>
  </div>
  </div>`;
}

const listaDe = (registros, opcoes) =>
  registros.length ? `<div class="lista">${registros.map(r => linhaItem(r, opcoes)).join('')}</div>` : '';

/* ============================== 9. TELAS ============================== */

const Telas = {

  /* ---------------------------- VISAO GERAL ---------------------------- */
  visao(mes) {
    if (Store.vazio()) return this.primeiroUso();

    const t = Calc.totais(mes);
    const fontes = Calc.fontesRenda(mes);
    const dist = Calc.distribuicao(mes);
    const metas = Store.lista('metas');
    const patr = Calc.patrimonioTotal();
    const fluxo = Calc.fluxo(mes);
    const ano = Calc.ano(mes);
    const media = Calc.rendaMedia(mes);
    const maiorDespesa = Calc.despesasPorCategoria(mes)[0];
    const totalDespCat = Calc.despesasPorCategoria(mes).reduce((s, c) => s + c.valor, 0);

    const principal = `
      <section class="cartao-principal">
        <div class="rotulo">Renda de ${esc(nomeMes(mes))}</div>
        <div class="valor-heroi num">${brl(t.renda)}</div>
        <div class="heroi-sub">${t.recebido > 0 ? `${brlCurto(t.recebido)} já recebido · ` : ''}${brlCurto(t.renda - t.recebido)} a receber</div>
        <div class="heroi-grade">
          <div class="celula"><div class="rotulo">Saídas</div><div class="v num">${brlCurto(t.saidas)}</div></div>
          <div class="celula"><div class="rotulo">Investido</div><div class="v num">${brlCurto(t.investimentos_total)}</div></div>
          <div class="celula"><div class="rotulo">Comprometido</div><div class="v num">${pctBR(t.comprometido, t.renda)}%</div></div>
        </div>
        <div class="faixa-saldo">
          <div>
            <div class="rotulo">Sobra do mês</div>
            <div style="font-size:11.5px;opacity:.7;margin-top:2px">renda − saídas − investimentos</div>
          </div>
          <div class="v num">${brl(t.saldo)}</div>
        </div>
      </section>`;

    const resumoBarras = (() => {
      const max = Math.max(t.renda, t.saidas + t.investimentos_total, 1);
      const linha = (nome, valor, cor, acao) => `
        <button type="button" class="fluxo-linha" style="border:0;background:transparent;width:100%;cursor:pointer;border-top:${nome === 'Entradas' ? 'none' : '1px solid var(--linha)'}" data-acao="tela" data-tela="${acao}">
          <span class="fl-nome">
            <span class="n">${nome}</span>
            ${Graf.barra(valor, max, cor)}
          </span>
          <span class="fl-valor"><span class="v num">${brlCurto(valor)}</span><span class="p num">${pctBR(valor, t.renda)}% da renda</span></span>
        </button>`;
      return cartao(
        linha('Entradas', t.renda, 'var(--positivo)', 'entradas') +
        linha('Saídas', t.saidas, 'var(--negativo)', 'saidas') +
        linha('Investimentos', t.investimentos_total, 'var(--c3)', 'saidas'),
        { titulo: 'Resumo do mês' }
      );
    })();

    const cartaoFontes = cartao(
      fontes.length
        ? `<div class="donut-bloco">${Graf.donut(fontes, { rotulo: 'renda' })}${Graf.legenda(fontes)}</div>
           <div class="fluxo-linha" style="border-top:1px solid var(--linha);margin-top:6px">
             <span class="fl-nome"><span class="n">Total</span></span>
             <span class="fl-valor"><span class="v num">${brl(t.renda)}</span></span>
           </div>`
        : vazio('entradas', 'Nenhuma entrada neste mês', 'Cadastre suas fontes de renda para ver a composição.',
            `<button class="btn btn-primario" data-abrir="entrada">Adicionar entrada</button>`),
      { titulo: 'De onde vem meu dinheiro?' }
    );

    const metricas = `
      <div class="grade-metricas">
        <div class="metrica">
          <div class="rotulo">Taxa de poupança</div>
          <div class="v num ${t.taxaPoupanca >= 20 ? 'pos' : ''}">${pctBR(t.investimentos_total, t.renda, 1)}%</div>
          <div class="ajuda">${brlCurto(t.investimentos_total)} de ${brlCurto(t.renda)}</div>
        </div>
        <div class="metrica">
          <div class="rotulo">Comprometimento</div>
          <div class="v num ${t.comprometimento > 50 ? 'neg' : ''}">${pctBR(t.fixas + t.compromissos, t.renda, 1)}%</div>
          <div class="ajuda">fixas + dívidas ÷ renda</div>
        </div>
        <div class="metrica">
          <div class="rotulo">Disponível</div>
          <div class="v num ${t.saldo < 0 ? 'neg' : 'pos'}">${brlCurto(t.saldo)}</div>
          <div class="ajuda">depois de tudo</div>
        </div>
        <div class="metrica">
          <div class="rotulo">Renda média 3m</div>
          <div class="v num">${brlCurto(media)}</div>
          <div class="ajuda">${media > t.renda ? 'este mês abaixo' : 'este mês acima'} da média</div>
        </div>
      </div>`;

    const destaques = cartao(`
      <div class="fluxo-linha">
        <span class="fl-nome"><span class="n">Maior fonte de renda</span></span>
        <span class="fl-valor"><span class="v num">${fontes[0] ? esc(fontes[0].nome) : '—'}</span><span class="p num">${fontes[0] ? brlCurto(fontes[0].valor) : ''}</span></span>
      </div>
      <div class="fluxo-linha">
        <span class="fl-nome"><span class="n">Maior categoria de despesa</span></span>
        <span class="fl-valor"><span class="v num">${maiorDespesa ? esc(maiorDespesa.nome) : '—'}</span><span class="p num">${maiorDespesa ? brlCurto(maiorDespesa.valor) + ' · ' + pct(maiorDespesa.valor, totalDespCat) + '%' : ''}</span></span>
      </div>
      <div class="fluxo-linha">
        <span class="fl-nome"><span class="n">Recebido no ano</span><span class="p cinza" style="font-size:11.5px">jan a ${esc(nomeMesCurto(mes))}</span></span>
        <span class="fl-valor"><span class="v num pos">${brlCurto(ano.recebido)}</span></span>
      </div>
      <div class="fluxo-linha">
        <span class="fl-nome"><span class="n">Gasto no ano</span></span>
        <span class="fl-valor"><span class="v num neg">${brlCurto(ano.gasto)}</span></span>
      </div>
      <div class="fluxo-linha">
        <span class="fl-nome"><span class="n">Investido no ano</span></span>
        <span class="fl-valor"><span class="v num">${brlCurto(ano.investido)}</span></span>
      </div>`, { titulo: 'Indicadores do ano' });

    const cartaoDist = cartao(
      dist.fatias.length
        ? dist.fatias.map(f => `
            <div class="fluxo-linha">
              <span class="fl-nome"><span class="n">${esc(f.nome)}</span>${Graf.barra(f.valor, dist.renda, f.cor)}</span>
              <span class="fl-valor"><span class="v num">${brlCurto(f.valor)}</span><span class="p num">${pctBR(f.valor, dist.renda, 1)}%</span></span>
            </div>`).join('')
        : `<p class="cinza" style="font-size:13.5px">Sem renda cadastrada neste mês.</p>`,
      { titulo: 'Para onde meu dinheiro vai', acao: `<button class="btn btn-pequeno btn-fantasma" data-acao="tela" data-tela="plano">Detalhar</button>` }
    );

    const metaPrincipal = metas.length ? (() => {
      const m = metas[0], c = Calc.meta(m);
      return cartao(`
        <div class="meta-topo">
          <span class="meta-nome">${esc(m.nome)}</span>
          <span class="meta-num num">${pctBR(c.atual, c.objetivo)}%</span>
        </div>
        <div class="barra"><i style="width:${c.progresso}%;background:var(--positivo)"></i></div>
        <div class="meta-pe"><span class="num">${brlCurto(c.atual)} de ${brlCurto(c.objetivo)}</span><span class="num">faltam ${brlCurto(c.falta)}</span></div>`,
        { titulo: 'Meta principal', acao: `<button class="btn btn-pequeno btn-fantasma" data-acao="tela" data-tela="plano">Ver metas</button>` });
    })() : '';

    const cartaoPatr = cartao(`
      <div class="valor-heroi num" style="font-size:30px;color:var(--tinta)">${brl(patr)}</div>
      <div class="cinza" style="font-size:12.5px;margin-top:2px">${Store.lista('patrimonio').length} ativo(s) cadastrado(s)</div>`,
      { titulo: 'Meu patrimônio', acao: `<button class="btn btn-pequeno btn-fantasma" data-acao="tela" data-tela="plano">Detalhar</button>` });

    const cartaoFluxo = cartao(
      Graf.barrasFluxo(fluxo) +
      `<div class="fluxo-linha" style="border-top:1px solid var(--linha);margin-top:4px">
        <span class="fl-nome"><span class="n">Saldo projetado em ${esc(nomeMes(fluxo[fluxo.length - 1].mes))}</span></span>
        <span class="fl-valor"><span class="v num ${fluxo[fluxo.length - 1].saldo < 0 ? 'neg' : 'pos'}">${brlCurto(fluxo[fluxo.length - 1].saldo)}</span></span>
      </div>`,
      { titulo: 'Fluxo de caixa' });

    return `
      ${Store.dados.demo ? bannerDemo() : ''}
      <div class="pilha colunas">
        <div class="largo">${principal}</div>
        <div class="largo">
          <div class="linha-botoes" style="margin:2px 0 2px">
            <button class="btn btn-primario" style="flex:1" data-abrir="rapido">${ic('mais', 18, 2.4)} Adicionar</button>
            <button class="btn" data-abrir="ajustes">${ic('escudo', 18)} Dados</button>
          </div>
        </div>
        <div class="largo">${metricas}</div>
        ${resumoBarras}
        ${cartaoFontes}
        ${cartaoDist}
        ${metaPrincipal}
        ${cartaoPatr}
        ${cartaoSimulador({ compacto: true })}
        ${cartaoFluxo}
        <div class="largo">${destaques}</div>
      </div>
      <p class="rodape-nota">Seus dados são armazenados neste dispositivo.</p>`;
  },

  primeiroUso() {
    const passos = [
      { t: 'Cadastre suas entradas', f: Store.lista('entradas').length > 0, abrir: 'entrada' },
      { t: 'Cadastre suas despesas', f: Store.lista('despesas').length > 0, abrir: 'despesa' },
      { t: 'Defina seus investimentos', f: Store.lista('investimentos').length > 0, abrir: 'investimento' },
      { t: 'Crie sua primeira meta', f: Store.lista('metas').length > 0, abrir: 'meta' },
    ];
    return `<div class="pilha">
      ${cartao(`
        ${vazio('carteira', 'Comece cadastrando suas entradas',
          'Em poucos minutos você monta a estrutura da sua vida financeira. O aplicativo calcula o resto sozinho.',
          `<button class="btn btn-primario" data-abrir="entrada">${ic('mais', 18, 2.4)} Adicionar primeira entrada</button>`)}
        <div class="passos">
          ${passos.map((p, i) => `<div class="passo ${p.f ? 'feito' : ''}">
            <span class="n">${p.f ? '✓' : i + 1}</span>
            <span class="t">${p.t}</span>
            ${p.f ? '' : `<button class="btn btn-pequeno" data-abrir="${p.abrir}">Abrir</button>`}
          </div>`).join('')}
        </div>`)}
      ${cartao(`<div class="aviso frio">${ic('carteira', 16)} Prefere não digitar? Importe o extrato do banco em OFX ou CSV.
        <button class="btn btn-pequeno" data-abrir="extrato">Importar extrato</button></div>
        <div style="height:10px"></div>
        <div class="aviso frio">${ic('subir', 16)} Já tem um arquivo exportado? Restaure tudo em segundos.
        <button class="btn btn-pequeno" data-acao="importar">Importar</button></div>
        <div style="height:10px"></div>
        <button class="btn btn-bloco" data-acao="recarregar-demo">Carregar dados de demonstração</button>`)}
    </div>`;
  },
};

const bannerDemo = () => `
  <div class="aviso" style="margin-bottom:12px">
    ${ic('escudo', 16)} Você está vendo <b style="margin-left:2px">dados DEMO</b>
    <button class="btn btn-pequeno" data-acao="limpar-demo">Limpar demo</button>
  </div>`;

/* ------------------------- filtros das listagens ------------------------- */

const filtros = { texto: '', tipo: 'todos', status: 'todos', categoria: 'todas', grupo: 'fixa' };

function aplicaFiltros(registros) {
  const t = filtros.texto.trim().toLowerCase();
  return registros.filter(r => {
    if (t && !(`${r.item.nome} ${r.item.categoria || ''} ${r.item.obs || ''}`.toLowerCase().includes(t))) return false;
    if (filtros.tipo !== 'todos' && r.item.tipo !== filtros.tipo) return false;
    if (filtros.status !== 'todos' && r.status !== filtros.status) return false;
    if (filtros.categoria !== 'todas' && r.item.categoria !== filtros.categoria) return false;
    return true;
  });
}

const chipsDe = (grupo, opcoes, atual) => `
  <div class="chips" role="group">
    ${opcoes.map(o => `<button type="button" class="chip" data-acao="filtro" data-grupo="${grupo}" data-valor="${esc(o.v)}" aria-pressed="${String(o.v) === String(atual)}">${esc(o.r)}</button>`).join('')}
  </div>`;

const barraBusca = () => `
  <div class="barra-busca">
    ${ic('busca', 17)}
    <input type="search" id="busca" placeholder="Buscar por nome ou categoria" value="${esc(filtros.texto)}" autocomplete="off">
  </div>`;

const chipsCategoria = registros => {
  const cats = [...new Set(registros.map(r => r.item.categoria).filter(Boolean))];
  if (cats.length < 2) return '';
  return chipsDe('categoria', [{ v: 'todas', r: 'Todas as categorias' }, ...cats.map(c => ({ v: c, r: c }))], filtros.categoria);
};

Object.assign(Telas, {

  /* ------------------------------ ENTRADAS ------------------------------ */
  entradas(mes) {
    const todas = Recorrencia.doMes('entradas', mes);
    const t = Calc.totais(mes);
    const vis = aplicaFiltros(todas);
    const totalVis = vis.reduce((s, r) => s + r.total, 0);

    const resumo = cartao(`
      <div class="rotulo">Total previsto em ${esc(nomeMes(mes))}</div>
      <div class="valor-heroi num" style="font-size:34px;color:var(--positivo)">${brl(t.renda)}</div>
      <div class="heroi-grade" style="border-top:1px solid var(--linha);color:var(--tinta)">
        <div class="celula"><div class="rotulo">Fixa</div><div class="v num">${brlCurto(t.rendaFixa)}</div></div>
        <div class="celula"><div class="rotulo">Variável</div><div class="v num">${brlCurto(t.rendaVariavel)}</div></div>
        <div class="celula"><div class="rotulo">Extraordinária</div><div class="v num">${brlCurto(t.rendaExtra)}</div></div>
      </div>`);

    const lista = vis.length
      ? cartao(listaDe(vis, { sinal: '+', cor: 'pos' }) +
          (vis.length !== todas.length ? `<div class="fluxo-linha" style="border-top:1px solid var(--linha)">
              <span class="fl-nome"><span class="n">Filtrado</span></span>
              <span class="fl-valor"><span class="v num">${brlCurto(totalVis)}</span></span></div>` : ''),
          { titulo: `${vis.length} entrada${vis.length > 1 ? 's' : ''}` })
      : cartao(todas.length
          ? vazio('busca', 'Nada com esse filtro', 'Ajuste a busca ou os filtros acima.', `<button class="btn btn-pequeno" data-acao="limpar-filtros">Limpar filtros</button>`)
          : vazio('entradas', 'Nenhuma entrada em ' + nomeMes(mes), 'Cadastre de onde vem seu dinheiro. Entradas recorrentes aparecem sozinhas nos próximos meses.',
              `<button class="btn btn-primario" data-abrir="entrada">${ic('mais', 18, 2.4)} Adicionar primeira entrada</button>`));

    return `<div class="pilha colunas">
      <div class="largo">${resumo}</div>
      <div class="largo">
        ${barraBusca()}
        ${chipsDe('tipo', [{ v: 'todos', r: 'Todos os tipos' }, { v: 'fixa', r: 'Fixa' }, { v: 'variavel', r: 'Variável' }, { v: 'extraordinaria', r: 'Extraordinária' }], filtros.tipo)}
        ${chipsDe('status', [{ v: 'todos', r: 'Qualquer status' }, { v: 'previsto', r: 'Previsto' }, { v: 'realizado', r: 'Recebido' }], filtros.status)}
        ${chipsCategoria(todas)}
      </div>
      <div class="largo">${lista}</div>
      <div class="largo linha-botoes">
        <button class="btn btn-primario" style="flex:1" data-abrir="entrada">${ic('mais', 18, 2.4)} Nova entrada</button>
        <button class="btn" data-abrir="extrato" aria-label="Importar extrato">${ic('carteira', 18)}</button>
      </div>
    </div>`;
  },

  /* ------------------------------- SAIDAS ------------------------------- */
  saidas(mes) {
    const t = Calc.totais(mes);
    const desp = Recorrencia.doMes('despesas', mes);
    const inv = Recorrencia.doMes('investimentos', mes);

    const g = filtros.grupo;
    const base = g === 'investimento' ? inv : desp.filter(r => grupoDespesa(r.item) === g);
    const vis = aplicaFiltros(base);

    const resumo = cartao(`
      <div class="rotulo">Sai de ${esc(nomeMes(mes))}</div>
      <div class="valor-heroi num" style="font-size:34px;color:var(--negativo)">${brl(t.saidas + t.investimentos_total)}</div>
      <div class="cinza" style="font-size:12.5px;margin-top:4px">${brlCurto(t.saidas)} em despesas · ${brlCurto(t.investimentos_total)} em investimentos</div>
      <div style="margin-top:14px;display:flex;flex-direction:column;gap:9px">
        ${[['Fixas', t.fixas, 'var(--c1)'], ['Variáveis', t.variaveis, 'var(--c4)'], ['Compromissos', t.compromissos, 'var(--negativo)'], ['Investimentos', t.investimentos_total, 'var(--c3)']]
          .map(([n, v, c]) => `<div class="fluxo-linha" style="padding:0;border:0">
            <span class="fl-nome"><span class="n" style="font-size:13px">${n}</span>${Graf.barra(v, Math.max(t.saidas + t.investimentos_total, 1), c)}</span>
            <span class="fl-valor"><span class="v num" style="font-size:13.5px">${brlCurto(v)}</span></span></div>`).join('')}
      </div>`);

    const segmentos = [
      { v: 'fixa', r: 'Fixas' }, { v: 'variavel', r: 'Variáveis' },
      { v: 'compromisso', r: 'Dívidas' }, { v: 'investimento', r: 'Invest.' },
    ];
    const segmentado = `<div class="segmentado">${segmentos.map(s =>
      `<button type="button" data-acao="filtro" data-grupo="grupo" data-valor="${s.v}" aria-pressed="${g === s.v}">${s.r}</button>`).join('')}</div>`;

    // faturas de cartao entram no grupo "compromisso": sao divida do mes, nao despesa avulsa
    const faturas = g === 'compromisso' ? Store.lista('cartoes').map(c => {
      const f = Cartoes.fatura(c.id, mes);
      if (!f.total) return '';
      return `<div class="registro">
      <div class="item">
        <span class="item-marca" aria-hidden="true">${ic('cartao', 18)}</span>
        <button type="button" class="item-corpo" style="border:0;background:transparent;padding:0;text-align:left;cursor:pointer" data-acao="ver-cartao" data-id="${c.id}">
          <span class="item-nome">Fatura · ${esc(c.nome)}</span>
          <span class="item-meta"><span>vence dia ${esc(c.vencimento)}</span><span>·</span><span>${f.itens.length} lançamento(s)</span></span>
        </button>
        <span class="item-lado">
          <span class="item-valor num neg">${brlCurto(f.total)}</span>
          <button type="button" class="item-menu" data-acao="ver-cartao" data-id="${c.id}" aria-label="Ver fatura">${ic('pontos', 18)}</button>
        </span>
      </div>
      <div class="item-status">
        <button type="button" class="pill tem-botao ${f.paga ? 'ok' : 'pendente'}" data-acao="alternar-fatura" data-id="${c.id}">${f.paga ? ic('check', 12, 2.6) + ' Paga' : 'Prevista'}</button>
      </div>
      </div>`;
    }).join('') : '';

    const nomeGrupo = { fixa: 'despesa fixa', variavel: 'despesa variável', compromisso: 'compromisso', investimento: 'investimento' }[g];
    const lista = (vis.length || faturas)
      ? cartao(`<div class="lista">${vis.map(r => linhaItem(r, { sinal: '−', cor: g === 'investimento' ? '' : 'neg' })).join('')}${faturas}</div>`,
          { titulo: `${vis.length + (faturas ? Store.lista('cartoes').filter(c => Cartoes.fatura(c.id, mes).total).length : 0)} lançamento(s)` })
      : cartao(vazio('saidas', `Nenhum(a) ${nomeGrupo} em ${nomeMes(mes)}`,
          g === 'investimento' ? 'Aportes cadastrados aqui contam na sua taxa de poupança.' : 'Cadastre para ver o quanto da sua renda já está comprometido.',
          `<button class="btn btn-primario" data-abrir="${g === 'investimento' ? 'investimento' : 'despesa'}">${ic('mais', 18, 2.4)} Adicionar</button>`));

    return `<div class="pilha colunas">
      <div class="largo">${resumo}</div>
      <div class="largo">${segmentado}${barraBusca()}
        ${chipsDe('status', [{ v: 'todos', r: 'Qualquer status' }, { v: 'previsto', r: 'Previstas' }, { v: 'realizado', r: 'Pagas' }], filtros.status)}
        ${chipsCategoria(base)}
      </div>
      <div class="largo">${lista}</div>
      <div class="largo">${this.blocoCartoes(mes)}</div>
      <div class="largo linha-botoes">
        <button class="btn btn-primario" style="flex:1" data-abrir="${g === 'investimento' ? 'investimento' : 'despesa'}">${ic('mais', 18, 2.4)} ${g === 'investimento' ? 'Novo investimento' : 'Nova despesa'}</button>
        <button class="btn" data-abrir="extrato" aria-label="Importar extrato">${ic('carteira', 18)}</button>
      </div>
    </div>`;
  },

  blocoCartoes(mes) {
    const cartoes = Store.lista('cartoes');
    const corpo = cartoes.length ? cartoes.map(c => {
      const f = Cartoes.fatura(c.id, mes);
      const usado = Cartoes.usado(c.id);
      const limite = Number(c.limite || 0);
      return `<div class="cc">
        <div class="cc-topo">
          <div>
            <div class="cc-nome">${esc(c.nome)}</div>
            <div class="cc-datas">fecha dia ${esc(c.fechamento)} · vence dia ${esc(c.vencimento)}</div>
          </div>
          <div class="cc-fatura">
            <div class="rotulo">Fatura ${esc(nomeMesCurto(mes))}</div>
            <div class="v num">${brlCurto(f.total)}</div>
          </div>
        </div>
        <div class="cc-limite">
          <div class="l"><span>Limite usado <b class="num">${brlCurto(usado)}</b></span><span>Disponível <b class="num">${brlCurto(Math.max(0, limite - usado))}</b></span></div>
          ${Graf.barra(usado, Math.max(limite, 1), usado / Math.max(limite, 1) > 0.8 ? 'var(--negativo)' : 'var(--principal)')}
          <div class="l" style="margin:6px 0 0"><span class="num">de ${brlCurto(limite)}</span><span class="num">${pctBR(usado, limite)}%</span></div>
        </div>
        <div class="linha-botoes" style="margin-top:12px">
          <button class="btn btn-pequeno" data-acao="ver-cartao" data-id="${c.id}">Ver fatura</button>
          <button class="btn btn-pequeno" data-abrir="compra" data-id="${c.id}">${ic('mais', 15, 2.4)} Compra</button>
          <button class="btn btn-pequeno btn-fantasma" data-acao="editar" data-colecao="cartoes" data-id="${c.id}">Editar</button>
        </div>
      </div>`;
    }).join('') : vazio('cartao', 'Nenhum cartão cadastrado', 'Cadastre o cartão para acompanhar limite, fatura e parcelas futuras.',
        `<button class="btn btn-primario" data-abrir="cartao">Cadastrar cartão</button>`);

    return cartao(corpo + (cartoes.length ? `<div style="height:10px"></div><button class="btn btn-bloco btn-pequeno" data-abrir="cartao">${ic('mais', 15, 2.4)} Outro cartão</button>` : ''),
      { titulo: 'Cartão de crédito' });
  },

  /* ---------------------------- PLANEJAMENTO ---------------------------- */
  plano(mes) {
    const dist = Calc.distribuicao(mes);
    const t = Calc.totais(mes);
    const metas = Store.lista('metas');
    const ativos = Store.lista('patrimonio');
    const porTipo = Calc.patrimonioPorTipo();
    const patr = Calc.patrimonioTotal();
    const fluxo = Calc.fluxo(mes, 1, 5);

    const cartaoDist = cartao(`
      <div class="rotulo">Renda total</div>
      <div class="valor-heroi num" style="font-size:32px;color:var(--tinta)">${brl(dist.renda)}</div>
      <div style="height:14px"></div>
      ${dist.fatias.length ? dist.fatias.map(f => `
        <div class="fluxo-linha">
          <span class="fl-nome"><span class="n">${esc(f.nome)}</span>${Graf.barra(f.valor, dist.renda, f.cor)}</span>
          <span class="fl-valor"><span class="v num ${f.negativo ? 'neg' : ''}">${brlCurto(f.valor)}</span><span class="p num">${pctBR(f.valor, dist.renda, 1)}%</span></span>
        </div>`).join('') : `<p class="cinza" style="font-size:13.5px">Cadastre entradas para ver a distribuição.</p>`}
      ${t.saldo < 0 ? `<div class="aviso" style="margin-top:12px">${ic('escudo', 16)} Você está comprometendo ${brlCurto(Math.abs(t.saldo))} a mais do que recebe.</div>` : ''}`,
      { titulo: 'Para onde meu dinheiro vai?' });

    const cartaoMetas = cartao(
      metas.length ? metas.map(m => {
        const c = Calc.meta(m);
        const falta = c.aporteNecessario;
        return `<div style="padding:12px 0;${metas.indexOf(m) ? 'border-top:1px solid var(--linha)' : ''}">
          <div class="meta-topo">
            <span class="meta-nome">${esc(m.nome)}</span>
            <span class="item-lado">
              <span class="meta-num num">${pctBR(c.atual, c.objetivo)}%</span>
              <button type="button" class="item-menu" data-acao="menu" data-colecao="metas" data-id="${m.id}" aria-label="Opções">${ic('pontos', 18)}</button>
            </span>
          </div>
          <div class="barra"><i style="width:${c.progresso}%;background:${c.progresso >= 100 ? 'var(--positivo)' : 'var(--principal)'}"></i></div>
          <div class="meta-pe">
            <span class="num">${brlCurto(c.atual)} de ${brlCurto(c.objetivo)}</span>
            <span class="num">faltam ${brlCurto(c.falta)}</span>
          </div>
          <div class="meta-pe" style="margin-top:3px">
            <span>${c.meses > 0 ? `${c.meses} mês(es) até ${esc(nomeMes(m.prazo))}` : 'sem prazo definido'}</span>
            <span class="${c.noPrazo ? 'pos' : 'neg'}">${c.meses > 0 ? `aportar ${brlCurto(falta)}/mês` : ''}</span>
          </div>
          ${m.aporteMensal ? `<div class="meta-pe"><span class="cinza">aporte planejado ${brlCurto(m.aporteMensal)}/mês</span><span class="${c.noPrazo ? 'pos' : 'neg'}">${c.noPrazo ? 'no ritmo certo' : 'abaixo do necessário'}</span></div>` : ''}
          <div class="linha-botoes" style="margin-top:10px">
            <button class="btn btn-pequeno" data-acao="aportar-meta" data-id="${m.id}">Registrar aporte</button>
          </div>
        </div>`;
      }).join('') : vazio('meta', 'Nenhuma meta ainda', 'Defina um objetivo e o aplicativo calcula quanto guardar por mês.',
          `<button class="btn btn-primario" data-abrir="meta">Criar primeira meta</button>`),
      { titulo: 'Metas financeiras', acao: metas.length ? `<button class="btn btn-pequeno btn-fantasma" data-abrir="meta">${ic('mais', 15, 2.4)} Nova</button>` : '' });

    const cartaoPatr = cartao(
      ativos.length ? `
        <div class="rotulo">Patrimônio total</div>
        <div class="valor-heroi num" style="font-size:32px;color:var(--tinta);margin-bottom:14px">${brl(patr)}</div>
        <div class="donut-bloco">${Graf.donut(porTipo, { rotulo: 'total' })}${Graf.legenda(porTipo)}</div>
        <div style="height:6px"></div>
        <div class="lista">
          ${ativos.map(a => `<div class="item">
            <span class="item-marca" aria-hidden="true">${esc(iniciais(a.nome))}</span>
            <button type="button" class="item-corpo" style="border:0;background:transparent;padding:0;text-align:left;cursor:pointer" data-acao="editar" data-colecao="patrimonio" data-id="${a.id}">
              <span class="item-nome">${esc(a.nome)}</span>
              <span class="item-meta"><span>${esc(a.tipo)}</span></span>
            </button>
            <span class="item-lado">
              <button type="button" class="item-valor num" data-acao="editar" data-colecao="patrimonio" data-id="${a.id}">${brlCurto(a.valor)}</button>
              <button type="button" class="item-menu" data-acao="menu" data-colecao="patrimonio" data-id="${a.id}" aria-label="Opções">${ic('pontos', 18)}</button>
            </span>
          </div>`).join('')}
        </div>
        <div style="height:10px"></div>
        <button class="btn btn-bloco btn-pequeno" data-abrir="patrimonio">${ic('mais', 15, 2.4)} Adicionar ativo</button>`
        : vazio('cofre', 'Nenhum ativo cadastrado', 'Conta, reserva, investimentos, cripto. Some tudo o que você tem hoje.',
            `<button class="btn btn-primario" data-abrir="patrimonio">Cadastrar ativo</button>`),
      { titulo: 'Meu patrimônio' });

    const cartaoFluxo = cartao(
      Graf.barrasFluxo(fluxo) +
      `<div class="lista" style="margin-top:6px">
        ${fluxo.map(l => `<div class="item" style="padding:10px 0">
          <span class="item-corpo">
            <span class="item-nome">${esc(nomeMes(l.mes))} ${l.atual ? '<span class="pill">atual</span>' : ''}</span>
            <span class="item-meta">
              <span class="pos num">+${brlCurto(l.entradas)}</span>
              <span class="neg num">−${brlCurto(l.saidas)}</span>
              <span class="num" style="color:var(--c3)">↑${brlCurto(l.investimentos)}</span>
            </span>
          </span>
          <span class="item-lado"><span class="item-valor num ${l.saldo < 0 ? 'neg' : 'pos'}">${brlCurto(l.saldo)}</span></span>
        </div>`).join('')}
      </div>`,
      { titulo: 'Fluxo de caixa', acao: `<span class="rotulo">projeção</span>` });

    const cartaoDados = cartao(`
      <div class="aviso frio">${ic('escudo', 16)} Seus dados são armazenados neste dispositivo, no seu navegador. Nada é enviado para servidor nenhum.</div>
      <div style="height:12px"></div>
      <div class="linha-botoes">
        <button class="btn btn-pequeno" data-acao="exportar">${ic('baixar', 15)} Exportar dados</button>
        <button class="btn btn-pequeno" data-acao="importar">${ic('subir', 15)} Importar dados</button>
        <button class="btn btn-pequeno" data-acao="tema">${ic('sol', 15)} Tema</button>
      </div>
      <div style="height:10px"></div>
      ${Store.dados.demo ? `<button class="btn btn-bloco btn-perigo btn-pequeno" data-acao="limpar-demo">Limpar dados demo</button>`
        : `<button class="btn btn-bloco btn-perigo btn-pequeno" data-acao="apagar-tudo">Apagar todos os dados</button>`}`,
      { titulo: 'Meus dados' });

    return `<div class="pilha colunas">
      ${Store.dados.demo ? `<div class="largo">${bannerDemo()}</div>` : ''}
      <div class="largo">${cartaoDist}</div>
      ${cartaoMetas}
      ${cartaoPatr}
      <div class="largo">${cartaoSimulador()}</div>
      <div class="largo">${cartaoFluxo}</div>
      <div class="largo">${cartaoDados}</div>
    </div>`;
  },
});

/* ======================= 10. MODAIS E FORMULARIOS ======================= */

const raizModal = () => document.getElementById('raiz-modal');
const pilhaModais = [];

function abrirFolha({ titulo, corpo, pe = '', aoMontar = null }) {
  const tela = document.createElement('div');
  tela.className = 'tela-modal';
  tela.innerHTML = `<div class="folha" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
      <div class="folha-cabeca">
        <h2>${esc(titulo)}</h2>
        <button type="button" class="fechar" data-acao="fechar-folha" aria-label="Fechar">${ic('fechar', 18, 2.2)}</button>
      </div>
      <div class="folha-corpo">${corpo}</div>
      ${pe ? `<div class="folha-pe">${pe}</div>` : ''}
    </div>`;
  tela.addEventListener('mousedown', ev => { if (ev.target === tela) fecharFolha(); });
  raizModal().appendChild(tela);
  pilhaModais.push(tela);
  document.body.style.overflow = 'hidden';
  if (aoMontar) aoMontar(tela);
  const primeiro = tela.querySelector('input:not([type=hidden]), select, textarea, button.btn');
  if (primeiro && window.matchMedia('(min-width: 900px)').matches) primeiro.focus();
  return tela;
}

function fecharFolha(todas = false) {
  do {
    const t = pilhaModais.pop();
    if (t) t.remove();
  } while (todas && pilhaModais.length);
  if (!pilhaModais.length) document.body.style.overflow = '';
}

function toast(msg) {
  const raiz = document.getElementById('raiz-toast');
  raiz.innerHTML = `<div class="toast">${esc(msg)}</div>`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { raiz.innerHTML = ''; }, 2600);
}

function confirmar({ titulo, texto, ok = 'Confirmar', perigo = false }) {
  return new Promise(resolve => {
    const tela = abrirFolha({
      titulo,
      corpo: `<p style="font-size:14px;color:var(--tinta-2);line-height:1.5">${esc(texto)}</p>`,
      pe: `<button type="button" class="btn" data-acao="fechar-folha">Cancelar</button>
           <button type="button" class="btn ${perigo ? 'btn-perigo' : 'btn-primario'}" data-ok="1">${esc(ok)}</button>`,
    });
    tela.querySelector('[data-ok]').addEventListener('click', () => { fecharFolha(); resolve(true); });
    tela.addEventListener('click', ev => { if (ev.target.closest('[data-acao="fechar-folha"]')) resolve(false); });
    tela.addEventListener('mousedown', ev => { if (ev.target === tela) resolve(false); });
  });
}

/* ------------------------- blocos de formulario ------------------------- */

const F = {
  texto: ({ nome, rotulo, valor = '', tipo = 'text', dica = '', attrs = '', req = false }) => `
    <div class="campo">
      <label for="c-${nome}">${esc(rotulo)}</label>
      <input id="c-${nome}" name="${nome}" type="${tipo}" value="${esc(valor)}" ${req ? 'required' : ''} ${attrs}>
      ${dica ? `<span class="dica">${esc(dica)}</span>` : ''}
    </div>`,

  dinheiro: ({ nome = 'valor', rotulo = 'Valor', valor = '', dica = '' }) => `
    <div class="campo">
      <label for="c-${nome}">${esc(rotulo)}</label>
      <div class="campo-dinheiro">
        <span class="cifrao">R$</span>
        <input id="c-${nome}" name="${nome}" type="text" inputmode="decimal" placeholder="0,00"
               value="${valor === '' || valor == null ? '' : String(valor).replace('.', ',')}" required>
      </div>
      ${dica ? `<span class="dica">${esc(dica)}</span>` : ''}
    </div>`,

  select: ({ nome, rotulo, opcoes, valor = '', dica = '' }) => `
    <div class="campo">
      <label for="c-${nome}">${esc(rotulo)}</label>
      <select id="c-${nome}" name="${nome}">
        ${opcoes.map(o => {
          const v = typeof o === 'string' ? o : o.v, r = typeof o === 'string' ? o : o.r;
          return `<option value="${esc(v)}" ${String(v) === String(valor) ? 'selected' : ''}>${esc(r)}</option>`;
        }).join('')}
      </select>
      ${dica ? `<span class="dica">${esc(dica)}</span>` : ''}
    </div>`,

  opcoes: ({ nome, rotulo, opcoes, valor }) => `
    <div class="campo">
      <label>${esc(rotulo)}</label>
      <input type="hidden" name="${nome}" id="c-${nome}" value="${esc(valor)}">
      <div class="opcoes" role="group" aria-label="${esc(rotulo)}">
        ${opcoes.map(o => `<button type="button" data-acao="opcao" data-alvo="c-${nome}" data-valor="${esc(o.v)}" aria-pressed="${String(o.v) === String(valor)}">${esc(o.r)}</button>`).join('')}
      </div>
    </div>`,

  area: ({ nome = 'obs', rotulo = 'Observação', valor = '' }) => `
    <div class="campo">
      <label for="c-${nome}">${esc(rotulo)} <span class="cinza" style="font-weight:400">(opcional)</span></label>
      <textarea id="c-${nome}" name="${nome}" rows="2">${esc(valor)}</textarea>
    </div>`,

  dupla: (a, b) => `<div class="dupla">${a}${b}</div>`,
};

const CATEGORIAS = {
  entradas: ['Trabalho', 'Personal', 'Consultoria', 'Negócio', 'Investimentos', 'Renda extra', 'Outros'],
  despesas: ['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Restaurantes', 'Compras', 'Serviços', 'Assinaturas', 'Financiamento', 'Parcelamento', 'Dívida', 'Cartão', 'Empréstimo', 'Outros'],
  investimentos: ['Reserva', 'Renda fixa', 'Tesouro', 'FIIs', 'Ações', 'Bitcoin', 'Cripto', 'Previdência', 'Outros'],
  patrimonio: ['Conta corrente', 'Reserva', 'Renda fixa', 'CDB', 'Tesouro', 'FII', 'Ações', 'Bitcoin', 'Cripto', 'Dinheiro', 'Imóvel', 'Veículo', 'Outros'],
};
const FREQUENCIAS = [{ v: 'mensal', r: 'Mensal' }, { v: 'semanal', r: 'Semanal' }, { v: 'quinzenal', r: 'Quinzenal' }, { v: 'unica', r: 'Única' }];
const PAGAMENTOS = ['Pix', 'Débito', 'Crédito', 'Dinheiro', 'Boleto', 'Outro'];

const TITULO_COLECAO = {
  entradas: 'entrada', despesas: 'despesa', investimentos: 'investimento',
  cartoes: 'cartão', compras: 'compra', metas: 'meta', patrimonio: 'ativo',
};

/* --------------------- formulario de item recorrente --------------------- */

function formItem(colecao, id) {
  const existente = id ? Store.achar(colecao, id) : null;
  const i = existente || {
    nome: '', categoria: CATEGORIAS[colecao][0], tipo: colecao === 'investimentos' ? 'fixa' : 'fixa',
    valor: '', frequencia: 'mensal', dia: 5, inicio: Store.mes, fim: '', status: 'previsto',
    pagamento: 'Pix', obs: '',
  };
  const rotDia = colecao === 'despesas' ? 'Dia de vencimento' : 'Dia previsto';
  const rotStatus = ROTULO_STATUS[colecao];

  const corpo = `<form class="form" id="form-item" data-colecao="${colecao}" ${id ? `data-id="${id}"` : ''}>
    ${F.texto({ nome: 'nome', rotulo: `Nome da ${TITULO_COLECAO[colecao]}`, valor: i.nome, req: true, attrs: 'placeholder="Ex.: Aulas particulares" autocomplete="off"' })}
    ${F.dinheiro({ valor: i.valor })}
    ${F.select({ nome: 'categoria', rotulo: 'Categoria', opcoes: CATEGORIAS[colecao], valor: i.categoria })}
    ${colecao !== 'investimentos' ? F.opcoes({
      nome: 'tipo', rotulo: 'Tipo', valor: i.tipo,
      opcoes: [{ v: 'fixa', r: 'Fixa' }, { v: 'variavel', r: 'Variável' }, { v: 'extraordinaria', r: 'Extraordinária' }],
    }) : '<input type="hidden" name="tipo" value="fixa">'}
    ${F.dupla(
      F.select({ nome: 'frequencia', rotulo: 'Frequência', opcoes: FREQUENCIAS, valor: i.frequencia }),
      F.texto({ nome: 'dia', rotulo: rotDia, valor: i.dia, tipo: 'number', attrs: 'min="1" max="31" inputmode="numeric"' })
    )}
    ${colecao === 'despesas' ? F.select({ nome: 'pagamento', rotulo: 'Forma de pagamento', opcoes: PAGAMENTOS, valor: i.pagamento, dica: 'Compras parceladas no cartão: cadastre em Cartão de crédito, não aqui.' }) : ''}
    ${F.opcoes({ nome: 'status', rotulo: 'Status neste mês', valor: i.status, opcoes: [{ v: 'previsto', r: rotStatus.previsto }, { v: 'realizado', r: rotStatus.realizado }] })}
    ${F.dupla(
      F.texto({ nome: 'inicio', rotulo: 'A partir de', valor: i.inicio, tipo: 'month' }),
      F.texto({ nome: 'fim', rotulo: 'Até (opcional)', valor: i.fim || '', tipo: 'month' })
    )}
    ${F.area({ valor: i.obs })}
  </form>`;

  abrirFolha({
    titulo: existente ? `Editar ${TITULO_COLECAO[colecao]}` : `Nova ${TITULO_COLECAO[colecao]}`,
    corpo,
    pe: `${existente ? `<button type="button" class="btn btn-perigo" data-acao="excluir" data-colecao="${colecao}" data-id="${id}">${ic('lixo', 16)}</button>` : ''}
         <button type="submit" form="form-item" class="btn btn-primario">Salvar</button>`,
    aoMontar: tela => {
      tela.querySelector('#form-item').addEventListener('submit', ev => {
        ev.preventDefault();
        const d = Object.fromEntries(new FormData(ev.target).entries());
        const item = {
          nome: (d.nome || '').trim() || 'Sem nome',
          categoria: d.categoria,
          tipo: d.tipo,
          valor: paraNumero(d.valor),
          frequencia: d.frequencia,
          dia: Math.min(31, Math.max(1, Number(d.dia) || 1)),
          inicio: d.inicio || Store.mes,
          fim: d.fim || null,
          status: d.status,
          obs: d.obs || '',
        };
        if (colecao === 'despesas') item.pagamento = d.pagamento;
        if (existente) { Store.atualizar(colecao, id, item); toast('Alterações salvas'); }
        else { item.ajustes = {}; Store.inserir(colecao, item); toast(`${item.nome} cadastrado`); }
        fecharFolha();
      });
    },
  });
}

/* ------------------------- formulario de cartao ------------------------- */

function formCartao(id) {
  const c = id ? Store.achar('cartoes', id) : { nome: '', limite: '', fechamento: 28, vencimento: 5 };
  abrirFolha({
    titulo: id ? 'Editar cartão' : 'Novo cartão',
    corpo: `<form class="form" id="form-cartao">
      ${F.texto({ nome: 'nome', rotulo: 'Nome do cartão', valor: c.nome, req: true, attrs: 'placeholder="Ex.: Nubank" autocomplete="off"' })}
      ${F.dinheiro({ nome: 'limite', rotulo: 'Limite total', valor: c.limite })}
      ${F.dupla(
        F.texto({ nome: 'fechamento', rotulo: 'Dia de fechamento', valor: c.fechamento, tipo: 'number', attrs: 'min="1" max="31" inputmode="numeric"' }),
        F.texto({ nome: 'vencimento', rotulo: 'Dia de vencimento', valor: c.vencimento, tipo: 'number', attrs: 'min="1" max="31" inputmode="numeric"' })
      )}
    </form>`,
    pe: `${id ? `<button type="button" class="btn btn-perigo" data-acao="excluir" data-colecao="cartoes" data-id="${id}">${ic('lixo', 16)}</button>` : ''}
         <button type="submit" form="form-cartao" class="btn btn-primario">Salvar</button>`,
    aoMontar: tela => {
      tela.querySelector('#form-cartao').addEventListener('submit', ev => {
        ev.preventDefault();
        const d = Object.fromEntries(new FormData(ev.target).entries());
        const item = {
          nome: (d.nome || '').trim() || 'Cartão',
          limite: paraNumero(d.limite),
          fechamento: Math.min(31, Math.max(1, Number(d.fechamento) || 28)),
          vencimento: Math.min(31, Math.max(1, Number(d.vencimento) || 5)),
        };
        if (id) Store.atualizar('cartoes', id, item); else Store.inserir('cartoes', item);
        toast('Cartão salvo');
        fecharFolha();
      });
    },
  });
}

/* ------------------------- formulario de compra ------------------------- */

function formCompra(compraId, cartaoIdPadrao) {
  const cartoes = Store.lista('cartoes');
  if (!cartoes.length) { toast('Cadastre um cartão primeiro'); return formCartao(); }
  const c = compraId ? Store.achar('compras', compraId)
    : { cartaoId: cartaoIdPadrao || cartoes[0].id, descricao: '', categoria: 'Compras', valor: '', parcelas: 1, data: dataNoMes(Store.mes, new Date().getDate()), obs: '' };

  abrirFolha({
    titulo: compraId ? 'Editar compra' : 'Compra no cartão',
    corpo: `<form class="form" id="form-compra">
      ${F.select({ nome: 'cartaoId', rotulo: 'Cartão', opcoes: cartoes.map(x => ({ v: x.id, r: x.nome })), valor: c.cartaoId })}
      ${F.texto({ nome: 'descricao', rotulo: 'Compra', valor: c.descricao, req: true, attrs: 'placeholder="Ex.: Mercado" autocomplete="off"' })}
      ${F.dinheiro({ rotulo: 'Valor total', valor: c.valor })}
      ${F.dupla(
        F.texto({ nome: 'parcelas', rotulo: 'Parcelas', valor: c.parcelas, tipo: 'number', attrs: 'min="1" max="60" inputmode="numeric"' }),
        F.texto({ nome: 'data', rotulo: 'Data da compra', valor: c.data, tipo: 'date' })
      )}
      ${F.select({ nome: 'categoria', rotulo: 'Categoria', opcoes: CATEGORIAS.despesas, valor: c.categoria })}
      <div id="previa"></div>
      ${F.area({ valor: c.obs })}
    </form>`,
    pe: `${compraId ? `<button type="button" class="btn btn-perigo" data-acao="excluir" data-colecao="compras" data-id="${compraId}">${ic('lixo', 16)}</button>` : ''}
         <button type="submit" form="form-compra" class="btn btn-primario">Salvar</button>`,
    aoMontar: tela => {
      const form = tela.querySelector('#form-compra');
      const previa = tela.querySelector('#previa');

      const desenhar = () => {
        const d = Object.fromEntries(new FormData(form).entries());
        const total = paraNumero(d.valor), n = Math.max(1, Number(d.parcelas) || 1);
        if (!total) { previa.innerHTML = ''; return; }
        const cartao = Store.achar('cartoes', d.cartaoId);
        const vals = Cartoes.parcelas(total, n);
        const linhas = vals.map((v, k) => {
          const m = Cartoes.mesParcela({ data: d.data }, cartao, k);
          return `<div class="l"><span>${k + 1}/${n} · ${nomeMes(m)}</span><span class="num">${brl(v)}</span></div>`;
        }).join('');
        previa.innerHTML = `<div class="campo"><label>Parcelas nos próximos meses</label><div class="parcelas-previa">${linhas}</div></div>`;
      };
      form.addEventListener('input', desenhar);
      form.addEventListener('change', desenhar);
      desenhar();

      form.addEventListener('submit', ev => {
        ev.preventDefault();
        const d = Object.fromEntries(new FormData(ev.target).entries());
        const item = {
          cartaoId: d.cartaoId,
          descricao: (d.descricao || '').trim() || 'Compra',
          categoria: d.categoria,
          valor: paraNumero(d.valor),
          parcelas: Math.min(60, Math.max(1, Number(d.parcelas) || 1)),
          data: d.data || hojeISO(),
          obs: d.obs || '',
        };
        if (compraId) Store.atualizar('compras', compraId, item); else Store.inserir('compras', item);
        toast(item.parcelas > 1 ? `Compra em ${item.parcelas}x lançada` : 'Compra lançada');
        fecharFolha();
      });
    },
  });
}

/* -------------------------- formulario de meta -------------------------- */

function formMeta(id) {
  const m = id ? Store.achar('metas', id) : { nome: '', objetivo: '', atual: 0, prazo: addMeses(Store.mes, 12), aporteMensal: '', obs: '' };
  abrirFolha({
    titulo: id ? 'Editar meta' : 'Nova meta',
    corpo: `<form class="form" id="form-meta">
      ${F.texto({ nome: 'nome', rotulo: 'Nome da meta', valor: m.nome, req: true, attrs: 'placeholder="Ex.: Reserva financeira" autocomplete="off"' })}
      ${F.dinheiro({ nome: 'objetivo', rotulo: 'Valor objetivo', valor: m.objetivo })}
      ${F.dinheiro({ nome: 'atual', rotulo: 'Valor já guardado', valor: m.atual })}
      ${F.dupla(
        F.texto({ nome: 'prazo', rotulo: 'Prazo', valor: m.prazo, tipo: 'month' }),
        F.dinheiro({ nome: 'aporteMensal', rotulo: 'Aporte mensal', valor: m.aporteMensal })
      )}
      <div id="calc-meta"></div>
      ${F.area({ valor: m.obs })}
    </form>`,
    pe: `${id ? `<button type="button" class="btn btn-perigo" data-acao="excluir" data-colecao="metas" data-id="${id}">${ic('lixo', 16)}</button>` : ''}
         <button type="submit" form="form-meta" class="btn btn-primario">Salvar</button>`,
    aoMontar: tela => {
      const form = tela.querySelector('#form-meta');
      const alvo = tela.querySelector('#calc-meta');
      const desenhar = () => {
        const d = Object.fromEntries(new FormData(form).entries());
        const c = Calc.meta({ objetivo: paraNumero(d.objetivo), atual: paraNumero(d.atual), prazo: d.prazo, aporteMensal: paraNumero(d.aporteMensal) });
        if (!c.objetivo) { alvo.innerHTML = ''; return; }
        alvo.innerHTML = `<div class="parcelas-previa">
          <div class="l"><span>Faltam</span><span class="num">${brl(c.falta)}</span></div>
          <div class="l"><span>Meses até o prazo</span><span class="num">${c.meses}</span></div>
          <div class="l"><span><b>Precisa aportar por mês</b></span><span class="num"><b>${brl(c.aporteNecessario)}</b></span></div>
        </div>`;
      };
      form.addEventListener('input', desenhar); form.addEventListener('change', desenhar); desenhar();
      form.addEventListener('submit', ev => {
        ev.preventDefault();
        const d = Object.fromEntries(new FormData(ev.target).entries());
        const item = {
          nome: (d.nome || '').trim() || 'Meta',
          objetivo: paraNumero(d.objetivo), atual: paraNumero(d.atual),
          prazo: d.prazo || null, aporteMensal: paraNumero(d.aporteMensal), obs: d.obs || '',
        };
        if (id) Store.atualizar('metas', id, item); else Store.inserir('metas', item);
        toast('Meta salva'); fecharFolha();
      });
    },
  });
}

/* ------------------------ formulario de patrimonio ------------------------ */

function formAtivo(id) {
  const a = id ? Store.achar('patrimonio', id) : { nome: '', tipo: CATEGORIAS.patrimonio[0], valor: '' };
  abrirFolha({
    titulo: id ? 'Editar ativo' : 'Novo ativo',
    corpo: `<form class="form" id="form-ativo">
      ${F.texto({ nome: 'nome', rotulo: 'Nome', valor: a.nome, req: true, attrs: 'placeholder="Ex.: CDB do banco" autocomplete="off"' })}
      ${F.select({ nome: 'tipo', rotulo: 'Tipo', opcoes: CATEGORIAS.patrimonio, valor: a.tipo })}
      ${F.dinheiro({ rotulo: 'Valor atual', valor: a.valor })}
    </form>`,
    pe: `${id ? `<button type="button" class="btn btn-perigo" data-acao="excluir" data-colecao="patrimonio" data-id="${id}">${ic('lixo', 16)}</button>` : ''}
         <button type="submit" form="form-ativo" class="btn btn-primario">Salvar</button>`,
    aoMontar: tela => {
      tela.querySelector('#form-ativo').addEventListener('submit', ev => {
        ev.preventDefault();
        const d = Object.fromEntries(new FormData(ev.target).entries());
        const item = { nome: (d.nome || '').trim() || 'Ativo', tipo: d.tipo, valor: paraNumero(d.valor), atualizadoEm: hojeISO() };
        if (id) Store.atualizar('patrimonio', id, item); else Store.inserir('patrimonio', item);
        toast('Patrimônio atualizado'); fecharFolha();
      });
    },
  });
}

/* ---------------------- cadastro rapido (botao "+") ---------------------- */

const ATALHOS = [
  { k: 'entrada', ic: 'entradas', cor: 'var(--positivo)', fundo: 'var(--positivo-bg)', t: 'Entrada', s: 'Dinheiro que entra' },
  { k: 'despesa', ic: 'saidas', cor: 'var(--negativo)', fundo: 'var(--negativo-bg)', t: 'Despesa', s: 'Dinheiro que sai' },
  { k: 'investimento', ic: 'grafico', cor: 'var(--c3)', fundo: 'var(--superficie-2)', t: 'Investimento', s: 'Aporte do mês' },
  { k: 'compra', ic: 'cartao', cor: 'var(--tinta-2)', fundo: 'var(--superficie-2)', t: 'Compra no cartão', s: 'Com parcelamento' },
  { k: 'meta', ic: 'meta', cor: 'var(--c5)', fundo: 'var(--superficie-2)', t: 'Meta', s: 'Objetivo com prazo' },
  { k: 'patrimonio', ic: 'cofre', cor: 'var(--c1)', fundo: 'var(--superficie-2)', t: 'Patrimônio', s: 'Ativo que você tem' },
  { k: 'extrato', ic: 'subir', cor: 'var(--principal)', fundo: 'var(--sobre-principal)', t: 'Extrato do banco', s: 'Importar OFX ou CSV' },
];

function menuRapido() {
  abrirFolha({
    titulo: 'O que você quer cadastrar?',
    corpo: `<div class="menu-rapido">${ATALHOS.map(a => `
      <button type="button" data-abrir="${a.k}">
        <span class="ic" style="background:${a.fundo};color:${a.cor}">${ic(a.ic, 19, 2.1)}</span>
        <span class="tx"><b>${a.t}</b><span>${a.s}</span></span>
        <span class="cinza">${ic('plano', 16)}</span>
      </button>`).join('')}</div>`,
  });
}

function abrir(o, id) {
  const mapa = {
    rapido: () => menuRapido(),
    entrada: () => formItem('entradas', id),
    despesa: () => formItem('despesas', id),
    investimento: () => formItem('investimentos', id),
    cartao: () => formCartao(id),
    compra: () => formCompra(null, id),
    meta: () => formMeta(id),
    patrimonio: () => formAtivo(id),
    ajustes: () => folhaDados(),
    extrato: () => folhaImportarExtrato(),
  };
  if (mapa[o]) { if (o !== 'rapido' && pilhaModais.length) fecharFolha(true); mapa[o](); }
}

function editar(colecao, id) {
  if (colecao === 'cartoes') return formCartao(id);
  if (colecao === 'compras') return formCompra(id);
  if (colecao === 'metas') return formMeta(id);
  if (colecao === 'patrimonio') return formAtivo(id);
  return formItem(colecao, id);
}

/* -------------------- ajuste de valor do mes (1 toque) -------------------- */

function valorRapido(colecao, id) {
  const item = Store.achar(colecao, id);
  if (!item) return;
  const mes = Store.mes;
  const n = Recorrencia.ocorrencias(item, mes).length;
  const temAjuste = Recorrencia.ajuste(item, mes).valor != null;

  abrirFolha({
    titulo: item.nome,
    corpo: `<form class="form" id="form-valor">
      ${F.dinheiro({ rotulo: `Valor em ${nomeMes(mes)}`, valor: Recorrencia.valor(item, mes) })}
      <div class="parcelas-previa">
        <div class="l"><span>Ocorrências no mês</span><span class="num">${n}x</span></div>
        <div class="l"><span>Valor padrão</span><span class="num">${brl(item.valor)}</span></div>
        ${temAjuste ? `<div class="l"><span>Este mês está ajustado</span><span><button type="button" class="btn btn-pequeno btn-fantasma" data-acao="remover-ajuste" data-colecao="${colecao}" data-id="${id}">remover ajuste</button></span></div>` : ''}
      </div>
      <p class="dica">Alterar só este mês não muda os outros — é o caso do salário que veio diferente.</p>
    </form>`,
    pe: `<button type="button" class="btn" data-salvar="todos">Todos os meses</button>
         <button type="submit" form="form-valor" class="btn btn-primario">Só em ${nomeMesCurto(mes)}</button>`,
    aoMontar: tela => {
      const form = tela.querySelector('#form-valor');
      const ler = () => paraNumero(new FormData(form).get('valor'));
      form.addEventListener('submit', ev => {
        ev.preventDefault();
        Recorrencia.definirAjuste(colecao, id, mes, { valor: ler() });
        toast(`Valor de ${nomeMes(mes)} atualizado`); fecharFolha();
      });
      tela.querySelector('[data-salvar="todos"]').addEventListener('click', () => {
        const v = ler();
        Store.mudar(d => {
          const it = d[colecao].find(x => x.id === id);
          it.valor = v;
          if (it.ajustes && it.ajustes[mes]) delete it.ajustes[mes].valor;
        });
        toast('Valor padrão atualizado'); fecharFolha();
      });
    },
  });
}

/* ----------------------------- menu do item ----------------------------- */

function menuItem(colecao, id) {
  const item = Store.achar(colecao, id);
  if (!item) return;
  const recorrente = ['entradas', 'despesas', 'investimentos'].includes(colecao);
  const st = ROTULO_STATUS[colecao];
  const feito = recorrente && Recorrencia.status(item, Store.mes) === 'realizado';

  abrirFolha({
    titulo: item.nome,
    corpo: `<div class="menu-rapido">
      <button type="button" data-acao="editar" data-colecao="${colecao}" data-id="${id}">
        <span class="ic" style="background:var(--superficie-2)">${ic('lapis', 18)}</span><span class="tx"><b>Editar</b><span>Alterar todos os meses</span></span></button>
      ${recorrente ? `
      <button type="button" data-acao="valor-rapido" data-colecao="${colecao}" data-id="${id}">
        <span class="ic" style="background:var(--superficie-2)">${ic('carteira', 18)}</span><span class="tx"><b>Ajustar valor de ${nomeMes(Store.mes)}</b><span>Sem mexer nos outros meses</span></span></button>
      <button type="button" data-acao="alternar-status" data-colecao="${colecao}" data-id="${id}">
        <span class="ic" style="background:${feito ? 'var(--superficie-2)' : 'var(--positivo-bg)'};color:${feito ? 'var(--tinta-2)' : 'var(--positivo)'}">${ic('check', 18)}</span>
        <span class="tx"><b>Marcar como ${feito ? st.previsto.toLowerCase() : st.realizado.toLowerCase()}</b><span>Somente ${nomeMes(Store.mes)}</span></span></button>
      <button type="button" data-acao="duplicar" data-colecao="${colecao}" data-id="${id}">
        <span class="ic" style="background:var(--superficie-2)">${ic('copia', 18)}</span><span class="tx"><b>Duplicar</b><span>Criar uma cópia</span></span></button>` : ''}
      <button type="button" data-acao="excluir" data-colecao="${colecao}" data-id="${id}">
        <span class="ic" style="background:var(--negativo-bg);color:var(--negativo)">${ic('lixo', 18)}</span><span class="tx"><b style="color:var(--negativo)">Excluir</b><span>Remove de todos os meses</span></span></button>
    </div>`,
  });
}

/* ------------------------------ fatura ------------------------------ */

function folhaFatura(cartaoId) {
  const c = Store.achar('cartoes', cartaoId);
  const mes = Store.mes;
  const f = Cartoes.fatura(cartaoId, mes);
  const compras = Store.lista('compras').filter(x => x.cartaoId === cartaoId);

  abrirFolha({
    titulo: `Fatura · ${c.nome}`,
    corpo: `
      <div class="cartao plano" style="border:0;padding:0">
        <div class="rotulo">Fatura de ${esc(nomeMes(mes))}</div>
        <div class="valor-heroi num" style="font-size:30px;color:var(--tinta)">${brl(f.total)}</div>
        <div class="cinza" style="font-size:12.5px">vence dia ${esc(c.vencimento)} · fecha dia ${esc(c.fechamento)}</div>
        <div style="height:14px"></div>
        ${f.itens.length ? `<div class="lista">${f.itens.map(p => `
          <div class="item">
            <span class="item-corpo">
              <span class="item-nome">${esc(p.compra.descricao)}</span>
              <span class="item-meta"><span>${p.indice}/${p.de}</span><span>·</span><span>${esc(p.compra.categoria)}</span><span>·</span><span>compra em ${esc(p.compra.data.split('-').reverse().join('/'))}</span></span>
            </span>
            <span class="item-lado">
              <span class="item-valor num">${brl(p.valor)}</span>
              <button type="button" class="item-menu" data-acao="editar" data-colecao="compras" data-id="${p.compra.id}" aria-label="Editar compra">${ic('lapis', 16)}</button>
            </span>
          </div>`).join('')}</div>`
          : `<p class="cinza" style="font-size:13.5px">Nenhum lançamento nesta fatura.</p>`}
        <div style="height:14px"></div>
        <button type="button" class="btn btn-bloco ${f.paga ? '' : 'btn-primario'}" data-acao="alternar-fatura" data-id="${cartaoId}">
          ${f.paga ? 'Fatura paga — desmarcar' : 'Marcar fatura como paga'}
        </button>
        <div style="height:18px"></div>
        <div class="rotulo forte">Todas as compras (${compras.length})</div>
        <div style="height:8px"></div>
        ${compras.length ? `<div class="lista">${compras.map(x => {
          const vals = Cartoes.parcelas(Number(x.valor), x.parcelas);
          const ultima = Cartoes.mesParcela(x, c, vals.length - 1);
          return `<div class="item">
            <button type="button" class="item-corpo" style="border:0;background:transparent;padding:0;text-align:left;cursor:pointer" data-acao="editar" data-colecao="compras" data-id="${x.id}">
              <span class="item-nome">${esc(x.descricao)}</span>
              <span class="item-meta"><span>${x.parcelas}x de ${brlCurto(vals[0])}</span><span>·</span><span>até ${esc(nomeMes(ultima))}</span></span>
            </button>
            <span class="item-lado">
              <span class="item-valor num">${brlCurto(x.valor)}</span>
              <button type="button" class="item-menu" data-acao="excluir" data-colecao="compras" data-id="${x.id}" aria-label="Excluir compra">${ic('lixo', 16)}</button>
            </span>
          </div>`;
        }).join('')}</div>` : `<p class="cinza" style="font-size:13.5px">Nenhuma compra cadastrada.</p>`}
      </div>`,
    pe: `<button type="button" class="btn btn-primario" data-abrir="compra" data-id="${cartaoId}">${ic('mais', 16, 2.4)} Nova compra</button>`,
  });
}

/* ------------------------------ aporte na meta ------------------------------ */

function folhaAporte(id) {
  const m = Store.achar('metas', id);
  abrirFolha({
    titulo: `Aporte em ${m.nome}`,
    corpo: `<form class="form" id="form-aporte">
      ${F.dinheiro({ rotulo: 'Quanto você guardou agora', valor: m.aporteMensal || '' })}
      <div class="parcelas-previa">
        <div class="l"><span>Guardado hoje</span><span class="num">${brl(m.atual)}</span></div>
        <div class="l"><span>Objetivo</span><span class="num">${brl(m.objetivo)}</span></div>
      </div>
    </form>`,
    pe: `<button type="submit" form="form-aporte" class="btn btn-primario">Registrar aporte</button>`,
    aoMontar: tela => {
      tela.querySelector('#form-aporte').addEventListener('submit', ev => {
        ev.preventDefault();
        const v = paraNumero(new FormData(ev.target).get('valor'));
        Store.atualizar('metas', id, { atual: Number(m.atual || 0) + v });
        toast(`${brl(v)} somados à meta`); fecharFolha();
      });
    },
  });
}

/* ------------------------------ seletor de mes ------------------------------ */

function folhaMes() {
  const [anoAtual] = Store.mes.split('-').map(Number);
  let ano = anoAtual;
  const desenhar = tela => {
    tela.querySelector('#grade-mes').innerHTML = MESES.map((n, i) => {
      const m = `${ano}-${pad(i + 1)}`;
      const t = Calc.totais(m);
      const tem = t.renda || t.saidas || t.investimentos_total;
      return `<button type="button" class="chip" style="flex:1 1 30%;justify-content:center;flex-direction:column;height:auto;padding:10px 6px" data-acao="ir-mes" data-mes="${m}" aria-pressed="${m === Store.mes}">
        <span>${n.slice(0, 3)}</span>
        <span style="font-size:10.5px;opacity:.7" class="num">${tem ? brlCurto(t.saldo) : '—'}</span>
      </button>`;
    }).join('');
    tela.querySelector('#ano-rotulo').textContent = ano;
  };
  const tela = abrirFolha({
    titulo: 'Escolher mês',
    corpo: `<div style="display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:14px">
        <button type="button" class="fechar" data-ano="-1" aria-label="Ano anterior">‹</button>
        <b id="ano-rotulo" class="num" style="font-size:17px"></b>
        <button type="button" class="fechar" data-ano="1" aria-label="Próximo ano">›</button>
      </div>
      <div id="grade-mes" class="opcoes" style="gap:8px"></div>
      <p class="dica" style="margin-top:12px">O valor abaixo de cada mês é o saldo previsto.</p>`,
    aoMontar: t => {
      desenhar(t);
      t.querySelectorAll('[data-ano]').forEach(b => b.addEventListener('click', () => { ano += Number(b.dataset.ano); desenhar(t); }));
    },
  });
  return tela;
}

/* --------------------------- dados: exportar / importar --------------------------- */

function folhaDados() {
  abrirFolha({
    titulo: 'Meus dados',
    corpo: `
      <div class="aviso frio">${ic('escudo', 16)} Seus dados são armazenados neste dispositivo. Nada sai do seu navegador.</div>
      <div style="height:14px"></div>
      <div class="menu-rapido">
        <button type="button" data-acao="exportar"><span class="ic" style="background:var(--superficie-2)">${ic('baixar', 18)}</span><span class="tx"><b>Exportar dados</b><span>Gera um arquivo JSON com tudo</span></span></button>
        <button type="button" data-acao="importar"><span class="ic" style="background:var(--superficie-2)">${ic('subir', 18)}</span><span class="tx"><b>Importar dados</b><span>Restaura de um arquivo exportado</span></span></button>
        <button type="button" data-abrir="extrato"><span class="ic" style="background:var(--sobre-principal);color:var(--principal)">${ic('carteira', 18)}</span><span class="tx"><b>Importar extrato do banco</b><span>OFX ou CSV, lido neste aparelho</span></span></button>
        <button type="button" data-acao="tema"><span class="ic" style="background:var(--superficie-2)">${ic('sol', 18)}</span><span class="tx"><b>Alternar tema</b><span>Claro ou escuro</span></span></button>
        ${Store.dados.demo
          ? `<button type="button" data-acao="limpar-demo"><span class="ic" style="background:var(--atencao-bg);color:var(--atencao)">${ic('lixo', 18)}</span><span class="tx"><b>Limpar dados demo</b><span>Começar com o app vazio</span></span></button>`
          : `<button type="button" data-acao="recarregar-demo"><span class="ic" style="background:var(--superficie-2)">${ic('copia', 18)}</span><span class="tx"><b>Carregar demonstração</b><span>Substitui tudo por dados fictícios</span></span></button>`}
        <button type="button" data-acao="apagar-tudo"><span class="ic" style="background:var(--negativo-bg);color:var(--negativo)">${ic('lixo', 18)}</span><span class="tx"><b style="color:var(--negativo)">Apagar todos os dados</b><span>Não tem volta</span></span></button>
      </div>`,
  });
}

function exportar() {
  const json = JSON.stringify(Store.dados, null, 2);
  const nome = `minha-vida-financeira-${hojeISO()}.json`;
  let baixou = false;
  try {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = nome; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    baixou = true;
  } catch (e) { baixou = false; }

  fecharFolha(true);
  abrirFolha({
    titulo: 'Exportar dados',
    corpo: `<p style="font-size:13.5px;color:var(--tinta-2);line-height:1.5">
        ${baixou ? `O download de <b>${esc(nome)}</b> foi iniciado. Se o navegador bloqueou, copie o texto abaixo e salve num arquivo <code>.json</code>.`
                 : `Copie o texto abaixo e salve num arquivo <code>.json</code>.`}
      </p>
      <div style="height:10px"></div>
      <textarea class="texto-json" id="json-saida" readonly>${esc(json)}</textarea>`,
    pe: `<button type="button" class="btn" data-acao="fechar-folha">Fechar</button>
         <button type="button" class="btn btn-primario" data-acao="copiar-json">${ic('copia', 16)} Copiar tudo</button>`,
  });
}

function importar() {
  fecharFolha(true);
  abrirFolha({
    titulo: 'Importar dados',
    corpo: `<p style="font-size:13.5px;color:var(--tinta-2);line-height:1.5">Escolha o arquivo exportado ou cole o conteúdo. <b>Isto substitui todos os dados atuais.</b></p>
      <div style="height:12px"></div>
      <div class="campo">
        <label for="arq">Arquivo JSON</label>
        <input type="file" id="arq" accept="application/json,.json">
      </div>
      <div class="campo">
        <label for="json-entrada">Ou cole aqui</label>
        <textarea class="texto-json" id="json-entrada" placeholder='{"versao":1,...}'></textarea>
      </div>`,
    pe: `<button type="button" class="btn" data-acao="fechar-folha">Cancelar</button>
         <button type="button" class="btn btn-primario" id="btn-restaurar">Restaurar</button>`,
    aoMontar: tela => {
      const area = tela.querySelector('#json-entrada');
      tela.querySelector('#arq').addEventListener('change', ev => {
        const f = ev.target.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = () => { area.value = r.result; toast('Arquivo carregado — confira e restaure'); };
        r.readAsText(f);
      });
      tela.querySelector('#btn-restaurar').addEventListener('click', async () => {
        let obj;
        try { obj = JSON.parse(area.value); }
        catch (e) { return toast('JSON inválido — confira o conteúdo'); }
        if (!obj || typeof obj !== 'object' || !COLECOES.some(c => Array.isArray(obj[c]))) return toast('Este arquivo não é um backup do aplicativo');
        const qtd = COLECOES.reduce((s, c) => s + (Array.isArray(obj[c]) ? obj[c].length : 0), 0);
        if (!await confirmar({ titulo: 'Substituir tudo?', texto: `O arquivo tem ${qtd} registro(s). Os dados atuais deste dispositivo serão apagados.`, ok: 'Restaurar', perigo: true })) return;
        Store.dados = Store.normalizar(obj);
        Store.dados.config.mes = Store.dados.config.mes || mesDeHoje();
        Store.salvar();
        fecharFolha(true);
        aplicarTema();
        render();
        toast(`${qtd} registro(s) restaurado(s)`);
      });
    },
  });
}

/* ------------------------------ tema ------------------------------ */

function aplicarTema() {
  const t = Store.dados.config.tema === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', t);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t === 'dark' ? '#0E1413' : '#F4F6F7');
}

/* =========================== 11. NAVEGACAO =========================== */

const TELAS_DEF = [
  { id: 'visao', r: 'Visão', ic: 'visao', titulo: 'Visão geral' },
  { id: 'entradas', r: 'Entradas', ic: 'entradas', titulo: 'Entradas' },
  { id: 'saidas', r: 'Saídas', ic: 'saidas', titulo: 'Saídas' },
  { id: 'plano', r: 'Plano', ic: 'plano', titulo: 'Planejamento' },
];

function irPara(tela) {
  Store.dados.config.telaAtual = tela;
  Store.salvar();
  filtros.texto = ''; filtros.tipo = 'todos'; filtros.status = 'todos'; filtros.categoria = 'todas';
  render();
  const alvo = document.getElementById('tela');
  window.scrollTo({ top: 0, behavior: 'auto' });
  if (alvo) alvo.focus({ preventScroll: true });
}

function renderNav() {
  const atual = Store.dados.config.telaAtual;
  const tabs = document.getElementById('tabbar');
  const celula = t => `<button type="button" data-acao="tela" data-tela="${t.id}" aria-current="${t.id === atual ? 'page' : 'false'}">
      ${ic(t.ic, 21, 1.9)}<span>${t.r}</span></button>`;
  tabs.innerHTML = celula(TELAS_DEF[0]) + celula(TELAS_DEF[1]) +
    `<button type="button" class="tab-mais" data-abrir="rapido" aria-label="Cadastro rápido"><span class="bolha">${ic('mais', 24, 2.6)}</span></button>` +
    celula(TELAS_DEF[2]) + celula(TELAS_DEF[3]);

  const lateral = document.getElementById('nav-lateral');
  lateral.innerHTML = TELAS_DEF.map(t => `<button type="button" data-acao="tela" data-tela="${t.id}" aria-current="${t.id === atual ? 'page' : 'false'}">${ic(t.ic, 19, 1.9)} ${t.r}</button>`).join('');
}

function render() {
  const mes = Store.mes;
  const tela = Store.dados.config.telaAtual in Telas ? Store.dados.config.telaAtual : 'visao';
  const def = TELAS_DEF.find(t => t.id === tela) || TELAS_DEF[0];

  document.getElementById('mes-rotulo').textContent = nomeMes(mes);
  document.getElementById('titulo-tela').textContent = def.titulo;

  // preserva o cursor da busca quando a lista se redesenha a cada tecla
  const ativo = document.activeElement;
  const eraBusca = ativo && ativo.id === 'busca';
  const pos = eraBusca ? ativo.selectionStart : null;

  document.getElementById('tela').innerHTML = Telas[tela](mes);
  renderNav();

  if (eraBusca) {
    const novo = document.getElementById('busca');
    if (novo) { novo.focus(); try { novo.setSelectionRange(pos, pos); } catch (e) { } }
  }
}

/* =========================== 12. EVENTOS =========================== */

const ACOES = {
  tela: b => irPara(b.dataset.tela),
  'ir-mes': b => { Store.mes = b.dataset.mes; fecharFolha(true); render(); },
  'fechar-folha': () => fecharFolha(),
  editar: b => { fecharFolha(true); editar(b.dataset.colecao, b.dataset.id); },
  menu: b => { fecharFolha(true); menuItem(b.dataset.colecao, b.dataset.id); },
  'valor-rapido': b => { fecharFolha(true); valorRapido(b.dataset.colecao, b.dataset.id); },
  'ver-cartao': b => { fecharFolha(true); folhaFatura(b.dataset.id); },
  'aportar-meta': b => folhaAporte(b.dataset.id),

  'alternar-status': b => {
    const { colecao, id } = b.dataset;
    const item = Store.achar(colecao, id);
    const novo = Recorrencia.status(item, Store.mes) === 'realizado' ? 'previsto' : 'realizado';
    Recorrencia.definirAjuste(colecao, id, Store.mes, { status: novo });
    fecharFolha(true);
    toast(novo === 'realizado' ? ROTULO_STATUS[colecao].realizado : ROTULO_STATUS[colecao].previsto);
  },

  'alternar-fatura': b => {
    const chave = `${b.dataset.id}|${Store.mes}`;
    Store.mudar(d => {
      if (d.faturasPagas[chave]) delete d.faturasPagas[chave];
      else d.faturasPagas[chave] = true;
    });
    fecharFolha(true);
    toast('Fatura atualizada');
  },

  'remover-ajuste': b => {
    const { colecao, id } = b.dataset;
    Store.mudar(d => {
      const it = d[colecao].find(x => x.id === id);
      if (it && it.ajustes) delete it.ajustes[Store.mes];
    });
    fecharFolha(true); toast('Ajuste removido');
  },

  duplicar: b => {
    const { colecao, id } = b.dataset;
    const item = Store.achar(colecao, id);
    const copia = Object.assign({}, JSON.parse(JSON.stringify(item)), { id: uid(), nome: item.nome + ' (cópia)', ajustes: {} });
    Store.inserir(colecao, copia);
    fecharFolha(true); toast('Cópia criada');
  },

  excluir: async b => {
    const { colecao, id } = b.dataset;
    const item = Store.achar(colecao, id);
    if (!item) return;
    const nome = item.nome || item.descricao || 'este registro';
    if (await confirmar({
      titulo: 'Excluir?',
      texto: `"${nome}" será removido de todos os meses. ${colecao === 'cartoes' ? 'As compras deste cartão também serão apagadas.' : ''}`,
      ok: 'Excluir', perigo: true,
    })) {
      Store.remover(colecao, id);
      fecharFolha(true);
      toast('Removido');
    }
  },

  filtro: b => {
    filtros[b.dataset.grupo] = b.dataset.valor;
    if (b.dataset.grupo === 'grupo') filtros.categoria = 'todas';
    render();
  },
  'limpar-filtros': () => { filtros.texto = ''; filtros.tipo = 'todos'; filtros.status = 'todos'; filtros.categoria = 'todas'; render(); },

  opcao: b => {
    const alvo = document.getElementById(b.dataset.alvo);
    alvo.value = b.dataset.valor;
    b.parentElement.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    alvo.dispatchEvent(new Event('input', { bubbles: true }));
  },

  cenario: b => {
    Store.mudar(d => { d.simulador = Object.assign({}, d.simulador, { cenario: b.dataset.valor }); });
  },
  premissas: () => { fecharFolha(true); folhaPremissas(); },
  'ano-a-ano': () => { fecharFolha(true); folhaAnoAano(); },

  exportar: () => exportar(),
  importar: () => importar(),
  'copiar-json': async b => {
    const txt = document.getElementById('json-saida').value;
    try { await navigator.clipboard.writeText(txt); toast('Copiado'); }
    catch (e) {
      const a = document.getElementById('json-saida');
      a.removeAttribute('readonly'); a.select(); a.setSelectionRange(0, 999999);
      try { document.execCommand('copy'); toast('Copiado'); } catch (e2) { toast('Selecione o texto e copie'); }
      a.setAttribute('readonly', '');
    }
  },

  tema: () => {
    Store.dados.config.tema = Store.dados.config.tema === 'dark' ? 'light' : 'dark';
    Store.salvar(); aplicarTema(); fecharFolha(true);
  },

  'limpar-demo': async () => {
    if (!await confirmar({ titulo: 'Limpar dados demo?', texto: 'Todos os registros de demonstração serão apagados e você começa do zero, com o aplicativo vazio.', ok: 'Limpar', perigo: true })) return;
    const tema = Store.dados.config.tema;
    Store.dados = estadoVazio();
    Store.dados.config.tema = tema;
    Store.salvar(); fecharFolha(true); irPara('visao');
    toast('Pronto. Agora é a sua vez.');
  },

  'recarregar-demo': async () => {
    if (!await confirmar({ titulo: 'Carregar demonstração?', texto: 'Isto substitui os dados atuais por dados fictícios.', ok: 'Carregar', perigo: true })) return;
    Store.dados = Demo.montar(); Store.salvar(); fecharFolha(true); irPara('visao');
    toast('Dados demo carregados');
  },

  'apagar-tudo': async () => {
    if (!await confirmar({ titulo: 'Apagar tudo?', texto: 'Todos os seus registros serão apagados deste dispositivo. Exporte antes se quiser guardar.', ok: 'Apagar tudo', perigo: true })) return;
    const tema = Store.dados.config.tema;
    Store.dados = estadoVazio(); Store.dados.config.tema = tema;
    Store.salvar(); fecharFolha(true); irPara('visao');
    toast('Tudo apagado');
  },
};

document.addEventListener('click', ev => {
  const abre = ev.target.closest('[data-abrir]');
  if (abre) { ev.preventDefault(); return abrir(abre.dataset.abrir, abre.dataset.id); }
  const b = ev.target.closest('[data-acao]');
  if (!b) return;
  const fn = ACOES[b.dataset.acao];
  if (fn) { ev.preventDefault(); fn(b); }
});

document.addEventListener('input', ev => {
  if (ev.target.id === 'busca') { filtros.texto = ev.target.value; render(); }
});

document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape' && pilhaModais.length) { ev.preventDefault(); fecharFolha(); }
});

document.addEventListener('DOMContentLoaded', () => {
  Store.carregar();
  aplicarTema();
  if (!(Store.dados.config.telaAtual in Telas)) Store.dados.config.telaAtual = 'visao';
  render();

  document.getElementById('mes-anterior').addEventListener('click', () => { Store.mes = addMeses(Store.mes, -1); render(); });
  document.getElementById('mes-proximo').addEventListener('click', () => { Store.mes = addMeses(Store.mes, 1); render(); });
  document.getElementById('mes-rotulo').addEventListener('click', () => folhaMes());

  const topo = document.getElementById('topo');
  addEventListener('scroll', () => topo.classList.toggle('preso', scrollY > 4), { passive: true });

  // outra aba mexeu nos dados: recarrega para nao sobrescrever
  addEventListener('storage', e => { if (e.key === CHAVE) { Store.carregar(); render(); } });
});

/* ===================== 13. IMPORTACAO DE EXTRATO ======================
   OFX e CSV lidos NO NAVEGADOR: o arquivo nao sobe para lugar nenhum, e
   nenhuma senha de banco entra aqui. O trabalho de verdade nao e ler o
   arquivo — e nao duplicar o que ja esta cadastrado. Por isso todo
   lancamento que bate com um item previsto do mes vira CONCILIACAO
   (marca como pago/recebido e acerta o valor), nao um registro novo.
   ===================================================================== */

/** Valor de extrato: "1.234,56" · "-1234.56" · "R$ 1.600,00" · "(350,00)" · "120,00 D" */
function valorExtrato(bruto) {
  if (typeof bruto === 'number') return bruto;
  let s = String(bruto == null ? '' : bruto).trim();
  if (!s) return NaN;
  let sinal = 1;
  if (/^\(.*\)$/.test(s)) { sinal = -1; s = s.slice(1, -1); }
  if (/\bD$/i.test(s.replace(/\s+/g, ' ').trim())) sinal = -1;          // debito
  s = s.replace(/[R$\s ]/gi, '').replace(/[CD]$/i, '');
  if (s.startsWith('-')) { sinal = -1; s = s.slice(1); }
  else if (s.startsWith('+')) s = s.slice(1);
  s = s.replace(/[^0-9.,]/g, '');
  if (!s) return NaN;
  const ultimaVirgula = s.lastIndexOf(','), ultimoPonto = s.lastIndexOf('.');
  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    // o separador decimal e o que aparece por ultimo; o outro e milhar
    const dec = Math.max(ultimaVirgula, ultimoPonto);
    s = s.slice(0, dec).replace(/[.,]/g, '') + '.' + s.slice(dec + 1).replace(/[.,]/g, '');
  } else if (ultimaVirgula >= 0) {
    s = s.length - ultimaVirgula - 1 <= 2 ? s.replace(',', '.') : s.replace(/,/g, '');
  } else if (ultimoPonto >= 0) {
    // "1.234" sem centavos e milhar; "1234.56" e decimal
    const casas = s.length - ultimoPonto - 1;
    s = (casas === 3 && s.split('.').every((p, i) => i === 0 || p.length === 3)) ? s.replace(/\./g, '') : s;
  }
  const n = parseFloat(s);
  return isNaN(n) ? NaN : n * sinal;
}

/** Data de extrato: "20260905120000[-3:BRT]" · "05/09/2026" · "2026-09-05" · "05/09/26" */
function dataExtrato(bruto) {
  const s = String(bruto == null ? '' : bruto).trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{4})(\d{2})(\d{2})/);                      // OFX: DTPOSTED
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);  // BR: dia primeiro
  if (m) {
    let ano = Number(m[3]);
    if (ano < 100) ano += 2000;
    const mes = Number(m[2]), dia = Number(m[1]);
    if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
    return `${ano}-${pad(mes)}-${pad(dia)}`;
  }
  return null;
}

/** MAIUSCULAS DO BANCO viram texto legivel. */
function titulo(s) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (!t || t !== t.toUpperCase() || !/[A-ZÀ-Ü]/.test(t)) return t;
  const menores = ['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'para', 'com'];
  return t.toLowerCase().split(' ').map((p, i) =>
    (i > 0 && menores.includes(p)) || /^\d+$/.test(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/* Palavras que aparecem no historico do banco e a categoria correspondente.
   Serve de chute inicial: quem decide e a pessoa, na tela de revisao. */
const PISTAS = [
  ['investimentos', 'Renda fixa', ['tesouro', 'cdb', 'aplicacao', 'aplic ', 'lci', 'lca', 'renda fixa', 'poupanca']],
  ['investimentos', 'Ações', ['clear', 'xp investimentos', 'rico investimentos', 'b3 ', 'corretora']],
  ['investimentos', 'Bitcoin', ['bitcoin', 'binance', 'mercado bitcoin', 'foxbit', 'cripto']],
  ['despesas', 'Moradia', ['aluguel', 'condominio', 'energia', 'eletropaulo', 'cemig', 'copel', 'enel', 'sabesp', 'agua', 'comgas', 'iptu']],
  ['despesas', 'Serviços', ['internet', 'vivo', 'claro', ' tim ', 'net ', 'netflix', 'spotify', 'assinatura', 'apple.com', 'google', 'amazon prime', 'microsoft']],
  ['despesas', 'Alimentação', ['mercado', 'supermerc', 'padaria', 'hortifruti', 'acougue', 'atacad', 'assai', 'carrefour', 'pao de acucar']],
  ['despesas', 'Restaurantes', ['ifood', 'restaurante', 'lanchonete', 'pizza', 'burger', 'cafe', 'rappi']],
  ['despesas', 'Transporte', ['uber', '99app', '99 ', 'posto', 'combustivel', 'gasolina', 'ipiranga', 'shell', 'estacion', 'pedagio', 'sem parar']],
  ['despesas', 'Saúde', ['farmacia', 'drogaria', 'droga', 'unimed', 'amil', 'clinica', 'laborat', 'hospital', 'odonto']],
  ['despesas', 'Lazer', ['cinema', 'academia', 'smartfit', 'ingresso', 'teatro', 'netshoes']],
  ['despesas', 'Compras', ['magalu', 'americanas', 'shopee', 'mercadolivre', 'mercado livre', 'shein', 'aliexpress', 'renner', 'riachuelo']],
  ['despesas', 'Educação', ['escola', 'faculdade', 'curso', 'udemy', 'alura']],
  ['despesas', 'Financiamento', ['financiamento', 'emprestimo', 'consignado', 'crediario', 'parcelamento']],
  ['despesas', 'Cartão', ['pagamento fatura', 'fatura cartao', 'pgto fatura']],
  ['entradas', 'Trabalho', ['salario', 'remuneracao', 'proventos', 'folha pagto', 'vencimento']],
  ['entradas', 'Investimentos', ['rendimento', 'dividendo', 'jcp', 'juros sobre capital', 'resgate']],
];

const Extrato = {
  /** OFX brasileiro costuma vir em windows-1252; UTF-8 quebra os acentos em silencio. */
  decodificar(buffer) {
    const utf8 = new TextDecoder('utf-8').decode(buffer);
    if (!utf8.includes('\uFFFD')) return utf8;   // \uFFFD = caractere de substituicao
    try { return new TextDecoder('windows-1252').decode(buffer); } catch (e) { return utf8; }
  },

  detectar(texto) {
    const cabeca = texto.slice(0, 2000).toUpperCase();
    return (cabeca.includes('<OFX') || cabeca.includes('OFXHEADER') || cabeca.includes('<STMTTRN>')) ? 'ofx' : 'csv';
  },

  lerOFX(texto) {
    const out = [];
    const blocos = texto.split(/<STMTTRN>/i).slice(1);
    for (const b of blocos) {
      const tag = nome => {
        const m = b.match(new RegExp('<' + nome + '>([^<\\r\\n]*)', 'i'));
        return m ? m[1].trim() : '';
      };
      const data = dataExtrato(tag('DTPOSTED'));
      const valor = valorExtrato(tag('TRNAMT'));
      if (!data || isNaN(valor)) continue;
      const desc = tag('MEMO') || tag('NAME') || tag('CHECKNUM') || 'Lançamento';
      out.push({ data, valor, descricao: titulo(desc), fitid: tag('FITID') || '' });
    }
    return out;
  },

  /** Divide uma linha de CSV respeitando aspas. */
  dividirLinha(linha, d) {
    const out = []; let atual = '', aspas = false;
    for (let i = 0; i < linha.length; i++) {
      const c = linha[i];
      if (c === '"') { if (aspas && linha[i + 1] === '"') { atual += '"'; i++; } else aspas = !aspas; }
      else if (c === d && !aspas) { out.push(atual); atual = ''; }
      else atual += c;
    }
    out.push(atual);
    return out.map(x => x.trim().replace(/^"|"$/g, ''));
  },

  lerCSV(texto) {
    const linhas = texto.split(/\r?\n/).filter(l => l.trim());
    if (!linhas.length) return [];
    // o separador e o candidato que mais aparece de forma consistente
    const d = [';', ',', '\t'].map(c => ({ c, n: linhas.slice(0, 10).reduce((s, l) => s + this.dividirLinha(l, c).length, 0) }))
      .sort((a, b) => b.n - a.n)[0].c;
    const grade = linhas.map(l => this.dividirLinha(l, d));

    const achaCol = (cols, re) => cols.findIndex(c => re.test(semAcento(c)));
    let cab = -1, col = {};
    for (let i = 0; i < Math.min(grade.length, 25); i++) {
      const c = grade[i];
      const dt = achaCol(c, /^data|^date/);
      if (dt >= 0 && c.length >= 2) {
        cab = i;
        col = {
          data: dt,
          desc: achaCol(c, /descri|histor|lancamento|memo|detalhe|estabelec|titulo|title|identificacao/),
          valor: achaCol(c, /^valor|amount|montante|quantia/),
          credito: achaCol(c, /credito|entrada|receita|^c$/),
          debito: achaCol(c, /debito|saida|despesa|^d$/),
        };
        break;
      }
    }
    // sem cabecalho reconhecivel: assume data na 1a coluna, valor na ultima
    let inicio = cab + 1;
    if (cab < 0) {
      const amostra = grade.find(c => dataExtrato(c[0]));
      if (!amostra) return [];
      col = { data: 0, desc: amostra.length > 2 ? 1 : -1, valor: amostra.length - 1, credito: -1, debito: -1 };
      inicio = 0;
    }

    const out = [];
    for (let i = inicio; i < grade.length; i++) {
      const c = grade[i];
      const data = dataExtrato(c[col.data]);
      if (!data) continue;
      let valor = NaN;
      if (col.valor >= 0) valor = valorExtrato(c[col.valor]);
      if (isNaN(valor) && (col.credito >= 0 || col.debito >= 0)) {
        const cr = col.credito >= 0 ? valorExtrato(c[col.credito]) : 0;
        const db = col.debito >= 0 ? valorExtrato(c[col.debito]) : 0;
        valor = (isNaN(cr) ? 0 : Math.abs(cr)) - (isNaN(db) ? 0 : Math.abs(db));
      }
      if (isNaN(valor) || valor === 0) continue;
      const desc = col.desc >= 0 ? c[col.desc] : (c.find((x, k) => k !== col.data && k !== col.valor && /[a-zà-ü]/i.test(x)) || 'Lançamento');
      out.push({ data, valor, descricao: titulo(desc), fitid: '' });
    }
    return out;
  },

  ler(texto) {
    const formato = this.detectar(texto);
    const lancamentos = formato === 'ofx' ? this.lerOFX(texto) : this.lerCSV(texto);
    return { formato, lancamentos };
  },

  /** Identidade de um lancamento, para nao importar duas vezes o mesmo. */
  chave(l) {
    return l.fitid
      ? 'f:' + l.fitid
      : `d:${l.data}|${cent(Math.abs(l.valor))}|${semAcento(l.descricao).replace(/[^a-z0-9]/g, '').slice(0, 24)}`;
  },

  sugerir(l) {
    const d = ' ' + semAcento(l.descricao) + ' ';
    for (const [colecao, categoria, palavras] of PISTAS) {
      if (palavras.some(p => d.includes(p))) {
        // a pista de entrada so vale para credito, e a de despesa so para debito
        if (colecao === 'entradas' && l.valor < 0) continue;
        if (colecao === 'despesas' && l.valor > 0) continue;
        return { colecao, categoria };
      }
    }
    const colecao = l.valor >= 0 ? 'entradas' : 'despesas';
    return { colecao, categoria: colecao === 'entradas' ? 'Outros' : 'Outros' };
  },

  /** Item ja cadastrado que este lancamento provavelmente quita. */
  conciliavel(l) {
    const mes = mesDeISO(l.data);
    const alvo = Math.abs(l.valor);
    const nome = semAcento(l.descricao);
    let melhor = null;
    for (const colecao of ['entradas', 'despesas', 'investimentos']) {
      if (colecao === 'entradas' && l.valor < 0) continue;
      if (colecao !== 'entradas' && l.valor > 0) continue;
      for (const r of Recorrencia.doMes(colecao, mes)) {
        const previsto = r.total;
        const dif = Math.abs(previsto - alvo);
        const parecido = nome.includes(semAcento(r.item.nome)) || semAcento(r.item.nome).includes(nome.slice(0, 8));
        // vale por valor quase igual, ou por nome parecido com valor na mesma ordem
        const casa = dif < 0.01 || (parecido && dif <= Math.max(previsto, alvo) * 0.35);
        if (!casa) continue;
        const nota = (dif < 0.01 ? 2 : 0) + (parecido ? 1 : 0);
        if (!melhor || nota > melhor.nota) melhor = { colecao, item: r.item, previsto, nota, jaFeito: r.status === 'realizado' };
      }
    }
    return melhor;
  },

  /** Prepara a revisao: decide o padrao de cada linha sem gravar nada. */
  preparar(lancamentos) {
    const jaImportados = Store.dados.importados || {};
    return lancamentos
      .sort((a, b) => a.data.localeCompare(b.data))
      .map(l => {
        const chave = this.chave(l);
        const repetido = !!jaImportados[chave];
        const conc = repetido ? null : this.conciliavel(l);
        const sug = this.sugerir(l);
        return {
          ...l, chave, repetido, conciliavel: conc,
          colecao: conc ? conc.colecao : sug.colecao,
          categoria: sug.categoria,
          acao: repetido ? 'ignorar' : (conc ? 'conciliar' : 'criar:' + sug.colecao),
        };
      });
  },

  /** Aplica as decisoes. Uma escrita so no localStorage, um render so. */
  aplicar(revisao) {
    const resumo = { criados: 0, conciliados: 0, ignorados: 0 };
    Store.mudar(d => {
      d.importados = d.importados || {};
      for (const l of revisao) {
        if (l.acao === 'ignorar') { resumo.ignorados++; continue; }
        const mes = mesDeISO(l.data);
        if (l.acao === 'conciliar' && l.conciliavel) {
          const item = d[l.conciliavel.colecao].find(x => x.id === l.conciliavel.item.id);
          if (item) {
            if (!item.ajustes) item.ajustes = {};
            const ajuste = { status: 'realizado' };
            // extrato manda no valor: o previsto era estimativa
            if (Math.abs(l.conciliavel.previsto - Math.abs(l.valor)) >= 0.01) ajuste.valor = cent(Math.abs(l.valor));
            item.ajustes[mes] = Object.assign({}, item.ajustes[mes], ajuste);
            resumo.conciliados++;
          }
        } else if (l.acao.startsWith('criar:')) {
          const colecao = l.acao.slice(6);
          d[colecao].unshift({
            id: uid(), criadoEm: new Date().toISOString(),
            nome: l.descricao.slice(0, 70) || 'Lançamento',
            categoria: l.categoria,
            tipo: colecao === 'investimentos' ? 'fixa' : 'variavel',
            valor: cent(Math.abs(l.valor)),
            frequencia: 'unica',
            dia: diaDe(l.data),
            inicio: mes, fim: null,
            status: 'realizado',
            pagamento: colecao === 'despesas' ? 'Débito' : undefined,
            obs: 'Importado do extrato',
            ajustes: {},
          });
          resumo.criados++;
        }
        d.importados[l.chave] = true;
      }
    });
    return resumo;
  },
};

/* ------------------------ telas da importacao ------------------------ */

let revisaoAtual = [];

function folhaImportarExtrato() {
  fecharFolha(true);
  abrirFolha({
    titulo: 'Importar extrato',
    corpo: `
      <p style="font-size:13.5px;color:var(--tinta-2);line-height:1.55">
        Exporte o extrato no aplicativo do seu banco — procure por <b>OFX</b> (às vezes aparece como
        "extrato para gerenciador financeiro", Money ou Quicken) ou <b>CSV</b>. A fatura do cartão também serve.
      </p>
      <div style="height:12px"></div>
      <div class="aviso frio">${ic('escudo', 16)} O arquivo é lido aqui no seu navegador. Nada é enviado para servidor nenhum, e este aplicativo nunca pede a senha do seu banco.</div>
      <div style="height:14px"></div>
      <div class="campo">
        <label for="arq-extrato">Arquivo .ofx ou .csv</label>
        <input type="file" id="arq-extrato" accept=".ofx,.csv,.txt,text/csv,application/x-ofx">
      </div>
      <div class="campo">
        <label for="texto-extrato">Ou cole o conteúdo</label>
        <textarea class="texto-json" id="texto-extrato" placeholder="data;descrição;valor&#10;05/09/2026;ALUGUEL;-1600,00"></textarea>
      </div>
      <p class="dica" id="aviso-extrato"></p>`,
    pe: `<button type="button" class="btn" data-acao="fechar-folha">Cancelar</button>
         <button type="button" class="btn btn-primario" id="btn-ler-extrato">Ler lançamentos</button>`,
    aoMontar: tela => {
      const area = tela.querySelector('#texto-extrato');
      const aviso = tela.querySelector('#aviso-extrato');
      tela.querySelector('#arq-extrato').addEventListener('change', ev => {
        const f = ev.target.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = () => {
          area.value = Extrato.decodificar(r.result);
          const { formato, lancamentos } = Extrato.ler(area.value);
          aviso.textContent = `${f.name} · ${formato.toUpperCase()} · ${lancamentos.length} lançamento(s) encontrado(s)`;
        };
        r.readAsArrayBuffer(f);
      });
      tela.querySelector('#btn-ler-extrato').addEventListener('click', () => {
        const texto = area.value.trim();
        if (!texto) return toast('Escolha um arquivo ou cole o conteúdo');
        const { lancamentos } = Extrato.ler(texto);
        if (!lancamentos.length) return toast('Não encontrei lançamentos neste arquivo');
        revisaoAtual = Extrato.preparar(lancamentos);
        folhaRevisarExtrato();
      });
    },
  });
}

const opcoesCategoriaHTML = (colecao, valor) =>
  CATEGORIAS[colecao].map(c => `<option value="${esc(c)}" ${c === valor ? 'selected' : ''}>${esc(c)}</option>`).join('');

function folhaRevisarExtrato() {
  const linhas = revisaoAtual.map((l, i) => {
    const neg = l.valor < 0;
    const conc = l.conciliavel;
    return `<div class="lanc" data-i="${i}" data-acao-atual="${esc(l.acao)}">
      <div class="lanc-topo">
        <span class="lanc-data num">${esc(l.data.slice(8, 10))}/${esc(l.data.slice(5, 7))}</span>
        <span class="lanc-desc">${esc(l.descricao)}</span>
        <span class="lanc-valor num ${neg ? 'neg' : 'pos'}">${neg ? '−' : '+'}${brlCurto(Math.abs(l.valor))}</span>
      </div>
      ${l.repetido ? `<div class="lanc-nota">já importado antes</div>` : ''}
      ${conc ? `<div class="lanc-nota">bate com <b>${esc(conc.item.nome)}</b>, previsto ${brlCurto(conc.previsto)}${conc.jaFeito ? ' (já marcado)' : ''}</div>` : ''}
      <div class="lanc-acoes">
        <select data-campo="acao" aria-label="O que fazer com ${esc(l.descricao)}">
          ${conc ? `<option value="conciliar" ${l.acao === 'conciliar' ? 'selected' : ''}>Conciliar com ${esc(conc.item.nome)}</option>` : ''}
          <option value="criar:entradas" ${l.acao === 'criar:entradas' ? 'selected' : ''}>Criar entrada</option>
          <option value="criar:despesas" ${l.acao === 'criar:despesas' ? 'selected' : ''}>Criar despesa</option>
          <option value="criar:investimentos" ${l.acao === 'criar:investimentos' ? 'selected' : ''}>Criar investimento</option>
          <option value="ignorar" ${l.acao === 'ignorar' ? 'selected' : ''}>Ignorar</option>
        </select>
        <select data-campo="categoria" class="so-criar" aria-label="Categoria">${opcoesCategoriaHTML(l.colecao, l.categoria)}</select>
      </div>
    </div>`;
  }).join('');

  abrirFolha({
    titulo: `${revisaoAtual.length} lançamento(s)`,
    corpo: `
      <div class="aviso frio" id="resumo-revisao"></div>
      <div style="height:6px"></div>
      <div class="linha-botoes" style="margin-bottom:6px">
        <button type="button" class="btn btn-pequeno" data-massa="criar">Criar todos os novos</button>
        <button type="button" class="btn btn-pequeno" data-massa="ignorar">Ignorar todos</button>
      </div>
      <div class="lista-lanc">${linhas}</div>`,
    pe: `<button type="button" class="btn" data-acao="fechar-folha">Cancelar</button>
         <button type="button" class="btn btn-primario" id="btn-aplicar-extrato">Importar</button>`,
    aoMontar: tela => {
      const resumo = tela.querySelector('#resumo-revisao');
      const botao = tela.querySelector('#btn-aplicar-extrato');
      const atualizar = () => {
        const c = revisaoAtual.filter(l => l.acao.startsWith('criar:')).length;
        const k = revisaoAtual.filter(l => l.acao === 'conciliar').length;
        const g = revisaoAtual.filter(l => l.acao === 'ignorar').length;
        resumo.innerHTML = `${ic('check', 15)} <span>${c} a criar · ${k} a conciliar · ${g} ignorado(s)</span>`;
        botao.textContent = c + k ? `Importar ${c + k}` : 'Nada a importar';
        botao.disabled = !(c + k);
      };
      atualizar();

      tela.addEventListener('change', ev => {
        const sel = ev.target.closest('[data-campo]');
        if (!sel) return;
        const linha = sel.closest('.lanc');
        const l = revisaoAtual[Number(linha.dataset.i)];
        l[sel.dataset.campo] = sel.value;
        if (sel.dataset.campo === 'acao') {
          linha.dataset.acaoAtual = sel.value;
          if (sel.value.startsWith('criar:')) {
            l.colecao = sel.value.slice(6);
            if (!CATEGORIAS[l.colecao].includes(l.categoria)) l.categoria = 'Outros';
            linha.querySelector('[data-campo="categoria"]').innerHTML = opcoesCategoriaHTML(l.colecao, l.categoria);
          }
          atualizar();
        }
      });

      tela.querySelectorAll('[data-massa]').forEach(b => b.addEventListener('click', () => {
        const modo = b.dataset.massa;
        revisaoAtual.forEach((l, i) => {
          if (l.repetido && modo === 'criar') return;
          l.acao = modo === 'ignorar' ? 'ignorar' : (l.conciliavel ? 'conciliar' : 'criar:' + l.colecao);
          const linha = tela.querySelector(`.lanc[data-i="${i}"]`);
          linha.dataset.acaoAtual = l.acao;
          linha.querySelector('[data-campo="acao"]').value = l.acao;
        });
        atualizar();
      }));

      botao.addEventListener('click', () => {
        const r = Extrato.aplicar(revisaoAtual);
        fecharFolha(true);
        toast(`${r.criados} criado(s) · ${r.conciliados} conciliado(s)`);
      });
    },
  });
}

/* ===================== 14. SIMULADOR DE PATRIMONIO =====================
   Aritmetica sobre premissa que a PESSOA escolheu. Nao e previsao, nao e
   recomendacao, e o aplicativo nao sugere taxa de lugar nenhum: os valores
   que vem preenchidos sao ponto de partida redondo, ditos como tais na tela.
   Quem decide quanto rende e quem vai assumir o risco.
   ===================================================================== */

const HORIZONTES = [12, 24, 36, 60, 120];
const CENARIOS = [
  { k: 'pessimista', r: 'Pessimista' },
  { k: 'moderado', r: 'Moderado' },
  { k: 'otimista', r: 'Otimista' },
];

const Projecao = {
  /** Taxa anual em taxa mensal equivalente (juros compostos, nao divisao por 12). */
  mensal(anual) { return Math.pow(1 + Number(anual || 0) / 100, 1 / 12) - 1; },

  /** Valor futuro de um saldo inicial mais aportes mensais no fim de cada mes. */
  em(meses, p) {
    const i = this.mensal(p.taxa);
    const n = Math.max(0, Math.round(meses));
    const inicial = Number(p.inicial || 0), aporte = Number(p.aporte || 0);
    const f = Math.pow(1 + i, n);
    const bruto = Math.abs(i) < 1e-12 ? inicial + aporte * n : inicial * f + aporte * (f - 1) / i;
    const aportado = inicial + aporte * n;
    const rendimento = bruto - aportado;
    // imposto so incide sobre ganho, e so se houver ganho
    const imposto = Math.max(0, rendimento) * (Number(p.imposto || 0) / 100);
    const liquido = bruto - imposto;
    const real = liquido / Math.pow(1 + Number(p.inflacao || 0) / 100, n / 12);
    return { meses: n, bruto, aportado, rendimento, imposto, liquido, real };
  },

  /** Um ponto por ano, com o ganho daquele ano isolado. */
  anoAano(p, anos) {
    const linhas = [];
    let anterior = this.em(0, p);
    for (let a = 1; a <= anos; a++) {
      const atual = this.em(a * 12, p);
      linhas.push({
        ano: a,
        ...atual,
        ganhoNoAno: atual.bruto - anterior.bruto - Number(p.aporte || 0) * 12,
        aportadoNoAno: Number(p.aporte || 0) * 12,
      });
      anterior = atual;
    }
    return linhas;
  },

  /** O ano em que o rendimento passa a superar o que voce deposita. */
  virada(p, limite = 40) {
    if (!Number(p.aporte)) return null;
    const linhas = this.anoAano(p, limite);
    const achado = linhas.find(l => l.ganhoNoAno > l.aportadoNoAno);
    return achado ? achado.ano : null;
  },
};

/** Premissas vigentes: o que a pessoa salvou, caindo nos dados dela quando vazio. */
function premissas() {
  const s = Store.dados.simulador || {};
  const patr = Calc.patrimonioTotal();
  const t = Calc.totais(Store.mes);
  return {
    inicial: s.inicial != null ? Number(s.inicial) : patr,
    aporte: s.aporte != null ? Number(s.aporte) : Math.max(0, t.investimentos_total + Math.max(0, t.saldo)),
    taxas: Object.assign({ pessimista: 4, moderado: 8, otimista: 12 }, s.taxas),
    inflacao: s.inflacao != null ? Number(s.inflacao) : 4,
    imposto: s.imposto != null ? Number(s.imposto) : 15,
    cenario: s.cenario || 'moderado',
    daPessoa: s.inicial != null || s.aporte != null,
  };
}

const paraProjecao = (pr, cenario) => ({
  inicial: pr.inicial, aporte: pr.aporte,
  taxa: pr.taxas[cenario], inflacao: pr.inflacao, imposto: pr.imposto,
});

function cartaoSimulador({ compacto = false } = {}) {
  const pr = premissas();
  const cen = pr.cenario;
  const p = paraProjecao(pr, cen);
  const virada = Projecao.virada(p);

  // a taxa nao cabe dentro do botao a 375px: ela vai na linha de baixo, do cenario escolhido
  const segmentado = `<div class="segmentado">${CENARIOS.map(c =>
    `<button type="button" data-acao="cenario" data-valor="${c.k}" aria-pressed="${cen === c.k}">${c.r}</button>`).join('')}</div>
    <p class="dica" style="margin:-4px 0 10px">Rendendo <b>${String(pr.taxas[cen]).replace('.', ',')}% ao ano</b>, premissa sua.</p>`;

  const horizontes = compacto ? [12, 60, 120] : HORIZONTES;
  const linhas = horizontes.map(m => {
    const r = Projecao.em(m, p);
    const anos = m / 12;
    return `<div class="fluxo-linha">
      <span class="fl-nome">
        <span class="n">${anos === 1 ? '1 ano' : anos + ' anos'}</span>
        <div class="barra fina" title="parte que veio de rendimento"><i style="width:${Math.min(100, Math.max(0, pct(Math.max(0, r.rendimento), r.bruto, 1)))}%;background:var(--positivo)"></i></div>
        <span class="p">você depositou ${brlCurto(r.aportado)} · rendeu ${brlCurto(r.rendimento)}</span>
      </span>
      <span class="fl-valor">
        <span class="v num">${brlCurto(r.liquido)}</span>
        <span class="p num">${brlCurto(r.real)} em dinheiro de hoje</span>
      </span>
    </div>`;
  }).join('');

  return cartao(`
    <div class="aviso frio" style="margin-bottom:12px">
      ${ic('escudo', 16)}
      <span>As taxas abaixo são <b>premissas suas</b>, não previsão e não recomendação. Nenhum investimento garante retorno.</span>
    </div>
    ${compacto
      ? `<p class="dica" style="margin-bottom:10px">Partindo de <b class="num">${brlCurto(pr.inicial)}</b> e guardando <b class="num">${brlCurto(pr.aporte)}</b> por mês.</p>`
      : `<div class="grade-metricas" style="grid-template-columns:1fr 1fr;margin-bottom:12px">
      <div class="metrica">
        <div class="rotulo">Começando com</div>
        <div class="v num">${brlCurto(pr.inicial)}</div>
        <div class="ajuda">${pr.daPessoa ? 'definido por você' : 'seu patrimônio cadastrado'}</div>
      </div>
      <div class="metrica">
        <div class="rotulo">Aporte mensal</div>
        <div class="v num">${brlCurto(pr.aporte)}</div>
        <div class="ajuda">${pr.daPessoa ? 'definido por você' : 'sua sobra do mês'}</div>
      </div>
    </div>`}
    ${segmentado}
    ${linhas}
    ${virada ? `<div class="aviso frio" style="margin-top:12px">${ic('grafico', 16)}
        <span>No <b>ano ${virada}</b> o rendimento passa a ser maior que tudo o que você deposita no ano.</span></div>`
      : `<div class="dica" style="margin-top:12px">Com estas premissas o rendimento não ultrapassa o aporte dentro de 40 anos.</div>`}
    <div class="linha-botoes" style="margin-top:12px">
      <button class="btn btn-pequeno" data-acao="premissas">Ajustar premissas</button>
      ${compacto
        ? `<button class="btn btn-pequeno btn-fantasma" data-acao="tela" data-tela="plano">Simulador completo</button>`
        : `<button class="btn btn-pequeno btn-fantasma" data-acao="ano-a-ano">Ver ano a ano</button>`}
    </div>
    <p class="dica" style="margin-top:10px">
      ${compacto
        ? `"Em dinheiro de hoje" é o valor depois de descontar a inflação de ${String(pr.inflacao).replace('.', ',')}% ao ano.`
        : `Imposto de ${String(pr.imposto).replace('.', ',')}% sobre o rendimento e inflação de ${String(pr.inflacao).replace('.', ',')}% ao ano,
      as duas também premissas suas. "Em dinheiro de hoje" é o valor depois de descontar a inflação.`}
    </p>`,
    { titulo: compacto ? 'Onde isso chega' : 'Simulador de patrimônio' });
}

function folhaPremissas() {
  const pr = premissas();
  const num = v => String(v).replace('.', ',');
  abrirFolha({
    titulo: 'Premissas da simulação',
    corpo: `<form class="form" id="form-premissas">
      ${F.dinheiro({ nome: 'inicial', rotulo: 'Começando com', valor: pr.inicial, dica: 'Deixe em branco para usar o patrimônio que você cadastrou.' })}
      ${F.dinheiro({ nome: 'aporte', rotulo: 'Aporte mensal', valor: pr.aporte, dica: 'Deixe em branco para usar a sobra do mês.' })}
      <div class="campo">
        <label>Quanto você assume que rende, ao ano</label>
        <span class="dica">Três cenários para o mesmo dinheiro. Estes números são seus: o aplicativo não sugere taxa, não conhece o mercado de hoje e não sabe o que o seu investimento vai render.</span>
      </div>
      ${F.dupla(
        F.texto({ nome: 'pessimista', rotulo: 'Pessimista (% a.a.)', valor: num(pr.taxas.pessimista), attrs: 'inputmode="decimal"' }),
        F.texto({ nome: 'moderado', rotulo: 'Moderado (% a.a.)', valor: num(pr.taxas.moderado), attrs: 'inputmode="decimal"' })
      )}
      ${F.dupla(
        F.texto({ nome: 'otimista', rotulo: 'Otimista (% a.a.)', valor: num(pr.taxas.otimista), attrs: 'inputmode="decimal"' }),
        F.texto({ nome: 'inflacao', rotulo: 'Inflação (% a.a.)', valor: num(pr.inflacao), attrs: 'inputmode="decimal"' })
      )}
      ${F.texto({ nome: 'imposto', rotulo: 'Imposto sobre o rendimento (%)', valor: num(pr.imposto), attrs: 'inputmode="decimal"', dica: 'Cobrado no resgate, sobre o ganho. A alíquota muda conforme o produto e o prazo: confira a do seu.' })}
    </form>`,
    pe: `<button type="button" class="btn" data-acao="premissas-padrao">Voltar ao padrão</button>
         <button type="submit" form="form-premissas" class="btn btn-primario">Salvar</button>`,
    aoMontar: tela => {
      tela.querySelector('#form-premissas').addEventListener('submit', ev => {
        ev.preventDefault();
        const d = Object.fromEntries(new FormData(ev.target).entries());
        const vazio = v => String(v || '').trim() === '';
        Store.mudar(s => {
          s.simulador = {
            inicial: vazio(d.inicial) ? null : paraNumero(d.inicial),
            aporte: vazio(d.aporte) ? null : paraNumero(d.aporte),
            taxas: {
              pessimista: paraNumero(d.pessimista),
              moderado: paraNumero(d.moderado),
              otimista: paraNumero(d.otimista),
            },
            inflacao: paraNumero(d.inflacao),
            imposto: paraNumero(d.imposto),
            cenario: pr.cenario,
          };
        });
        toast('Premissas salvas');
        fecharFolha();
      });
      tela.querySelector('[data-acao="premissas-padrao"]').addEventListener('click', () => {
        Store.mudar(s => { s.simulador = {}; });
        toast('Premissas voltaram ao padrão');
        fecharFolha();
      });
    },
  });
}

function folhaAnoAano() {
  const pr = premissas();
  const p = paraProjecao(pr, pr.cenario);
  const linhas = Projecao.anoAano(p, 10);
  const nome = (CENARIOS.find(c => c.k === pr.cenario) || CENARIOS[1]).r;

  abrirFolha({
    titulo: `Ano a ano · ${nome}`,
    corpo: `
      <p class="dica">Rendendo ${String(pr.taxas[pr.cenario]).replace('.', ',')}% ao ano, premissa sua. A coluna da direita é o valor já descontada a inflação.</p>
      <div style="height:12px"></div>
      <div class="lista">
        ${linhas.map(l => `<div class="item" style="padding:11px 0">
          <span class="item-corpo">
            <span class="item-nome">Ano ${l.ano}</span>
            <span class="item-meta">
              <span>depositou ${brlCurto(l.aportadoNoAno)}</span>
              <span>·</span>
              <span class="${l.ganhoNoAno >= l.aportadoNoAno ? 'pos' : ''}">rendeu ${brlCurto(l.ganhoNoAno)}</span>
            </span>
          </span>
          <span class="item-lado" style="text-align:right">
            <span>
              <span class="item-valor num" style="display:block;cursor:default">${brlCurto(l.liquido)}</span>
              <span class="p num cinza" style="font-size:11.5px">${brlCurto(l.real)} de hoje</span>
            </span>
          </span>
        </div>`).join('')}
      </div>
      <div style="height:14px"></div>
      <div class="aviso frio">${ic('escudo', 16)}
        <span>Simulação não é promessa. Rendimento varia, pode ser negativo, e o resultado real depende do que você escolher investir.</span></div>`,
  });
}
