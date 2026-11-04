import { useCallback, useEffect, useRef, useState, type KeyboardEvent as KE } from "react";
import { toast } from "sonner";
import type { Caixa, FormaPagamento, ItemVenda, Produto, Venda } from "@/types";
import * as repo from "@/data/repositorio";
import { adicionarAoCarrinho, calcularTotal, calcularTroco, interpretarEntrada, quantidadeNoCarrinho } from "@/regras/venda";
import { calcularDiferenca, descreverDiferenca, validarMovimentacao } from "@/regras/caixa";
import { formatarReais as R, lerValor } from "@/regras/dinheiro";
import { Janela } from "./Janela";

type Modal =
  | { tipo: "consulta" }
  | { tipo: "cancelar" }
  | { tipo: "pagamento" }
  | { tipo: "comprovante"; venda: Venda }
  | { tipo: "abrirCaixa" }
  | { tipo: "menuCaixa" }
  | { tipo: "movimentacao"; mov: "entrada" | "saida" }
  | { tipo: "fecharCaixa" }
  | null;

const FORMAS: { tecla: string; forma: FormaPagamento; nome: string }[] = [
  { tecla: "1", forma: "dinheiro", nome: "Dinheiro" },
  { tecla: "2", forma: "debito", nome: "Débito" },
  { tecla: "3", forma: "credito", nome: "Crédito" },
  { tecla: "4", forma: "pix", nome: "Pix" },
];
const nomeForma = (f: FormaPagamento) => FORMAS.find((x) => x.forma === f)!.nome;

const avisar = (m: string) => toast.error(m);
const ok = (m: string) => toast.success(m);

export function Pdv() {
  const [caixa, setCaixa] = useState<Caixa | null>(() => repo.obterCaixaAtual());
  const [itens, setItens] = useState<ItemVenda[]>([]);
  const [sel, setSel] = useState(-1);
  const [codigo, setCodigo] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [agora, setAgora] = useState<Date | null>(null);
  const campo = useRef<HTMLInputElement>(null);
  const total = calcularTotal(itens);

  useEffect(() => { setAgora(new Date()); const t = setInterval(() => setAgora(new Date()), 1000); return () => clearInterval(t); }, []);

  const focar = useCallback(() => setTimeout(() => campo.current?.focus(), 0), []);
  useEffect(() => { if (!modal) focar(); }, [modal, caixa, focar]);
  const fechar = useCallback(() => setModal(null), []);

  /** Mesmas regras para código digitado e consulta F1. */
  const adicionar = (produto: Produto, qtd: number) => {
    if (!caixa) { avisar("Caixa fechado. Pressione F4 para abrir."); return false; }
    const desejada = quantidadeNoCarrinho(itens, produto.id) + qtd;
    const estoque = repo.obterEstoque(produto.id);
    if (desejada > estoque) { avisar(`Estoque insuficiente. Disponível: ${estoque} unidades.`); return false; }
    const r = adicionarAoCarrinho(itens, produto, qtd);
    setItens(r.itens); setSel(r.indice);
    return true;
  };

  const enterCodigo = () => {
    const e = interpretarEntrada(codigo);
    if (!e) return;
    if (!e.ok) { avisar(e.erro); return; }
    const p = repo.buscarProdutoPorCodigo(e.codigo);
    if (!p) avisar("Produto não encontrado. Confira o código ou use F1 para pesquisar.");
    else adicionar(p, e.quantidade);
    setCodigo(""); focar();
  };

  const f2 = () => {
    if (!caixa) return avisar("Caixa fechado. Pressione F4 para abrir.");
    if (!itens.length) return avisar("Carrinho vazio. Adicione produtos antes de finalizar.");
    const falta = repo.conferirEstoqueItens(itens);
    if (falta) return avisar(`Estoque insuficiente para ${falta.item.nome}. Disponível: ${falta.disponivel} unidades.`);
    setModal({ tipo: "pagamento" });
  };
  const f3 = () => {
    if (!itens.length || sel < 0) return avisar("Nenhum item selecionado para cancelar.");
    setModal({ tipo: "cancelar" });
  };
  const f4 = () => setModal(caixa ? { tipo: "menuCaixa" } : { tipo: "abrirCaixa" });

  // Atalhos globais
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!["F1", "F2", "F3", "F4"].includes(e.key)) return;
      e.preventDefault();
      if (modal) return;
      ({ F1: () => setModal({ tipo: "consulta" }), F2: f2, F3: f3, F4: f4 } as Record<string, () => void>)[e.key]();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const teclaCampo = (e: KE<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); enterCodigo(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(itens.length - 1, s + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(itens.length ? 0 : -1, s - 1)); }
  };

  const confirmarCancelamento = () => {
    const item = itens[sel];
    repo.registrarCancelamento(caixa!.id, item);
    const novo = itens.filter((_, i) => i !== sel);
    setItens(novo); setSel(novo.length ? Math.max(0, sel - 1) : -1);
    ok(`Item ${item.nome} cancelado.`); fechar();
  };

  const concluirVenda = (forma: FormaPagamento, recebido: number, troco: number) => {
    const r = repo.registrarVenda({ caixaId: caixa!.id, itens, total, formaPagamento: forma, valorRecebido: recebido, troco });
    if (!r.ok) { avisar(r.erro); fechar(); return; }
    repo.imprimirComprovante(r.venda).catch(() => avisar("Falha na impressão. A venda foi registrada."));
    setItens([]); setSel(-1); ok("Venda concluída");
    setModal({ tipo: "comprovante", venda: r.venda });
  };

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* Topo */}
      <header className="flex items-center justify-between bg-foreground px-6 py-3 text-background">
        <div className="flex items-center gap-4">
          <span className="font-display text-2xl font-black tracking-tight">PDV</span>
          <span className="text-lg">{repo.obterOperador()}</span>
        </div>
        <span className={`rounded-md px-3 py-1 text-lg font-bold uppercase ${caixa ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}`}>
          Caixa {caixa ? "aberto" : "fechado"}
        </span>
        <span className="font-mono text-lg tabular-nums">{agora?.toLocaleString("pt-BR") ?? ""}</span>
      </header>

      <main className="grid flex-1 grid-cols-[1fr_380px] gap-6 overflow-hidden p-6">
        <section className="flex min-h-0 flex-col gap-4">
          <label className="block">
            <span className="mb-1 block text-sm font-bold uppercase tracking-wider text-muted-foreground">Código de barras (qtd*código)</span>
            <input
              ref={campo} value={codigo} disabled={!caixa}
              onChange={(e) => setCodigo(e.target.value)} onKeyDown={teclaCampo}
              placeholder={caixa ? "Bipe ou digite o código e Enter" : "Caixa fechado"}
              className="w-full rounded-xl border-4 border-foreground bg-card px-5 py-4 font-mono text-4xl outline-none focus:border-primary focus:ring-4 focus:ring-primary/30 disabled:opacity-50"
              autoFocus
            />
          </label>

          {!caixa && (
            <div className="rounded-xl border-4 border-dashed border-destructive bg-destructive/10 p-6 text-center text-3xl font-black text-destructive">
              Caixa fechado. Pressione F4 para abrir.
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-auto rounded-xl border-2 border-foreground bg-card">
            <table className="w-full text-lg">
              <thead className="sticky top-0 bg-secondary text-left text-sm uppercase tracking-wider">
                <tr>{["Item", "Código", "Nome", "Qtd", "Preço Unit.", "Subtotal"].map((h, i) => <th key={h} className={`px-4 py-3 ${i >= 3 ? "text-right" : ""}`}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {itens.map((it, i) => (
                  <tr key={it.produtoId} ref={(el) => { if (i === sel) el?.scrollIntoView({ block: "nearest" }); }}
                    className={`border-t border-border ${i === sel ? "bg-primary text-primary-foreground" : ""}`}>
                    <td className="px-4 py-2 font-mono">{String(i + 1).padStart(3, "0")}</td>
                    <td className="px-4 py-2 font-mono">{it.codigo}</td>
                    <td className="px-4 py-2 font-semibold">{it.nome}</td>
                    <td className="px-4 py-2 text-right font-mono">{it.quantidade}</td>
                    <td className="px-4 py-2 text-right font-mono">{R(it.precoUnitario)}</td>
                    <td className="px-4 py-2 text-right font-mono font-bold">{R(it.subtotal)}</td>
                  </tr>
                ))}
                {!itens.length && <tr><td colSpan={6} className="px-4 py-16 text-center text-xl text-muted-foreground">Nenhum item na venda</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          <div className="rounded-xl bg-total p-6 text-total-foreground">
            <div className="text-sm font-bold uppercase tracking-widest opacity-80">Total da compra</div>
            <div className="mt-2 break-all font-mono text-6xl font-black tabular-nums">{R(total)}</div>
            <div className="mt-3 text-lg opacity-80">{itens.reduce((a, i) => a + i.quantidade, 0)} unidade(s) · {itens.length} item(ns)</div>
          </div>
          {sel >= 0 && itens[sel] && (
            <div className="rounded-xl border-2 border-foreground bg-card p-4">
              <div className="text-sm font-bold uppercase text-muted-foreground">Selecionado</div>
              <div className="text-xl font-bold">{itens[sel].nome}</div>
              <div className="font-mono text-lg">{itens[sel].quantidade} × {R(itens[sel].precoUnitario)}</div>
            </div>
          )}
        </aside>
      </main>

      <footer className="grid grid-cols-4 gap-2 border-t-2 border-foreground bg-secondary p-3">
        {[["F1", "Consulta"], ["F2", "Finalizar"], ["F3", "Cancelar item"], ["F4", "Caixa"]].map(([k, l]) => (
          <div key={k} className="flex items-center justify-center gap-3 text-lg font-semibold"><span className="kbd text-base">{k}</span>{l}</div>
        ))}
      </footer>

      {modal?.tipo === "consulta" && <Consulta onFechar={fechar} onEscolher={(p) => { if (adicionar(p, 1)) fechar(); }} />}
      {modal?.tipo === "cancelar" && itens[sel] && (
        <Confirmar titulo="Cancelar item" texto={`Cancelar o item ${itens[sel].nome}? S/N`} onSim={confirmarCancelamento} onNao={fechar} />
      )}
      {modal?.tipo === "pagamento" && <Pagamento total={total} onFechar={fechar} onConcluir={concluirVenda} />}
      {modal?.tipo === "comprovante" && <Comprovante venda={modal.venda} onFechar={fechar} />}
      {modal?.tipo === "abrirCaixa" && (
        <EntradaValor titulo="Abrir caixa" rotulo="Valor inicial (troco na gaveta)" permitirZero onFechar={fechar}
          onConfirmar={(v) => { setCaixa(repo.abrirCaixa(v)); ok("Caixa aberto."); fechar(); }} />
      )}
      {modal?.tipo === "menuCaixa" && caixa && (
        <MenuCaixa onFechar={fechar} onEscolher={(o) => {
          if (o === "fechar") { if (itens.length) { avisar("Há uma venda em andamento. Finalize ou cancele os itens antes de fechar."); fechar(); } else setModal({ tipo: "fecharCaixa" }); }
          else setModal({ tipo: "movimentacao", mov: o });
        }} />
      )}
      {modal?.tipo === "movimentacao" && caixa && (
        <MovimentacaoJanela tipo={modal.mov} gaveta={repo.obterResumoCaixa(caixa.id).esperado} onFechar={fechar}
          onConfirmar={(v, m) => { repo.registrarMovimentacao(caixa.id, modal.mov, v, m); ok(modal.mov === "entrada" ? "Suprimento registrado." : "Sangria registrada."); fechar(); }} />
      )}
      {modal?.tipo === "fecharCaixa" && caixa && (
        <FechamentoJanela caixa={caixa} onFechar={fechar}
          onConfirmar={(esp, cont, dif) => { repo.fecharCaixa(caixa.id, esp, cont, dif); setCaixa(null); ok("Caixa fechado."); fechar(); }} />
      )}
    </div>
  );
}

/* ---------------- Janelas ---------------- */

function Confirmar({ titulo, texto, onSim, onNao }: { titulo: string; texto: string; onSim: () => void; onNao: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "s") { e.preventDefault(); onSim(); } else if (k === "n") { e.preventDefault(); onNao(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onSim, onNao]);
  return (
    <Janela titulo={titulo} onFechar={onNao}>
      <p className="text-2xl font-semibold">{texto}</p>
      <div className="mt-6 flex gap-4 text-lg"><span><span className="kbd">S</span> Sim</span><span><span className="kbd">N</span> Não</span></div>
    </Janela>
  );
}

function Consulta({ onFechar, onEscolher }: { onFechar: () => void; onEscolher: (p: Produto) => void }) {
  const [termo, setTermo] = useState("");
  const [i, setI] = useState(0);
  const lista = repo.pesquisarProdutos(termo);
  return (
    <Janela titulo="F1 · Consulta de preços" onFechar={onFechar} largura="max-w-3xl">
      <input autoFocus value={termo} onChange={(e) => { setTermo(e.target.value); setI(0); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(lista.length - 1, x + 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
          else if (e.key === "Enter" && lista[i]) { e.preventDefault(); onEscolher(lista[i]); }
        }}
        placeholder="Nome ou código" className="campo" />
      <div className="mt-4 max-h-[50vh] overflow-auto rounded-lg border-2 border-foreground">
        <table className="w-full text-lg">
          <thead className="sticky top-0 bg-secondary text-left text-sm uppercase"><tr><th className="px-3 py-2">Código</th><th className="px-3 py-2">Nome</th><th className="px-3 py-2 text-right">Preço</th><th className="px-3 py-2 text-right">Estoque</th></tr></thead>
          <tbody>
            {lista.map((p, k) => (
              <tr key={p.id} ref={(el) => { if (k === i) el?.scrollIntoView({ block: "nearest" }); }} className={`border-t border-border ${k === i ? "bg-primary text-primary-foreground" : ""}`}>
                <td className="px-3 py-2 font-mono">{p.codigoBarras}</td><td className="px-3 py-2">{p.nome}</td>
                <td className="px-3 py-2 text-right font-mono font-bold">{R(p.preco)}</td>
                <td className={`px-3 py-2 text-right font-mono ${p.estoque === 0 && k !== i ? "text-destructive font-bold" : ""}`}>{p.estoque}</td>
              </tr>
            ))}
            {!lista.length && <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">Nenhum produto encontrado</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-muted-foreground">↑↓ navegar · Enter adicionar ao carrinho</p>
    </Janela>
  );
}

function EntradaValor({ titulo, rotulo, permitirZero, onFechar, onConfirmar }: {
  titulo: string; rotulo: string; permitirZero?: boolean; onFechar: () => void; onConfirmar: (v: number) => void;
}) {
  const [t, setT] = useState("");
  return (
    <Janela titulo={titulo} onFechar={onFechar}>
      <label className="block text-lg font-semibold">{rotulo}</label>
      <input autoFocus inputMode="decimal" value={t} onChange={(e) => setT(e.target.value)} className="campo mt-2 font-mono"
        placeholder="0,00"
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          const v = lerValor(t === "" && permitirZero ? "0" : t);
          if (v === null || v < 0 || (!permitirZero && v === 0)) { avisar("Valor inválido."); return; }
          onConfirmar(v);
        }} />
      <p className="mt-3 text-muted-foreground">Enter confirma</p>
    </Janela>
  );
}

function Pagamento({ total, onFechar, onConcluir }: { total: number; onFechar: () => void; onConcluir: (f: FormaPagamento, recebido: number, troco: number) => void }) {
  const [etapa, setEtapa] = useState<"forma" | "dinheiro" | "aprovacao" | "troco">("forma");
  const [forma, setForma] = useState<FormaPagamento>("dinheiro");
  const [t, setT] = useState("");
  const [rec, setRec] = useState({ recebido: 0, troco: 0 });

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (etapa === "forma") {
        const f = FORMAS.find((x) => x.tecla === e.key);
        if (f) { e.preventDefault(); setForma(f.forma); setEtapa(f.forma === "dinheiro" ? "dinheiro" : "aprovacao"); }
      } else if (etapa === "aprovacao") {
        const k = e.key.toLowerCase();
        if (k === "s") { e.preventDefault(); onConcluir(forma, total, 0); }
        else if (k === "n") { e.preventDefault(); avisar("Pagamento recusado. Escolha outra forma."); setEtapa("forma"); }
      } else if (etapa === "troco" && e.key === "Enter") { e.preventDefault(); onConcluir("dinheiro", rec.recebido, rec.troco); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [etapa, forma, rec, total, onConcluir]);

  return (
    <Janela titulo="F2 · Pagamento" onFechar={onFechar}>
      <div className="rounded-xl bg-total p-5 text-total-foreground">
        <div className="text-sm font-bold uppercase tracking-widest opacity-80">Total</div>
        <div className="font-mono text-6xl font-black">{R(total)}</div>
      </div>
      {etapa === "forma" && (
        <div className="mt-5 grid grid-cols-2 gap-3">
          {FORMAS.map((f) => <div key={f.tecla} className="flex items-center gap-3 rounded-lg border-2 border-foreground p-4 text-2xl font-bold"><span className="kbd text-xl">{f.tecla}</span>{f.nome}</div>)}
        </div>
      )}
      {etapa === "dinheiro" && (
        <div className="mt-5">
          <label className="text-lg font-semibold">Valor recebido</label>
          <input autoFocus inputMode="decimal" value={t} onChange={(e) => setT(e.target.value)} className="campo mt-2 font-mono" placeholder="0,00"
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault(); e.stopPropagation();
              const r = calcularTroco(total, lerValor(t));
              if (!r.ok) { avisar(r.erro); setT(""); return; }
              setRec({ recebido: lerValor(t)!, troco: r.troco }); setEtapa("troco");
            }} />
        </div>
      )}
      {etapa === "troco" && (
        <div className="mt-5 text-center">
          <div className="text-lg">Recebido: <span className="font-mono font-bold">{R(rec.recebido)}</span></div>
          <div className="mt-3 rounded-xl border-4 border-success bg-success/10 p-5">
            <div className="text-sm font-bold uppercase tracking-widest text-success">Troco</div>
            <div className="font-mono text-7xl font-black text-success">{R(rec.troco)}</div>
          </div>
          <p className="mt-4 text-lg"><span className="kbd">Enter</span> concluir venda</p>
        </div>
      )}
      {etapa === "aprovacao" && (
        <div className="mt-5">
          <p className="text-2xl font-semibold">Pagamento em {nomeForma(forma)} aprovado? S/N</p>
          <div className="mt-4 flex gap-4 text-lg"><span><span className="kbd">S</span> Aprovado</span><span><span className="kbd">N</span> Recusado</span></div>
        </div>
      )}
    </Janela>
  );
}

function Comprovante({ venda, onFechar }: { venda: Venda; onFechar: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); onFechar(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onFechar]);
  return (
    <Janela titulo="Venda concluída" onFechar={onFechar} largura="max-w-md">
      <div className="rounded-lg border-2 border-dashed border-foreground bg-background p-4 font-mono text-sm">
        <div className="text-center font-bold">COMPROVANTE NÃO FISCAL</div>
        <div className="text-center">{new Date(venda.criadoEm).toLocaleString("pt-BR")}</div>
        <hr className="my-2 border-dashed border-foreground" />
        {venda.itens.map((i) => (
          <div key={i.produtoId}><div>{i.nome}</div><div className="flex justify-between"><span>{i.quantidade} × {R(i.precoUnitario)}</span><span>{R(i.subtotal)}</span></div></div>
        ))}
        <hr className="my-2 border-dashed border-foreground" />
        <div className="flex justify-between text-base font-bold"><span>TOTAL</span><span>{R(venda.total)}</span></div>
        <div className="flex justify-between"><span>{nomeForma(venda.formaPagamento)}</span><span>{R(venda.valorRecebido)}</span></div>
        <div className="flex justify-between"><span>Troco</span><span>{R(venda.troco)}</span></div>
        <hr className="my-2 border-dashed border-foreground" />
        <div className="text-center font-bold">Este documento não tem valor fiscal</div>
      </div>
      <p className="mt-4 text-center text-lg"><span className="kbd">Enter</span> nova venda</p>
    </Janela>
  );
}

function MenuCaixa({ onFechar, onEscolher }: { onFechar: () => void; onEscolher: (o: "entrada" | "saida" | "fechar") => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const o = ({ "1": "entrada", "2": "saida", "3": "fechar" } as const)[e.key as "1"];
      if (o) { e.preventDefault(); onEscolher(o); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onEscolher]);
  return (
    <Janela titulo="F4 · Caixa" onFechar={onFechar} largura="max-w-md">
      {[["1", "Suprimento (entrada)"], ["2", "Sangria (saída)"], ["3", "Fechar caixa"]].map(([k, l]) => (
        <div key={k} className="mb-3 flex items-center gap-3 rounded-lg border-2 border-foreground p-4 text-xl font-bold"><span className="kbd text-lg">{k}</span>{l}</div>
      ))}
    </Janela>
  );
}

function MovimentacaoJanela({ tipo, gaveta, onFechar, onConfirmar }: { tipo: "entrada" | "saida"; gaveta: number; onFechar: () => void; onConfirmar: (v: number, motivo: string) => void }) {
  const [t, setT] = useState("");
  const [motivo, setMotivo] = useState("");
  const motivoRef = useRef<HTMLInputElement>(null);
  return (
    <Janela titulo={tipo === "entrada" ? "Suprimento" : "Sangria"} onFechar={onFechar}>
      <p className="mb-3 text-muted-foreground">Dinheiro na gaveta: <span className="font-mono font-bold text-foreground">{R(gaveta)}</span></p>
      <label className="text-lg font-semibold">Valor</label>
      <input autoFocus inputMode="decimal" value={t} onChange={(e) => setT(e.target.value)} className="campo mt-1 font-mono" placeholder="0,00"
        onKeyDown={(e) => {
          if (e.key !== "Enter") return; e.preventDefault();
          const erro = validarMovimentacao(tipo, lerValor(t), gaveta);
          if (erro) avisar(erro); else motivoRef.current?.focus();
        }} />
      <label className="mt-4 block text-lg font-semibold">Motivo</label>
      <input ref={motivoRef} value={motivo} onChange={(e) => setMotivo(e.target.value)} className="campo mt-1"
        onKeyDown={(e) => {
          if (e.key !== "Enter") return; e.preventDefault();
          const v = lerValor(t);
          const erro = validarMovimentacao(tipo, v, gaveta);
          if (erro) return avisar(erro);
          if (!motivo.trim()) return avisar("Informe o motivo.");
          onConfirmar(v!, motivo.trim());
        }} />
      <p className="mt-3 text-muted-foreground">Enter avança / confirma</p>
    </Janela>
  );
}

function FechamentoJanela({ caixa, onFechar, onConfirmar }: { caixa: Caixa; onFechar: () => void; onConfirmar: (esp: number, cont: number, dif: number) => void }) {
  const resumo = repo.obterResumoCaixa(caixa.id);
  const [t, setT] = useState("");
  const [contado, setContado] = useState<number | null>(null);
  const dif = contado === null ? 0 : calcularDiferenca(resumo.esperado, contado);

  useEffect(() => {
    if (contado === null) return;
    const h = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "s") { e.preventDefault(); onConfirmar(resumo.esperado, contado, dif); }
      else if (k === "n") { e.preventDefault(); setContado(null); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [contado, dif, resumo.esperado, onConfirmar]);

  const Linha = ({ l, v, forte }: { l: string; v: string; forte?: boolean }) => (
    <div className={`flex justify-between border-b border-border py-1 ${forte ? "text-xl font-bold" : "text-lg"}`}><span>{l}</span><span className="font-mono">{v}</span></div>
  );
  return (
    <Janela titulo="Fechamento de caixa" onFechar={onFechar}>
      {contado === null ? (
        <>
          <label className="text-lg font-semibold">Valor contado na gaveta</label>
          <input autoFocus inputMode="decimal" value={t} onChange={(e) => setT(e.target.value)} className="campo mt-2 font-mono" placeholder="0,00"
            onKeyDown={(e) => {
              if (e.key !== "Enter") return; e.preventDefault();
              const v = lerValor(t === "" ? "x" : t);
              if (v === null || v < 0) return avisar("Valor inválido.");
              setContado(v);
            }} />
          <p className="mt-3 text-muted-foreground">Enter confirma</p>
        </>
      ) : (
        <>
          <Linha l="Valor inicial" v={R(resumo.valorInicial)} />
          <Linha l="Entradas (suprimento)" v={R(resumo.entradas)} />
          <Linha l="Saídas (sangria)" v={R(resumo.saidas)} />
          {FORMAS.map((f) => <Linha key={f.forma} l={`Vendas ${f.nome}`} v={R(resumo.vendasPorForma[f.forma])} />)}
          <Linha l="Quantidade de vendas" v={String(resumo.quantidadeVendas)} />
          <Linha l="Esperado na gaveta" v={R(resumo.esperado)} forte />
          <Linha l="Contado" v={R(contado)} forte />
          <Linha l="Diferença" v={R(dif)} forte />
          <div className={`mt-4 rounded-lg p-4 text-center text-2xl font-black ${dif === 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
            {descreverDiferenca(dif, R)}
          </div>
          <p className="mt-4 text-lg">Confirmar fechamento? <span className="kbd">S</span> Sim <span className="kbd">N</span> Recontar</p>
        </>
      )}
    </Janela>
  );
}
