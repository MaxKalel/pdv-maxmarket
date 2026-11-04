/**
 * Camada de acesso aos dados do PDV.
 *
 * Hoje tudo fica em memória (arquivo mock.ts). Para integrar o banco,
 * troque o corpo de cada função pela chamada correspondente (marcado com
 * "BANCO:"). As telas só falam com estas funções.
 */
import type { Caixa, Cancelamento, FormaPagamento, ItemVenda, Movimentacao, Produto, TipoMovimentacao, Venda } from "@/types";
import { caixasMock, cancelamentosMock, movimentacoesMock, OPERADOR_PADRAO, produtosMock, vendasMock } from "./mock";
import { calcularResumo, type ResumoCaixa } from "@/regras/caixa";

const novoId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const agora = () => new Date().toISOString();
const copia = <T,>(o: T): T => structuredClone(o);

export const obterOperador = () => OPERADOR_PADRAO;

// ---------- Produtos ----------

/** BANCO: SELECT * FROM produtos WHERE codigo_barras = $1 */
export function buscarProdutoPorCodigo(codigo: string): Produto | null {
  const p = produtosMock.find((p) => p.codigoBarras === codigo.trim());
  return p ? copia(p) : null;
}

/** BANCO: SELECT ... WHERE nome ILIKE '%termo%' OR codigo_barras LIKE 'termo%' */
export function pesquisarProdutos(termo: string): Produto[] {
  const t = termo.trim().toLowerCase();
  const lista = t
    ? produtosMock.filter((p) => p.nome.toLowerCase().includes(t) || p.codigoBarras.includes(t))
    : produtosMock;
  return copia(lista.slice(0, 50));
}

/** BANCO: SELECT estoque FROM produtos WHERE id = $1 */
export function obterEstoque(produtoId: string): number {
  return produtosMock.find((p) => p.id === produtoId)?.estoque ?? 0;
}

// ---------- Caixa ----------

/** BANCO: SELECT * FROM caixas WHERE status = 'aberto' LIMIT 1 */
export function obterCaixaAtual(): Caixa | null {
  const c = caixasMock.find((c) => c.status === "aberto");
  return c ? copia(c) : null;
}

/** BANCO: INSERT INTO caixas (...) */
export function abrirCaixa(valorInicial: number): Caixa {
  if (obterCaixaAtual()) throw new Error("Já existe um caixa aberto.");
  if (valorInicial < 0) throw new Error("Valor inicial não pode ser negativo.");
  const caixa: Caixa = {
    id: novoId(), operador: OPERADOR_PADRAO, status: "aberto", valorInicial,
    abertoEm: agora(), fechadoEm: null, valorEsperado: null, valorContado: null, diferenca: null,
  };
  caixasMock.push(caixa);
  return copia(caixa);
}

/** BANCO: UPDATE caixas SET status='fechado', ... WHERE id = $1 */
export function fecharCaixa(caixaId: string, valorEsperado: number, valorContado: number, diferenca: number): Caixa {
  const c = caixasMock.find((c) => c.id === caixaId);
  if (!c || c.status !== "aberto") throw new Error("Caixa não está aberto.");
  Object.assign(c, { status: "fechado", fechadoEm: agora(), valorEsperado, valorContado, diferenca });
  return copia(c);
}

/** BANCO: SELECT agregado de movimentações e vendas do caixa */
export function obterResumoCaixa(caixaId: string): ResumoCaixa {
  const c = caixasMock.find((c) => c.id === caixaId)!;
  return calcularResumo(
    c.valorInicial,
    movimentacoesMock.filter((m) => m.caixaId === caixaId),
    vendasMock.filter((v) => v.caixaId === caixaId),
  );
}

/** BANCO: INSERT INTO movimentacoes (...) */
export function registrarMovimentacao(caixaId: string, tipo: TipoMovimentacao, valor: number, motivo: string): Movimentacao {
  const m: Movimentacao = { id: novoId(), caixaId, tipo, valor, motivo, criadoEm: agora() };
  movimentacoesMock.push(m);
  return copia(m);
}

/** BANCO: INSERT INTO cancelamentos (...) */
export function registrarCancelamento(caixaId: string, item: ItemVenda): Cancelamento {
  const c: Cancelamento = {
    id: novoId(), caixaId, codigo: item.codigo, nome: item.nome,
    quantidade: item.quantidade, valor: item.subtotal, criadoEm: agora(),
  };
  cancelamentosMock.push(c);
  return copia(c);
}

// ---------- Vendas ----------

/** Confere o estoque de todos os itens. Retorna o primeiro item sem estoque. */
export function conferirEstoqueItens(itens: ItemVenda[]): { item: ItemVenda; disponivel: number } | null {
  for (const item of itens) {
    const disponivel = obterEstoque(item.produtoId);
    if (item.quantidade > disponivel) return { item, disponivel };
  }
  return null;
}

/**
 * Grava a venda e baixa o estoque, tudo junto.
 * BANCO: isto PRECISA ser uma transação (BEGIN ... COMMIT), com
 * SELECT ... FOR UPDATE nos produtos, para não vender sem estoque
 * quando dois caixas vendem ao mesmo tempo.
 */
export function registrarVenda(dados: {
  caixaId: string; itens: ItemVenda[]; total: number;
  formaPagamento: FormaPagamento; valorRecebido: number; troco: number;
}): { ok: true; venda: Venda } | { ok: false; erro: string } {
  const falta = conferirEstoqueItens(dados.itens);
  if (falta) return { ok: false, erro: `Estoque insuficiente para ${falta.item.nome}. Disponível: ${falta.disponivel} unidades.` };
  for (const item of dados.itens) {
    const p = produtosMock.find((p) => p.id === item.produtoId)!;
    p.estoque -= item.quantidade;
  }
  const venda: Venda = { id: novoId(), criadoEm: agora(), ...copia(dados) };
  vendasMock.push(venda);
  return { ok: true, venda: copia(venda) };
}

/**
 * Placeholder da impressora térmica (comprovante não fiscal).
 * Se falhar, a venda NÃO é desfeita.
 */
export async function imprimirComprovante(_venda: Venda): Promise<void> {
  // TODO: integrar impressora térmica
}
