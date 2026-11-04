import { describe, it, expect } from "vitest";
import { interpretarEntrada, calcularTroco, calcularTotal, calcularSubtotal } from "../venda";
import { calcularResumo, descreverDiferenca, validarMovimentacao } from "../caixa";
import { formatarReais } from "../dinheiro";

describe("regras do PDV", () => {
  it("3*codigo define quantidade 3", () => expect(interpretarEntrada("3*789")).toEqual({ ok: true, quantidade: 3, codigo: "789" }));
  it("quantidade inválida é rejeitada", () => expect(interpretarEntrada("0*789")).toMatchObject({ ok: false }));
  it("subtotal e total sem erro de ponto flutuante", () => {
    expect(calcularSubtotal(3, 0.1)).toBe(0.3);
    expect(calcularTotal([{ subtotal: 0.1 }, { subtotal: 0.2 }] as never)).toBe(0.3);
  });
  it("troco = recebido − total; menor que total recusa", () => {
    expect(calcularTroco(17.5, 20)).toEqual({ ok: true, troco: 2.5 });
    expect(calcularTroco(17.5, 10).ok).toBe(false);
    expect(calcularTroco(17.5, 0).ok).toBe(false);
  });
  it("esperado ignora cartão/pix", () => {
    const r = calcularResumo(100, [
      { tipo: "entrada", valor: 50 }, { tipo: "saida", valor: 30 },
    ] as never, [{ formaPagamento: "dinheiro", total: 20 }, { formaPagamento: "pix", total: 99 }] as never);
    expect(r.esperado).toBe(140);
  });
  it("diferença descrita", () => {
    expect(descreverDiferenca(0, formatarReais)).toBe("Caixa conferido, sem diferença");
    expect(descreverDiferenca(-5, formatarReais)).toMatch(/^Falta de/);
  });
  it("sangria maior que a gaveta é recusada", () => {
    expect(validarMovimentacao("saida", 200, 100)).not.toBeNull();
    expect(validarMovimentacao("entrada", 0, 100)).not.toBeNull();
  });
});
