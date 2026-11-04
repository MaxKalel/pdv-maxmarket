import type { FormaPagamento, Movimentacao, Venda } from "@/types";
import { paraCentavos, paraReais, subtrair } from "./dinheiro";

export interface ResumoCaixa {
  valorInicial: number;
  entradas: number;
  saidas: number;
  vendasPorForma: Record<FormaPagamento, number>;
  quantidadeVendas: number;
  esperado: number; // dinheiro esperado na gaveta
}

const soma = (vs: number[]) => paraReais(vs.reduce((a, v) => a + paraCentavos(v), 0));

/** Esperado = inicial + entradas + vendas em dinheiro − saídas. */
export function calcularResumo(
  valorInicial: number,
  movs: Movimentacao[],
  vendas: Venda[],
): ResumoCaixa {
  const entradas = soma(movs.filter((m) => m.tipo === "entrada").map((m) => m.valor));
  const saidas = soma(movs.filter((m) => m.tipo === "saida").map((m) => m.valor));
  const por = (f: FormaPagamento) => soma(vendas.filter((v) => v.formaPagamento === f).map((v) => v.total));
  const vendasPorForma = { dinheiro: por("dinheiro"), debito: por("debito"), credito: por("credito"), pix: por("pix") };
  const esperado = subtrair(soma([valorInicial, entradas, vendasPorForma.dinheiro]), saidas);
  return { valorInicial, entradas, saidas, vendasPorForma, quantidadeVendas: vendas.length, esperado };
}

/** Diferença = contado − esperado (positivo = sobra, negativo = falta). */
export const calcularDiferenca = (esperado: number, contado: number) => subtrair(contado, esperado);

export function descreverDiferenca(diferenca: number, formatar: (v: number) => string) {
  if (paraCentavos(diferenca) === 0) return "Caixa conferido, sem diferença";
  return diferenca > 0 ? `Sobra de ${formatar(diferenca)}` : `Falta de ${formatar(-diferenca)}`;
}

/** Valida suprimento/sangria. */
export function validarMovimentacao(
  tipo: "entrada" | "saida",
  valor: number | null,
  dinheiroNaGaveta: number,
): string | null {
  if (valor === null || valor <= 0) return "Valor inválido. Informe um valor maior que zero.";
  if (tipo === "saida" && paraCentavos(valor) > paraCentavos(dinheiroNaGaveta))
    return "Saída maior que o dinheiro disponível na gaveta.";
  return null;
}
