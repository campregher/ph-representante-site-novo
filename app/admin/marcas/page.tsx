"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, RefreshCw, X, Loader2, Tag, Search, UserPlus, Copy, ExternalLink, UserX, RefreshCcw, ShieldCheck } from "lucide-react";

interface Marca {
  id: string; slug: string; name: string; segment: string | null;
  logo_url: string | null; ativo: boolean; created_at: string;
  razao_social: string | null;
  cnpj: string | null; email: string | null; telefone: string | null;
  contato: string | null; cep: string | null; logradouro: string | null;
  numero: string | null; complemento: string | null; bairro: string | null;
  cidade: string | null; estado: string | null;
}

interface MarcaUser { id: string; marca_slug: string; user_id: string; email: string; created_at: string; }

type FormData = {
  slug: string; name: string; segment: string; logo_url: string; ativo: boolean;
  razao_social: string;
  cnpj: string; email: string; telefone: string; contato: string;
  cep: string; logradouro: string; numero: string; complemento: string; bairro: string; cidade: string; estado: string;
};

const emptyForm: FormData = {
  slug: "", name: "", segment: "", logo_url: "", ativo: true,
  razao_social: "",
  cnpj: "", email: "", telefone: "", contato: "",
  cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "",
};

const inp = "w-full px-3 py-2.5 bg-dark-950 border border-white/10 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-brand/50 transition-all";
const lbl = "block text-xs font-semibold text-gray-400 mb-1.5";
const sec = "text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 pt-1";

function formatCnpj(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function formatCep(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export default function AdminMarcasPage() {
  const [marcas,      setMarcas]      = useState<Marca[]>([]);
  const [marcaUsers,  setMarcaUsers]  = useState<MarcaUser[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [modal,       setModal]       = useState<{ open: boolean; editing: Marca | null }>({ open: false, editing: null });
  const [form,        setForm]        = useState<FormData>(emptyForm);
  const [saving,      setSaving]      = useState(false);
  const [formErr,     setFormErr]     = useState("");
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cepLoading,  setCepLoading]  = useState(false);
  const [delId,       setDelId]       = useState<string | null>(null);
  const [deleting,    setDeleting]    = useState(false);
  const cnpjRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cepRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Access management
  const [accessModal,  setAccessModal]  = useState<{ slug: string; name: string } | null>(null);
  const [accessEmail,  setAccessEmail]  = useState("");
  const [accessSaving, setAccessSaving] = useState(false);
  const [accessResult, setAccessResult] = useState<{ email: string; resetLink: string | null } | null>(null);
  const [linkModal,    setLinkModal]    = useState<{ slug: string; name: string; email: string } | null>(null);
  const [linkData,     setLinkData]     = useState<{ email: string; resetLink: string | null } | null>(null);
  const [linkLoading,  setLinkLoading]  = useState(false);
  const [revokeId,     setRevokeId]     = useState<{ user_id: string; name: string } | null>(null);
  const [revoking,     setRevoking]     = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [mRes, uRes] = await Promise.all([
        fetch("/api/admin/marcas"),
        fetch("/api/admin/marca-users"),
      ]);

      if (mRes.status === 401 || uRes.status === 401) {
        window.location.href = "/admin/login";
        return;
      }

      // Parseia marcas — erro aqui é crítico
      const mData = await mRes.json().catch(() => null);
      if (!mRes.ok) {
        throw new Error(mData?.error ?? `Erro ${mRes.status} ao carregar marcas`);
      }
      setMarcas(Array.isArray(mData) ? mData : []);

      // Parseia usuários — falha aqui não bloqueia a listagem de marcas
      const uData = await uRes.json().catch(() => []);
      setMarcaUsers(Array.isArray(uData) ? uData : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar marcas");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const userBySlug = (slug: string) => marcaUsers.find((u) => u.marca_slug === slug);

  function openCreate() { setForm(emptyForm); setFormErr(""); setModal({ open: true, editing: null }); }
  function openEdit(m: Marca) {
    setForm({
      slug: m.slug, name: m.name, segment: m.segment ?? "", logo_url: m.logo_url ?? "", ativo: m.ativo,
      razao_social: m.razao_social ?? "",
      cnpj: m.cnpj ?? "", email: m.email ?? "", telefone: m.telefone ?? "", contato: m.contato ?? "",
      cep: m.cep ?? "", logradouro: m.logradouro ?? "", numero: m.numero ?? "",
      complemento: m.complemento ?? "", bairro: m.bairro ?? "", cidade: m.cidade ?? "", estado: m.estado ?? "",
    });
    setFormErr(""); setModal({ open: true, editing: m });
  }
  function closeModal() { setModal({ open: false, editing: null }); }

  function field(key: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [key]: e.target.value }));
  }

  function handleCnpjChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatCnpj(e.target.value);
    setForm(p => ({ ...p, cnpj: formatted }));
    const digits = formatted.replace(/\D/g, "");
    if (cnpjRef.current) clearTimeout(cnpjRef.current);
    if (digits.length === 14) {
      cnpjRef.current = setTimeout(async () => {
        setCnpjLoading(true);
        try {
          const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
          if (!r.ok) return;
          const d = await r.json();
          setForm(p => ({
            ...p,
            razao_social: p.razao_social || (d.razao_social ?? ""),
            name:       p.name       || (d.razao_social ?? ""),
            email:      p.email      || (d.email        ?? ""),
            telefone:   p.telefone   || (d.ddd_telefone_1 ? d.ddd_telefone_1.replace(/[^0-9]/g, "").replace(/(\d{2})(\d{4,5})(\d{4})/, "($1) $2-$3") : ""),
            cep:        p.cep        || formatCep(d.cep ?? ""),
            logradouro: p.logradouro || (d.logradouro   ?? ""),
            numero:     p.numero     || (d.numero        ?? ""),
            complemento:p.complemento|| (d.complemento  ?? ""),
            bairro:     p.bairro     || (d.bairro        ?? ""),
            cidade:     p.cidade     || (d.municipio     ?? ""),
            estado:     p.estado     || (d.uf            ?? ""),
          }));
        } finally { setCnpjLoading(false); }
      }, 500);
    }
  }

  function handleCepChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatCep(e.target.value);
    setForm(p => ({ ...p, cep: formatted }));
    const digits = formatted.replace(/\D/g, "");
    if (cepRef.current) clearTimeout(cepRef.current);
    if (digits.length === 8) {
      cepRef.current = setTimeout(async () => {
        setCepLoading(true);
        try {
          const r = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
          const d = await r.json();
          if (!d.erro) {
            setForm(p => ({
              ...p,
              logradouro:  p.logradouro  || (d.logradouro  ?? ""),
              bairro:      p.bairro      || (d.bairro       ?? ""),
              cidade:      p.cidade      || (d.localidade   ?? ""),
              estado:      p.estado      || (d.uf           ?? ""),
              complemento: p.complemento || (d.complemento  ?? ""),
            }));
          }
        } finally { setCepLoading(false); }
      }, 400);
    }
  }

  async function handleSave() {
    if (!form.slug.trim()) { setFormErr("Slug obrigatório"); return; }
    if (!form.name.trim()) { setFormErr("Nome obrigatório"); return; }
    setSaving(true); setFormErr("");
    try {
      const method = modal.editing ? "PATCH" : "POST";
      const url    = modal.editing ? `/api/admin/marcas/${modal.editing.id}` : "/api/admin/marcas";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: form.slug.trim().toLowerCase(), name: form.name.trim(),
          segment: form.segment.trim() || null, logo_url: form.logo_url.trim() || null, ativo: form.ativo,
          razao_social: form.razao_social.trim() || null,
          cnpj: form.cnpj.trim() || null, email: form.email.trim() || null,
          telefone: form.telefone.trim() || null, contato: form.contato.trim() || null,
          cep: form.cep.trim() || null, logradouro: form.logradouro.trim() || null,
          numero: form.numero.trim() || null, complemento: form.complemento.trim() || null,
          bairro: form.bairro.trim() || null, cidade: form.cidade.trim() || null, estado: form.estado.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      closeModal(); await load();
    } catch (e) { setFormErr(e instanceof Error ? e.message : "Erro ao salvar"); }
    finally { setSaving(false); }
  }

  async function handleCreateAccess() {
    if (!accessModal || !accessEmail.trim()) return;
    setAccessSaving(true);
    try {
      const res  = await fetch("/api/admin/marca-users", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: accessEmail.trim(), marca_slug: accessModal.slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAccessResult({ email: data.email, resetLink: data.resetLink });
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao criar acesso"); }
    finally { setAccessSaving(false); }
  }

  async function handleResendLink(slug: string) {
    setLinkLoading(true);
    try {
      const res  = await fetch("/api/admin/marca-users", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marca_slug: slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLinkData({ email: data.email, resetLink: data.resetLink });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao gerar link"); }
    finally { setLinkLoading(false); }
  }

  async function handleRevoke(user_id: string) {
    setRevoking(true);
    try {
      const res  = await fetch("/api/admin/marca-users", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Acesso removido.");
      setRevokeId(null); await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao remover acesso"); }
    finally { setRevoking(false); }
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      const res  = await fetch(`/api/admin/marcas/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Marca excluída.");
      setDelId(null); await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao excluir marca"); }
    finally { setDeleting(false); }
  }

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center gap-3 mb-6">
        <div>
          <h1 className="text-xl font-black text-white">Marcas</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {marcas.filter(m => m.ativo).length} ativa{marcas.filter(m => m.ativo).length !== 1 ? "s" : ""} · {marcas.length} total
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={load} disabled={loading} className="p-2 text-gray-500 hover:text-white bg-dark-800 border border-white/8 rounded-xl transition-all">
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 bg-brand hover:bg-brand-hover text-white text-sm font-bold rounded-xl transition-all">
            <Plus size={15} /> Nova marca
          </button>
        </div>
      </div>

      <div className="bg-dark-800 border border-white/8 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin" /> Carregando...
          </div>
        ) : marcas.length === 0 ? (
          <div className="p-12 text-center">
            <Tag size={32} className="text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Nenhuma marca cadastrada.</p>
            <button onClick={openCreate} className="mt-4 px-5 py-2.5 bg-brand hover:bg-brand-hover text-white text-sm font-bold rounded-xl transition-all">
              Cadastrar primeira marca
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 text-left">
                {["Logo", "Marca", "Contato", "Status", "Acesso", "Ações"].map((h) => (
                  <th key={h} className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {marcas.map((m) => {
                const mu = userBySlug(m.slug);
                return (
                  <tr key={m.id} className={`border-b border-white/5 hover:bg-white/3 transition-colors ${!m.ativo ? "opacity-50" : ""}`}>
                    {/* Logo */}
                    <td className="py-3 px-4">
                      {m.logo_url ? (
                        <div className="w-20 h-10 bg-dark-900 border border-white/8 rounded-lg flex items-center justify-center px-2">
                          <Image src={m.logo_url} alt={m.name} width={64} height={32} className="object-contain h-7 w-auto" />
                        </div>
                      ) : (
                        <div className="w-20 h-10 bg-dark-900 border border-white/8 rounded-lg flex items-center justify-center">
                          <Tag size={14} className="text-gray-600" />
                        </div>
                      )}
                    </td>

                    {/* Marca */}
                    <td className="py-3 px-4">
                      <p className="text-white font-semibold">{m.name}</p>
                      <p className="text-[11px] text-gray-600 font-mono mt-0.5">{m.slug}</p>
                      {m.cnpj && <p className="text-[11px] text-gray-600 mt-0.5">{m.cnpj}</p>}
                    </td>

                    {/* Contato */}
                    <td className="py-3 px-4">
                      <p className="text-xs text-gray-400">{m.contato ?? "—"}</p>
                      {m.email && <p className="text-[11px] text-gray-600 mt-0.5">{m.email}</p>}
                      {m.telefone && <p className="text-[11px] text-gray-600 mt-0.5">{m.telefone}</p>}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
                        m.ativo ? "bg-green-400/15 text-green-400 border-green-400/25" : "bg-gray-400/15 text-gray-400 border-gray-400/25"
                      }`}>
                        {m.ativo ? "Ativa" : "Inativa"}
                      </span>
                    </td>

                    {/* Acesso */}
                    <td className="py-3 px-4">
                      {mu ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <ShieldCheck size={11} className="text-green-400 flex-shrink-0" />
                            <span className="text-xs text-green-400 font-semibold truncate max-w-[160px]">{mu.email}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => { setLinkModal({ slug: m.slug, name: m.name, email: mu.email }); setLinkData(null); handleResendLink(m.slug); }}
                              className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-blue-400 hover:text-white bg-blue-400/10 hover:bg-blue-400/20 border border-blue-400/20 rounded-lg transition-all"
                              title="Gerar novo link de acesso"
                            >
                              <RefreshCcw size={10} /> Reenviar link
                            </button>
                            <button
                              onClick={() => setRevokeId({ user_id: mu.user_id, name: m.name })}
                              className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-red-400 hover:text-white bg-red-400/10 hover:bg-red-400/20 border border-red-400/20 rounded-lg transition-all"
                              title="Remover acesso"
                            >
                              <UserX size={10} /> Remover
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setAccessModal({ slug: m.slug, name: m.name }); setAccessEmail(""); setAccessResult(null); }}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-gray-400 hover:text-white bg-dark-700 hover:bg-white/8 border border-white/10 rounded-xl transition-all"
                        >
                          <UserPlus size={12} /> Criar acesso
                        </button>
                      )}
                    </td>

                    {/* Ações */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(m)}
                          className="p-1.5 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-all" title="Editar"
                        ><Pencil size={14} /></button>
                        <button onClick={() => setDelId(m.id)}
                          className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all" title="Excluir"
                        ><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modal criar / editar marca ── */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={closeModal}>
          <div className="bg-dark-800 border border-white/10 rounded-2xl w-full max-w-lg flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/8 flex-shrink-0">
              <h3 className="text-sm font-bold text-white">{modal.editing ? "Editar marca" : "Nova marca"}</h3>
              <button onClick={closeModal} className="text-gray-500 hover:text-white transition-colors"><X size={16} /></button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
              {formErr && <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2">{formErr}</p>}

              <div>
                <p className={sec}>Identificação</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lbl}>Slug *</label>
                      <input value={form.slug} onChange={field("slug")} placeholder="ex: attis"
                        className={`${inp} ${modal.editing ? "opacity-50 cursor-not-allowed" : ""}`}
                        disabled={!!modal.editing}
                      />
                      {modal.editing && <p className="text-[10px] text-gray-600 mt-1">Não pode ser alterado</p>}
                    </div>
                    <div>
                      <label className={lbl}>Nome *</label>
                      <input value={form.name} onChange={field("name")} placeholder="Ex: ATTIS" className={inp} />
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>Razão Social</label>
                    <input value={form.razao_social} onChange={field("razao_social")} placeholder="Ex: ATTIS INDÚSTRIA LTDA" className={inp} />
                  </div>
                  <div>
                    <label className={lbl}>Segmento</label>
                    <input value={form.segment} onChange={field("segment")} placeholder="Ex: Tapetes e Proteção" className={inp} />
                  </div>
                </div>
              </div>

              <div>
                <p className={sec}>Logo</p>
                <label className={lbl}>Caminho ou URL</label>
                <input value={form.logo_url} onChange={field("logo_url")} placeholder="/images/brands/attis.png" className={inp} />
                {form.logo_url && (
                  <div className="mt-2 flex items-center gap-3">
                    <div className="w-24 h-11 bg-dark-900 border border-white/8 rounded-lg flex items-center justify-center px-2">
                      <Image src={form.logo_url} alt="preview" width={72} height={36} className="object-contain h-8 w-auto" />
                    </div>
                    <p className="text-xs text-gray-600">Preview do logo</p>
                  </div>
                )}
              </div>

              <div>
                <p className={sec}>Dados fiscais e contato</p>
                <div className="space-y-3">
                  <div>
                    <label className={lbl}>
                      CNPJ
                      {cnpjLoading && <span className="ml-2 text-[10px] text-brand font-normal animate-pulse">buscando dados...</span>}
                    </label>
                    <div className="relative">
                      <input value={form.cnpj} onChange={handleCnpjChange} placeholder="00.000.000/0001-00" maxLength={18} className={`${inp} pr-9`} />
                      {cnpjLoading
                        ? <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand animate-spin" />
                        : <Search size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
                      }
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lbl}>E-mail</label>
                      <input type="email" value={form.email} onChange={field("email")} placeholder="contato@marca.com" className={inp} />
                    </div>
                    <div>
                      <label className={lbl}>Telefone</label>
                      <input value={form.telefone} onChange={field("telefone")} placeholder="(00) 00000-0000" className={inp} />
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>Responsável Comercial</label>
                    <input value={form.contato} onChange={field("contato")} placeholder="Nome do responsável comercial" className={inp} />
                  </div>
                </div>
              </div>

              <div>
                <p className={sec}>Endereço</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lbl}>
                        CEP
                        {cepLoading && <span className="ml-2 text-[10px] text-brand font-normal animate-pulse">buscando...</span>}
                      </label>
                      <div className="relative">
                        <input value={form.cep} onChange={handleCepChange} placeholder="00000-000" maxLength={9} className={`${inp} pr-8`} />
                        {cepLoading && <Loader2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand animate-spin" />}
                      </div>
                    </div>
                    <div>
                      <label className={lbl}>Número</label>
                      <input value={form.numero} onChange={field("numero")} placeholder="123" className={inp} />
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>Logradouro</label>
                    <input value={form.logradouro} onChange={field("logradouro")} placeholder="Rua, Avenida..." className={inp} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lbl}>Complemento</label>
                      <input value={form.complemento} onChange={field("complemento")} placeholder="Sala, Andar..." className={inp} />
                    </div>
                    <div>
                      <label className={lbl}>Bairro</label>
                      <input value={form.bairro} onChange={field("bairro")} placeholder="Bairro" className={inp} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className={lbl}>Cidade</label>
                      <input value={form.cidade} onChange={field("cidade")} placeholder="Cidade" className={inp} />
                    </div>
                    <div>
                      <label className={lbl}>UF</label>
                      <input value={form.estado} onChange={field("estado")} placeholder="SP" maxLength={2} className={inp} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pb-1">
                <button type="button"
                  onClick={() => setForm(p => ({ ...p, ativo: !p.ativo }))}
                  className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${form.ativo ? "bg-brand" : "bg-dark-600 border border-white/10"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.ativo ? "translate-x-4" : ""}`} />
                </button>
                <span className="text-sm text-gray-300 cursor-pointer select-none" onClick={() => setForm(p => ({ ...p, ativo: !p.ativo }))}>
                  {form.ativo ? "Marca ativa (aparece no portal)" : "Marca inativa (oculta no portal)"}
                </span>
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-white/8 flex-shrink-0">
              <button onClick={closeModal} disabled={saving} className="flex-1 py-2.5 bg-dark-700 border border-white/10 text-gray-300 rounded-xl text-sm disabled:opacity-50">Cancelar</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal criar acesso ── */}
      {accessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => !accessSaving && (setAccessModal(null), setAccessResult(null))}>
          <div className="bg-dark-800 border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Criar acesso — {accessModal.name}</h3>
                <p className="text-xs text-gray-500 mt-1">O usuário receberá um link para definir a senha.</p>
              </div>
              <button onClick={() => { setAccessModal(null); setAccessResult(null); }} className="text-gray-500 hover:text-white"><X size={15} /></button>
            </div>

            {!accessResult ? (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">E-mail da marca</label>
                  <input type="email" value={accessEmail} onChange={(e) => setAccessEmail(e.target.value)}
                    placeholder="contato@marca.com"
                    className="w-full px-3 py-2.5 bg-dark-900 border border-white/10 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-brand/50 transition-all"
                  />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setAccessModal(null); setAccessResult(null); }} disabled={accessSaving}
                    className="flex-1 py-2.5 bg-dark-700 border border-white/10 text-gray-300 rounded-xl text-sm disabled:opacity-50"
                  >Cancelar</button>
                  <button onClick={handleCreateAccess} disabled={accessSaving || !accessEmail.trim()}
                    className="flex-1 py-2.5 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {accessSaving && <Loader2 size={13} className="animate-spin" />}
                    <UserPlus size={13} /> Criar acesso
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="bg-green-400/10 border border-green-400/20 rounded-xl p-3">
                  <p className="text-xs font-bold text-green-400 mb-1">Acesso criado!</p>
                  <p className="text-xs text-gray-400">E-mail: <span className="text-white font-semibold">{accessResult.email}</span></p>
                </div>
                {accessResult.resetLink && <LinkBox link={accessResult.resetLink} />}
                <button onClick={() => { setAccessModal(null); setAccessResult(null); }}
                  className="w-full py-2.5 bg-dark-700 border border-white/10 text-gray-300 rounded-xl text-sm"
                >Fechar</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal reenviar link ── */}
      {linkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setLinkModal(null)}>
          <div className="bg-dark-800 border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Link de acesso — {linkModal.name}</h3>
                <p className="text-xs text-gray-500 mt-1">{linkModal.email}</p>
              </div>
              <button onClick={() => setLinkModal(null)} className="text-gray-500 hover:text-white"><X size={15} /></button>
            </div>

            {linkLoading ? (
              <div className="flex items-center justify-center gap-2 py-4 text-gray-500 text-sm">
                <Loader2 size={15} className="animate-spin" /> Gerando link...
              </div>
            ) : linkData?.resetLink ? (
              <div className="space-y-3">
                <p className="text-xs text-gray-400">Novo link de definição de senha (expira em 24h):</p>
                <LinkBox link={linkData.resetLink} />
                <button onClick={() => setLinkModal(null)}
                  className="w-full py-2.5 bg-dark-700 border border-white/10 text-gray-300 rounded-xl text-sm"
                >Fechar</button>
              </div>
            ) : (
              <div className="flex gap-3">
                <button onClick={() => setLinkModal(null)} className="flex-1 py-2.5 bg-dark-700 border border-white/10 text-gray-300 rounded-xl text-sm">Fechar</button>
                <button onClick={() => handleResendLink(linkModal.slug)} disabled={linkLoading}
                  className="flex-1 py-2.5 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2"
                >
                  <RefreshCcw size={13} /> Tentar novamente
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal remover acesso ── */}
      {revokeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => !revoking && setRevokeId(null)}>
          <div className="bg-dark-800 border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold text-white">Remover acesso — {revokeId.name}?</p>
            <p className="text-xs text-gray-500">O usuário não conseguirá mais acessar o painel da marca. Os dados da marca não serão afetados.</p>
            <div className="flex gap-3">
              <button onClick={() => setRevokeId(null)} disabled={revoking}
                className="flex-1 py-2.5 bg-dark-700 border border-white/10 text-gray-300 rounded-xl text-sm disabled:opacity-50"
              >Cancelar</button>
              <button onClick={() => handleRevoke(revokeId.user_id)} disabled={revoking}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {revoking && <Loader2 size={14} className="animate-spin" />}
                {revoking ? "Removendo..." : "Remover acesso"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal excluir marca ── */}
      {delId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => !deleting && setDelId(null)}>
          <div className="bg-dark-800 border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold text-white">Excluir marca?</p>
            <p className="text-xs text-gray-500">Pedidos existentes que referenciam esta marca não serão afetados.</p>
            <div className="flex gap-3">
              <button onClick={() => setDelId(null)} disabled={deleting}
                className="flex-1 py-2.5 bg-dark-700 border border-white/10 text-gray-300 rounded-xl text-sm disabled:opacity-50"
              >Cancelar</button>
              <button onClick={() => handleDelete(delId)} disabled={deleting}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting && <Loader2 size={14} className="animate-spin" />}
                {deleting ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LinkBox({ link }: { link: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input readOnly value={link}
          className="flex-1 min-w-0 px-2 py-1.5 bg-dark-900 border border-white/10 rounded-lg text-[10px] font-mono text-gray-400 truncate"
        />
        <button onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copiado!"); }}
          className="p-1.5 text-gray-400 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-all flex-shrink-0"
        ><Copy size={12} /></button>
        <a href={link} target="_blank" rel="noopener noreferrer"
          className="p-1.5 text-gray-400 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-all flex-shrink-0"
        ><ExternalLink size={12} /></a>
      </div>
      <p className="text-[10px] text-gray-600">O link expira em 24h. O usuário acessa em <span className="font-semibold">/marca/login</span></p>
    </div>
  );
}
