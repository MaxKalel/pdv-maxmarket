import type { Caixa, Cancelamento, Movimentacao, Produto, Venda } from "@/types";

// Dados de exemplo em memória. Serão substituídos pelas tabelas do banco.

export const OPERADOR_PADRAO = "Operador 1";

export const produtosMock: Produto[] = [
  { id: "p1", codigoBarras: "7891000100103", nome: "Arroz Branco Tipo 1 5kg", preco: 27.9, estoque: 40 },
  { id: "p2", codigoBarras: "7896006710016", nome: "Feijão Carioca 1kg", preco: 8.49, estoque: 60 },
  { id: "p3", codigoBarras: "7891910000197", nome: "Açúcar Refinado 1kg", preco: 4.99, estoque: 80 },
  { id: "p4", codigoBarras: "7896089011987", nome: "Café Torrado e Moído 500g", preco: 18.9, estoque: 25 },
  { id: "p5", codigoBarras: "7891080400087", nome: "Óleo de Soja 900ml", preco: 7.29, estoque: 50 },
  { id: "p6", codigoBarras: "7891025101033", nome: "Leite Integral 1L", preco: 5.49, estoque: 120 },
  { id: "p7", codigoBarras: "7896005800015", nome: "Macarrão Espaguete 500g", preco: 4.29, estoque: 70 },
  { id: "p8", codigoBarras: "7891095005086", nome: "Molho de Tomate 340g", preco: 2.99, estoque: 90 },
  { id: "p9", codigoBarras: "7891000053508", nome: "Farinha de Trigo 1kg", preco: 5.79, estoque: 35 },
  { id: "p10", codigoBarras: "7891150003153", nome: "Sal Refinado 1kg", preco: 2.49, estoque: 45 },
  { id: "p11", codigoBarras: "7896036090244", nome: "Biscoito Cream Cracker 400g", preco: 6.39, estoque: 30 },
  { id: "p12", codigoBarras: "7891024134702", nome: "Sabão em Pó 1kg", preco: 14.9, estoque: 20 },
  { id: "p13", codigoBarras: "7891528038015", nome: "Detergente Líquido 500ml", preco: 2.79, estoque: 100 },
  { id: "p14", codigoBarras: "7894900011517", nome: "Refrigerante Cola 2L", preco: 9.99, estoque: 3 },
  { id: "p15", codigoBarras: "7891000315507", nome: "Achocolatado em Pó 400g", preco: 8.99, estoque: 0 },
];

export const caixasMock: Caixa[] = []; // o caixa começa fechado
export const movimentacoesMock: Movimentacao[] = [];
export const vendasMock: Venda[] = [];
export const cancelamentosMock: Cancelamento[] = [];
