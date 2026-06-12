"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Loader2, Car } from "lucide-react";

export interface Compatibilidade {
  marcaCodigo: string;
  marcaNome: string;
  modeloCodigo: string;
  modeloNome: string;
  anoCodigo: string;
  anoNome: string;
}

interface FipeMarca  { codigo: string; nome: string }
interface FipeModelo { codigo: number; nome: string }
interface FipeAno    { codigo: string; nome: string }

interface Props {
  value: Compatibilidade[];
  onChange: (v: Compatibilidade[]) => void;
}

const sel = "w-full px-3 py-2.5 bg-dark-950 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-brand/50 transition-all appearance-none disabled:opacity-40";

export default function VehicleCompatibility({ value, onChange }: Props) {
  const [marcas,  setMarcas]  = useState<FipeMarca[]>([]);
  const [modelos, setModelos] = useState<FipeModelo[]>([]);
  const [anos,    setAnos]    = useState<FipeAno[]>([]);

  const [marcaSel,  setMarcaSel]  = useState("");
  const [modeloSel, setModeloSel] = useState("");
  const [anoSel,    setAnoSel]    = useState("");

  const [loadingMarcas,  setLoadingMarcas]  = useState(true);
  const [loadingModelos, setLoadingModelos] = useState(false);
  const [loadingAnos,    setLoadingAnos]    = useState(false);

  useEffect(() => {
    fetch("/api/fipe/marcas")
      .then((r) => r.json())
      .then((d) => setMarcas(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoadingMarcas(false));
  }, []);

  async function onMarcaChange(codigo: string) {
    setMarcaSel(codigo);
    setModeloSel("");
    setAnoSel("");
    setModelos([]);
    setAnos([]);
    if (!codigo) return;
    setLoadingModelos(true);
    try {
      const res = await fetch(`/api/fipe/modelos?marca=${codigo}`);
      const data = await res.json();
      setModelos(Array.isArray(data) ? data : []);
    } catch {
      setModelos([]);
    } finally {
      setLoadingModelos(false);
    }
  }

  async function onModeloChange(codigo: string) {
    setModeloSel(codigo);
    setAnoSel("");
    setAnos([]);
    if (!codigo) return;
    setLoadingAnos(true);
    try {
      const res = await fetch(`/api/fipe/anos?marca=${marcaSel}&modelo=${codigo}`);
      const data = await res.json();
      setAnos(Array.isArray(data) ? data : []);
    } catch {
      setAnos([]);
    } finally {
      setLoadingAnos(false);
    }
  }

  function addCompatibilidade() {
    if (!marcaSel || !modeloSel || !anoSel) return;

    const marca  = marcas.find((m) => m.codigo === marcaSel);
    const modelo = modelos.find((m) => String(m.codigo) === modeloSel);
    const ano    = anos.find((a) => a.codigo === anoSel);
    if (!marca || !modelo || !ano) return;

    const nova: Compatibilidade = {
      marcaCodigo:  marca.codigo,
      marcaNome:    marca.nome,
      modeloCodigo: String(modelo.codigo),
      modeloNome:   modelo.nome,
      anoCodigo:    ano.codigo,
      anoNome:      ano.nome,
    };

    // Evita duplicatas
    const jaExiste = value.some(
      (c) => c.marcaCodigo === nova.marcaCodigo &&
             c.modeloCodigo === nova.modeloCodigo &&
             c.anoCodigo === nova.anoCodigo
    );
    if (jaExiste) return;

    onChange([...value, nova]);
    // Reset apenas ano para facilitar adicionar mais anos do mesmo modelo
    setAnoSel("");
  }

  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-4">
      {/* Seletor em cascata */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Montadora */}
        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1.5">Montadora</label>
          <div className="relative">
            {loadingMarcas && (
              <Loader2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-500 pointer-events-none" />
            )}
            <select value={marcaSel} onChange={(e) => onMarcaChange(e.target.value)} className={sel} disabled={loadingMarcas}>
              <option value="">Selecionar...</option>
              {marcas.map((m) => (
                <option key={m.codigo} value={m.codigo}>{m.nome}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Modelo */}
        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1.5">Modelo</label>
          <div className="relative">
            {loadingModelos && (
              <Loader2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-500 pointer-events-none" />
            )}
            <select value={modeloSel} onChange={(e) => onModeloChange(e.target.value)} className={sel} disabled={!marcaSel || loadingModelos}>
              <option value="">Selecionar...</option>
              {modelos.map((m) => (
                <option key={m.codigo} value={String(m.codigo)}>{m.nome}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Ano */}
        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1.5">Ano</label>
          <div className="relative">
            {loadingAnos && (
              <Loader2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-500 pointer-events-none" />
            )}
            <select value={anoSel} onChange={(e) => setAnoSel(e.target.value)} className={sel} disabled={!modeloSel || loadingAnos}>
              <option value="">Selecionar...</option>
              {anos.map((a) => (
                <option key={a.codigo} value={a.codigo}>{a.nome}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={addCompatibilidade}
        disabled={!marcaSel || !modeloSel || !anoSel}
        className="flex items-center gap-1.5 px-4 py-2 bg-dark-700 border border-white/10 text-gray-300 hover:text-white hover:border-white/20 text-sm font-semibold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Plus size={13} /> Adicionar compatibilidade
      </button>

      {/* Lista adicionada */}
      {value.length > 0 && (
        <div className="bg-dark-900 border border-white/8 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/5">
            <p className="text-xs font-semibold text-gray-500">{value.length} compatibilidade{value.length !== 1 ? "s" : ""} adicionada{value.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="divide-y divide-white/5 max-h-48 overflow-y-auto">
            {value.map((c, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 gap-3 hover:bg-white/3 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <Car size={12} className="text-brand flex-shrink-0" />
                  <span className="text-sm text-white truncate">
                    {c.marcaNome} · {c.modeloNome} · {c.anoNome}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {value.length === 0 && (
        <p className="text-xs text-gray-600">Nenhuma compatibilidade adicionada. Deixe vazio se o produto é universal.</p>
      )}
    </div>
  );
}
