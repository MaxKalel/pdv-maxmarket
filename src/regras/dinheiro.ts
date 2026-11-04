// Funções puras de dinheiro. Todos os cálculos são feitos em centavos.

export const paraCentavos = (reais: number) => Math.round(reais * 100);
export const paraReais = (centavos: number) => Math.round(centavos) / 100;

/** Arredonda um valor em reais para o centavo. */
export const arredondar = (reais: number) => paraReais(paraCentavos(reais));

export const somar = (...valores: number[]) =>
  paraReais(valores.reduce((acc, v) => acc + paraCentavos(v), 0));

export const subtrair = (a: number, b: number) => paraReais(paraCentavos(a) - paraCentavos(b));

export const multiplicar = (preco: number, quantidade: number) =>
  paraReais(paraCentavos(preco) * quantidade);

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const formatarReais = (v: number) => fmt.format(v);

/** Converte texto digitado ("12,50", "12.5") em número; retorna null se inválido. */
export function lerValor(texto: string): number | null {
  const t = texto.trim().replace(/\s/g, "");
  if (!t) return null;
  const normal = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  if (!/^-?\d+(\.\d+)?$/.test(normal)) return null;
  return arredondar(Number(normal));
}
