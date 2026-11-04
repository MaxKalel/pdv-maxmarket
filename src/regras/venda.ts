import type { ItemVenda, Produto } from "@/types";
import { multiplicar, paraCentavos, paraReais, somar, subtrair } from "./dinheiro";

/** Interpreta a entrada do campo de código: "3*789..." ou "789...". */
export function interpretarEntrada(
  texto: string,
): { ok: true; quantidade: number; codigo: string } | { ok: false; erro: string } | null {
  const t = texto.trim();
  if (!t) return null;
  const partes = t.split("*");
  if (partes.length > 2) return { ok: false, erro: "Formato inválido. Use quantidade*código." };
  if (partes.length === 2) {
    const q = (partes[0] ?? "").trim();
    const c = (partes[1] ?? "").trim();
    if (!/^\d+$/.test(q) || Number(q) <= 0) return { ok: false, erro: "Quantidade inválida." };
    if (!c) return { ok: false, erro: "Informe o código após o *." };
    return { ok: true, quantidade: Number(q), codigo: c };
  }
  return { ok: true, quantidade: 1, codigo: t };
}

export const calcularSubtotal = (quantidade: number, precoUnitario: number) =>
  multiplicar(precoUnitario, quantidade);

export const calcularTotal = (itens: ItemVenda[]) =>
  paraReais(itens.reduce((acc, i) => acc + paraCentavos(i.subtotal), 0));

/** Confere se a quantidade desejada cabe no estoque. */
export const temEstoque = (estoque: number, quantidadeDesejada: number) =>
  quantidadeDesejada <= estoque;

/** Adiciona (ou soma) um produto no carrinho. Não altera o array original. */
export function adicionarAoCarrinho(
  itens: ItemVenda[],
  produto: Produto,
  quantidade: number,
): { itens: ItemVenda[]; indice: number } {
  const idx = itens.findIndex((i) => i.produtoId === produto.id);
  if (idx >= 0) {
    const atual = itens[idx]!;
    const novaQtd = atual.quantidade + quantidade;
    const novo = [...itens];
    novo[idx] = { ...atual, quantidade: novaQtd, subtotal: calcularSubtotal(novaQtd, atual.precoUnitario) };
    return { itens: novo, indice: idx };
  }
  const item: ItemVenda = {
    produtoId: produto.id,
    codigo: produto.codigoBarras,
    nome: produto.nome,
    quantidade,
    precoUnitario: produto.preco,
    subtotal: calcularSubtotal(quantidade, produto.preco),
  };
  return { itens: [...itens, item], indice: itens.length };
}

/** Quantidade já no carrinho para um produto. */
export const quantidadeNoCarrinho = (itens: ItemVenda[], produtoId: string) =>
  itens.find((i) => i.produtoId === produtoId)?.quantidade ?? 0;

/** Valida o valor recebido em dinheiro e calcula o troco. */
export function calcularTroco(
  total: number,
  recebido: number | null,
): { ok: true; troco: number } | { ok: false; erro: string } {
  if (recebido === null || recebido <= 0) return { ok: false, erro: "Valor inválido." };
  if (paraCentavos(recebido) < paraCentavos(total))
    return { ok: false, erro: `Valor insuficiente. Faltam ${fmtFalta(subtrair(total, recebido))}.` };
  return { ok: true, troco: subtrair(recebido, total) };
}

const fmtFalta = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export { somar };
