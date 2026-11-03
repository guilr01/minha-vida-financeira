/* Conferencia do simulador fora do navegador. */
import fs from 'node:fs';

const memoria = new Map();
const falso = () => ({
  textContent: '', innerHTML: '', value: '', files: [], style: {}, dataset: {},
  classList: { toggle() {}, add() {}, remove() {} },
  addEventListener() {}, focus() {}, setAttribute() {}, removeAttribute() {}, getAttribute() { return null; },
  querySelector() { return falso(); }, querySelectorAll() { return []; }, appendChild() {}, remove() {},
  setSelectionRange() {}, select() {},
});
globalThis.localStorage = { getItem: k => (memoria.has(k) ? memoria.get(k) : null), setItem: (k, v) => memoria.set(k, v), removeItem: k => memoria.delete(k) };
globalThis.document = Object.assign(falso(), { getElementById: falso, createElement: falso, body: falso(), addEventListener() {}, activeElement: null });
globalThis.window = { matchMedia: () => ({ matches: false }) };
globalThis.addEventListener = () => {};

const src = fs.readFileSync('app.js', 'utf8');
const ctx = {};
new Function('with(this){' + src + '\n; this._api={Store,Calc,Telas,Projecao,premissas,paraProjecao,cartaoSimulador,HORIZONTES,mesDeHoje};}').call(ctx);
const { Store, Telas, Projecao, premissas, paraProjecao, cartaoSimulador, mesDeHoje } = ctx._api;

let falhas = 0, testes = 0;
const ok = (nome, cond, extra = '') => { testes++; if (!cond) { falhas++; console.log('  FALHOU  ' + nome + (extra ? ' -> ' + extra : '')); } else console.log('  ok      ' + nome); };
const perto = (a, b, tol = 0.01) => Math.abs(a - b) < tol;

Store.carregar();

console.log('\n— taxa mensal equivalente —');
const i8 = Projecao.mensal(8);
ok('12 meses da taxa mensal voltam a 8% ao ano', perto(Math.pow(1 + i8, 12) - 1, 0.08, 1e-12), String(Math.pow(1 + i8, 12) - 1));
ok('nao e divisao por 12 (seria 0,6667%)', !perto(i8 * 100, 8 / 12, 1e-4), (i8 * 100).toFixed(4) + '%');
ok('taxa zero da mensal zero', Projecao.mensal(0) === 0);

console.log('\n— valor futuro —');
const base = { inicial: 10000, aporte: 3000, inflacao: 0, imposto: 0 };
const semJuros = Projecao.em(12, { ...base, taxa: 0 });
ok('sem juros, 10.000 + 12x3.000 = 46.000 exatos', semJuros.bruto === 46000, String(semJuros.bruto));
ok('sem juros o rendimento e exatamente zero', semJuros.rendimento === 0);
ok('aportado = inicial + aporte x meses', semJuros.aportado === 46000);

const r12 = Projecao.em(12, { ...base, taxa: 8 });
ok('com juros rende mais que o depositado', r12.bruto > r12.aportado);
ok('rendimento = bruto - aportado', perto(r12.rendimento, r12.bruto - r12.aportado, 1e-9));
const r120 = Projecao.em(120, { ...base, taxa: 8 });
ok('horizonte maior, patrimonio maior', r120.bruto > r12.bruto);
ok('taxa maior, patrimonio maior', Projecao.em(120, { ...base, taxa: 12 }).bruto > r120.bruto);
ok('meses zero devolve o saldo inicial', Projecao.em(0, { ...base, taxa: 8 }).bruto === 10000);

console.log('\n— formula conferida contra soma mes a mes —');
let manual = 10000;
const im = Projecao.mensal(8);
for (let k = 0; k < 120; k++) manual = manual * (1 + im) + 3000;
ok('a formula fechada bate com 120 iteracoes', perto(manual, r120.bruto, 0.01), `${manual.toFixed(2)} vs ${r120.bruto.toFixed(2)}`);

console.log('\n— imposto —');
const comImposto = Projecao.em(120, { ...base, taxa: 8, imposto: 15 });
ok('imposto incide so sobre o rendimento', perto(comImposto.imposto, comImposto.rendimento * 0.15));
ok('liquido = bruto - imposto', perto(comImposto.liquido, comImposto.bruto - comImposto.imposto));
ok('imposto nao muda o bruto', perto(comImposto.bruto, r120.bruto));
const prejuizo = Projecao.em(60, { inicial: 10000, aporte: 0, taxa: -5, inflacao: 0, imposto: 15 });
ok('rendimento negativo nao gera imposto negativo', prejuizo.imposto === 0, String(prejuizo.imposto));
ok('taxa negativa encolhe o patrimonio', prejuizo.bruto < 10000);

console.log('\n— inflacao: nominal nao e real —');
const comInflacao = Projecao.em(120, { ...base, taxa: 8, imposto: 0, inflacao: 4 });
ok('valor real e menor que o nominal', comInflacao.real < comInflacao.liquido);
ok('real = liquido descontada a inflacao dos 10 anos', perto(comInflacao.real, comInflacao.liquido / Math.pow(1.04, 10)));
const semInflacao = Projecao.em(120, { ...base, taxa: 8, imposto: 0, inflacao: 0 });
ok('inflacao zero deixa real igual a liquido', perto(semInflacao.real, semInflacao.liquido));
const empatado = Projecao.em(120, { inicial: 1000, aporte: 0, taxa: 5, imposto: 0, inflacao: 5 });
ok('rendendo igual a inflacao, o real fica parado', perto(empatado.real, 1000, 0.5), String(empatado.real.toFixed(2)));

console.log('\n— ano a ano —');
const anos = Projecao.anoAano({ ...base, taxa: 8, imposto: 15, inflacao: 4 }, 10);
ok('dez linhas', anos.length === 10);
ok('a decima linha e igual a projecao de 120 meses', perto(anos[9].bruto, r120.bruto));
const somaGanhos = anos.reduce((s, l) => s + l.ganhoNoAno, 0);
ok('soma dos ganhos + depositos = patrimonio bruto', perto(somaGanhos + 10000 + 3000 * 120, r120.bruto, 0.02),
   `${(somaGanhos + 10000 + 3000 * 120).toFixed(2)} vs ${r120.bruto.toFixed(2)}`);
ok('ganho do ano cresce ano a ano', anos[9].ganhoNoAno > anos[0].ganhoNoAno);
ok('deposito do ano e sempre 36.000', anos.every(l => l.aportadoNoAno === 36000));

console.log('\n— a virada dos juros —');
const pv = { ...base, taxa: 8, imposto: 15, inflacao: 4 };
const virada = Projecao.virada(pv);
const linhas40 = Projecao.anoAano(pv, 40);
ok('encontra um ano', typeof virada === 'number', String(virada));
ok('naquele ano o rendimento supera o deposito', linhas40[virada - 1].ganhoNoAno > linhas40[virada - 1].aportadoNoAno);
ok('no ano anterior ainda nao superava', virada === 1 || linhas40[virada - 2].ganhoNoAno <= linhas40[virada - 2].aportadoNoAno);
ok('sem aporte nenhum nao ha virada a calcular', Projecao.virada({ ...pv, aporte: 0 }) === null);
ok('taxa zero nunca vira', Projecao.virada({ ...pv, taxa: 0 }) === null);

console.log('\n— premissas saem dos dados da pessoa —');
const pr = premissas();
ok('comeca com o patrimonio cadastrado', perto(pr.inicial, Calc_patrimonio()), `${pr.inicial}`);
function Calc_patrimonio() { return ctx._api.Calc.patrimonioTotal(); }
ok('tres cenarios preenchidos', [pr.taxas.pessimista, pr.taxas.moderado, pr.taxas.otimista].every(t => typeof t === 'number'));
ok('cenario padrao e o moderado', pr.cenario === 'moderado');
Store.mudar(d => { d.simulador = { inicial: 10000, aporte: 3000, taxas: { pessimista: 4, moderado: 8, otimista: 12 }, inflacao: 4, imposto: 15, cenario: 'otimista' }; });
const pr2 = premissas();
ok('o que a pessoa salva vence o padrao', pr2.inicial === 10000 && pr2.aporte === 3000 && pr2.cenario === 'otimista');
ok('marca que os valores sao dela', pr2.daPessoa === true);
Store.mudar(d => { d.simulador = {}; });
ok('voltar ao padrao limpa a escolha', premissas().daPessoa === false);

console.log('\n— a tela —');
const html = cartaoSimulador();
ok('o cartao renderiza', html.length > 500 && !html.includes('undefined') && !html.includes('NaN'));
ok('diz que a taxa e premissa da pessoa', html.includes('premissas suas'));
ok('diz que nao e previsao nem recomendacao', html.includes('não previsão') && html.includes('não recomendação'));
ok('avisa que retorno nao e garantido', html.includes('Nenhum investimento garante retorno'));
ok('mostra os cinco horizontes', ['1 ano', '2 anos', '3 anos', '5 anos', '10 anos'].every(t => html.includes(t)));
ok('separa dinheiro de hoje do nominal', html.includes('em dinheiro de hoje'));
const plano = Telas.plano(mesDeHoje());
ok('o simulador aparece no Planejamento', plano.includes('Simulador de patrimônio'));
ok('a tela inteira nao quebra', plano.length > 2000 && !plano.includes('undefined'));

console.log('\n— app vazio —');
Store.dados = ctx._api.Store.dados;
memoria.clear();
Store.dados = Object.assign(Store.dados, { entradas: [], despesas: [], investimentos: [], patrimonio: [], metas: [], cartoes: [], compras: [], simulador: {} });
const vazio = cartaoSimulador();
ok('sem dado nenhum nao gera NaN', !vazio.includes('NaN') && !vazio.includes('undefined'));
ok('comeca do zero sem quebrar', vazio.includes('R$'));

console.log(`\n${testes - falhas}/${testes} conferencias passaram${falhas ? ' — ' + falhas + ' FALHA(S)' : ''}\n`);
process.exit(falhas ? 1 : 0);
