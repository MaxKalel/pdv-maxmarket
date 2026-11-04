// Tipos do PDV. Cada tipo reflete uma futura tabela do banco de dados.

export interface Produto {
  id: string;
  codigoBarras: string; // único
  nome: string;
  preco: number; // em reais, 2 casas
  estoque: number; // inteiro, nunca negativo
}

export type StatusCaixa = "aberto" | "fechado";

export interface Caixa {
  id: string;
  operador: string;
  status: StatusCaixa;
  valorInicial: number;
  abertoEm: string; // ISO
  fechadoEm: string | null;
  valorEsperado: number | null;
  valorContado: number | null;
  diferenca: number | null;
}

export type TipoMovimentacao = "entrada" | "saida";

export interface Movimentacao {
  id: string;
  caixaId: string;
  tipo: TipoMovimentacao;
  valor: number;
  motivo: string;
  criadoEm: string;
}

export type FormaPagamento = "dinheiro" | "debito" | "credito" | "pix";

export interface ItemVenda {
  produtoId: string;
  codigo: string;
  nome: string;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
}

export interface Venda {
  id: string;
  caixaId: string;
  criadoEm: string;
  total: number;
  formaPagamento: FormaPagamento;
  valorRecebido: number;
  troco: number;
  itens: ItemVenda[];
}

export interface Cancelamento {
  id: string;
  caixaId: string;
  codigo: string;
  nome: string;
  quantidade: number;
  valor: number;
  criadoEm: string;
}
