"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  Loader2, Save, Search, Building2, Upload, Lock, Mail, Eye, EyeOff,
  CheckCircle, ImageIcon, ShoppingBag, LinkIcon, Unlink, RefreshCw, User,
} from "lucide-react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

interface PerfilData {
  slug: string; name: string; razao_social: string | null;
  cnpj: string | null; email: string | null; telefone: string | null;
  contato: string | null; cep: string | null; logradouro: string | null;
  numero: string | null; complemento: string | null; bairro: string | null;
  cidade: string | null; estado: string | null; logo_url: string | null;
  segment: string | null;
  ml_user_id: string | null; ml_token_expires_at: string | null; ml_nickname: string | null;
}

type FormData = {
  name: string; razao_social: string; cnpj: string; email: string;
  telefone: string; contato: string; cep: string; logradouro: string;
  numero: string; complemento: string; bairro: string; cidade: string;
  estado: string;
};

const inp = "w-full px-3 py-2.5 bg-dark-950 border border-white/10 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-brand/50 transition-all";
const lbl = "block text-xs font-semibold text-gray-400 mb-1.5";

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

export default function MarcaPerfilPage() {
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cepLoading,  setCepLoading]  = useState(false);
  const [slug,        setSlug]        = useState("");
  const [logoUrl,     setLogoUrl]     = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [authEmail,   setAuthEmail]   = useState("");
  const [mlUserId,    setMlUserId]    = useState<string | null>(null);
  const [mlExpiresAt, setMlExpiresAt] = useState<string | null>(null);
  const [mlNickname,  setMlNickname]  = useState<string | null>(null);
  const [mlSyncing,   setMlSyncing]   = useState(false);
  const [mlDisconnecting, setMlDisconnecting] = useState(false);

  // Segurança
  const [emailNovo,       setEmailNovo]       = useState("");
  const [emailSenha,      setEmailSenha]      = useState("");
  const [emailSaving,     setEmailSaving]     = useState(false);
  const [senhaAtual,      setSenhaAtual]      = useState("");
  const [senhaNova,       setSenhaNova]       = useState("");
  const [senhaConfirm,    setSenhaConfirm]    = useState(false ? "" : "");
  const [senhaNovaCfm,    setSenhaNovaCfm]    = useState("");
  const [senhaSaving,     setSenhaSaving]     = useState(false);
  const [showEmailSenha,  setShowEmailSenha]  = useState(false);
  const [showSenhaAtual,  setShowSenhaAtual]  = useState(false);
  const [showSenhaNova,   setShowSenhaNova]   = useState(false);

  const [form, setForm] = useState<FormData>({
    name: "", razao_social: "", cnpj: "", email: "", telefone: "",
    contato: "", cep: "", logradouro: "", numero: "", complemento: "",
    bairro: "", cidade: "", estado: "",
  });

  async function handleMlDisconnect() {
    setMlDisconnecting(true);
    try {
      const res = await fetch("/api/ml/auth", { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao desconectar");
      setMlUserId(null);
      setMlExpiresAt(null);
      setMlNickname(null);
      toast.success("Conta do Mercado Livre desconectada.");
    } catch { toast.error("Erro ao desconectar do Mercado Livre"); }
    finally { setMlDisconnecting(false); }
  }

  const [mlConnecting, setMlConnecting] = useState(false);

  function handleMlConnect() {
    const marcaSlug   = slug || (document.cookie.match(/marca_slug=([^;]+)/)?.[1] ?? "");
    const redirectUri = window.location.origin + "/api/ml/callback";
    setMlConnecting(true);
    const params = new URLSearchParams({
      response_type: "code",
      client_id:     "3882432669886480",
      redirect_uri:  redirectUri,
      state:         marcaSlug,
    });
    window.location.href = `https://auth.mercadolivre.com.br/authorization?${params}`;
  }

  async function handleMlSync() {
    setMlSyncing(true);
    try {
      const res  = await fetch("/api/ml/me");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMlNickname(data.nickname ?? data.name ?? null);
      toast.success("Dados do ML atualizados!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao sincronizar");
    } finally { setMlSyncing(false); }
  }

  const cnpjRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cepRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef  = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  async function load() {
    setLoading(true);
    try {
      const res  = await fetch("/api/marca/perfil");
      const data: PerfilData = await res.json();
      if (!res.ok) throw new Error((data as unknown as { error: string }).error);
      setSlug(data.slug);
      setLogoUrl(data.logo_url);
      setMlUserId(data.ml_user_id ?? null);
      setMlExpiresAt(data.ml_token_expires_at ?? null);
      setMlNickname(data.ml_nickname ?? null);
      /* auto-sync nickname se conta conectada mas nickname vazio */
      if (data.ml_user_id && !data.ml_nickname) {
        fetch("/api/ml/me").then(r => r.json()).then(d => {
          if (d.nickname || d.name) setMlNickname(d.nickname ?? d.name ?? null);
        }).catch(() => {});
      }
      setForm({
        name:        data.name         ?? "",
        razao_social:data.razao_social  ?? "",
        cnpj:        data.cnpj          ?? "",
        email:       data.email         ?? "",
        telefone:    data.telefone      ?? "",
        contato:     data.contato       ?? "",
        cep:         data.cep           ?? "",
        logradouro:  data.logradouro    ?? "",
        numero:      data.numero        ?? "",
        complemento: data.complemento   ?? "",
        bairro:      data.bairro        ?? "",
        cidade:      data.cidade        ?? "",
        estado:      data.estado        ?? "",
      });
      const { data: { user } } = await supabase.auth.getUser();
      setAuthEmail(user?.email ?? "");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao carregar perfil"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

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
            email:        p.email        || (d.email        ?? ""),
            telefone:     p.telefone     || (d.ddd_telefone_1 ? d.ddd_telefone_1.replace(/[^0-9]/g, "").replace(/(\d{2})(\d{4,5})(\d{4})/, "($1) $2-$3") : ""),
            cep:          p.cep          || formatCep(d.cep ?? ""),
            logradouro:   p.logradouro   || (d.logradouro  ?? ""),
            numero:       p.numero       || (d.numero       ?? ""),
            complemento:  p.complemento  || (d.complemento ?? ""),
            bairro:       p.bairro       || (d.bairro       ?? ""),
            cidade:       p.cidade       || (d.municipio    ?? ""),
            estado:       p.estado       || (d.uf           ?? ""),
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
              logradouro:  p.logradouro  || (d.logradouro ?? ""),
              bairro:      p.bairro      || (d.bairro      ?? ""),
              cidade:      p.cidade      || (d.localidade  ?? ""),
              estado:      p.estado      || (d.uf          ?? ""),
              complemento: p.complemento || (d.complemento ?? ""),
            }));
          }
        } finally { setCepLoading(false); }
      }, 400);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/marca/perfil/logo", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLogoUrl(data.url);
      toast.success("Logo atualizado!");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro no upload"); }
    finally { setLogoUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error("Nome obrigatório"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/marca/perfil", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:        form.name.trim()        || null,
          razao_social:form.razao_social.trim()|| null,
          cnpj:        form.cnpj.trim()        || null,
          email:       form.email.trim()       || null,
          telefone:    form.telefone.trim()    || null,
          contato:     form.contato.trim()     || null,
          cep:         form.cep.trim()         || null,
          logradouro:  form.logradouro.trim()  || null,
          numero:      form.numero.trim()      || null,
          complemento: form.complemento.trim() || null,
          bairro:      form.bairro.trim()      || null,
          cidade:      form.cidade.trim()      || null,
          estado:      form.estado.trim()      || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Perfil atualizado!");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao salvar"); }
    finally { setSaving(false); }
  }

  async function handleEmailChange() {
    if (!emailNovo.trim()) { toast.error("Informe o novo e-mail"); return; }
    if (!emailSenha)       { toast.error("Informe sua senha atual"); return; }
    setEmailSaving(true);
    try {
      const { error: signErr } = await supabase.auth.signInWithPassword({ email: authEmail, password: emailSenha });
      if (signErr) throw new Error("Senha incorreta");
      const { error } = await supabase.auth.updateUser({ email: emailNovo.trim() });
      if (error) throw new Error(error.message);
      toast.success("Confirme o novo e-mail pela caixa de entrada!");
      setEmailNovo(""); setEmailSenha("");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    finally { setEmailSaving(false); }
  }

  async function handlePasswordChange() {
    if (!senhaAtual)      { toast.error("Informe a senha atual"); return; }
    if (!senhaNova)       { toast.error("Informe a nova senha"); return; }
    if (senhaNova.length < 6) { toast.error("Senha deve ter pelo menos 6 caracteres"); return; }
    if (senhaNova !== senhaNovaCfm) { toast.error("As senhas não coincidem"); return; }
    setSenhaSaving(true);
    try {
      const { error: signErr } = await supabase.auth.signInWithPassword({ email: authEmail, password: senhaAtual });
      if (signErr) throw new Error("Senha atual incorreta");
      const { error } = await supabase.auth.updateUser({ password: senhaNova });
      if (error) throw new Error(error.message);
      toast.success("Senha alterada com sucesso!");
      setSenhaAtual(""); setSenhaNova(""); setSenhaNovaCfm("");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    finally { setSenhaSaving(false); }
  }

  return (
    <div className="min-h-screen">
      <header className="bg-dark-900 border-b border-white/8">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 size={15} className="text-brand" />
            <h1 className="text-sm font-bold text-white">Perfil da Empresa</h1>
            {slug && <span className="text-xs text-gray-600 font-mono">/{slug}</span>}
          </div>
          <button onClick={handleSave} disabled={saving || loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand hover:bg-brand-hover text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </header>

      {loading ? (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center text-gray-500 text-sm">
          <Loader2 size={20} className="animate-spin mx-auto mb-2" /> Carregando...
        </div>
      ) : (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">

          {/* ── Logo ── */}
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-5 space-y-4">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Logo da marca</p>
            <div className="flex items-center gap-5">
              <div
                onClick={() => fileRef.current?.click()}
                className="relative w-24 h-16 bg-dark-900 border-2 border-dashed border-white/15 hover:border-brand/40 rounded-xl flex items-center justify-center cursor-pointer transition-all group overflow-hidden flex-shrink-0"
              >
                {logoUploading ? (
                  <Loader2 size={18} className="text-brand animate-spin" />
                ) : logoUrl ? (
                  <>
                    <Image src={logoUrl} alt="Logo" fill className="object-contain p-2" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Upload size={14} className="text-white" />
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-gray-600 group-hover:text-gray-400 transition-colors">
                    <ImageIcon size={18} />
                    <span className="text-[9px]">Upload</span>
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-white mb-1">
                  {logoUrl ? "Clique na imagem para trocar" : "Adicionar logo"}
                </p>
                <p className="text-xs text-gray-500">PNG, JPG, WEBP ou SVG · máx. 2 MB</p>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={logoUploading}
                  className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-dark-700 border border-white/10 hover:border-white/20 text-gray-300 hover:text-white rounded-lg transition-all disabled:opacity-50"
                >
                  <Upload size={11} /> {logoUploading ? "Enviando..." : "Escolher arquivo"}
                </button>
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          </div>

          {/* ── Identificação ── */}
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-5 space-y-4">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Identificação</p>
            <div>
              <label className={lbl}>Nome exibido *</label>
              <input value={form.name} onChange={field("name")} placeholder="Ex: ATTIS" className={inp} />
            </div>
            <div>
              <label className={lbl}>Razão Social</label>
              <input value={form.razao_social} onChange={field("razao_social")} placeholder="Ex: ATTIS INDÚSTRIA LTDA" className={inp} />
            </div>
          </div>

          {/* ── Dados fiscais e contato ── */}
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-5 space-y-4">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Dados fiscais e contato</p>
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
                <label className={lbl}>E-mail comercial</label>
                <input type="email" value={form.email} onChange={field("email")} placeholder="contato@marca.com" className={inp} />
              </div>
              <div>
                <label className={lbl}>Telefone</label>
                <input value={form.telefone} onChange={field("telefone")} placeholder="(00) 00000-0000" className={inp} />
              </div>
            </div>
            <div>
              <label className={lbl}>Responsável Comercial</label>
              <input value={form.contato} onChange={field("contato")} placeholder="Nome do responsável" className={inp} />
            </div>
          </div>

          {/* ── Endereço ── */}
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-5 space-y-4">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Endereço</p>
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

          {/* ── Botão salvar ── */}
          <button onClick={handleSave} disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl text-sm transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>

          {/* ── Segurança ── */}
          <div className="bg-dark-800 border border-white/8 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/8 flex items-center gap-2">
              <Lock size={13} className="text-gray-500" />
              <h2 className="text-sm font-bold text-white">Acesso e segurança</h2>
            </div>

            {/* Alterar e-mail */}
            <div className="px-5 py-4 border-b border-white/8 space-y-3">
              <div className="flex items-center gap-2">
                <Mail size={12} className="text-gray-500" />
                <p className="text-xs font-semibold text-gray-300">Alterar e-mail de acesso</p>
              </div>
              <p className="text-xs text-gray-600">E-mail atual: <span className="text-gray-400">{authEmail}</span></p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Novo e-mail</label>
                  <input type="email" value={emailNovo} onChange={e => setEmailNovo(e.target.value)}
                    placeholder="novo@email.com" className={inp} />
                </div>
                <div>
                  <label className={lbl}>Senha atual (confirmação)</label>
                  <div className="relative">
                    <input
                      type={showEmailSenha ? "text" : "password"}
                      value={emailSenha} onChange={e => setEmailSenha(e.target.value)}
                      placeholder="••••••••" className={`${inp} pr-9`}
                    />
                    <button type="button" onClick={() => setShowEmailSenha(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                      {showEmailSenha ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>
              </div>
              <button onClick={handleEmailChange} disabled={emailSaving}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-dark-700 border border-white/10 hover:border-white/20 text-white rounded-xl transition-all disabled:opacity-50"
              >
                {emailSaving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                {emailSaving ? "Atualizando..." : "Atualizar e-mail"}
              </button>
            </div>

            {/* Alterar senha */}
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-center gap-2">
                <Lock size={12} className="text-gray-500" />
                <p className="text-xs font-semibold text-gray-300">Alterar senha</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={lbl}>Senha atual</label>
                  <div className="relative">
                    <input type={showSenhaAtual ? "text" : "password"} value={senhaAtual}
                      onChange={e => setSenhaAtual(e.target.value)} placeholder="••••••••" className={`${inp} pr-9`} />
                    <button type="button" onClick={() => setShowSenhaAtual(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                      {showSenhaAtual ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className={lbl}>Nova senha</label>
                  <div className="relative">
                    <input type={showSenhaNova ? "text" : "password"} value={senhaNova}
                      onChange={e => setSenhaNova(e.target.value)} placeholder="••••••••" className={`${inp} pr-9`} />
                    <button type="button" onClick={() => setShowSenhaNova(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                      {showSenhaNova ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className={lbl}>Confirmar nova senha</label>
                  <input type="password" value={senhaNovaCfm} onChange={e => setSenhaNovaCfm(e.target.value)}
                    placeholder="••••••••" className={inp} />
                </div>
              </div>
              {senhaNova && senhaNovaCfm && senhaNova !== senhaNovaCfm && (
                <p className="text-xs text-red-400">As senhas não coincidem.</p>
              )}
              <button onClick={handlePasswordChange} disabled={senhaSaving}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-dark-700 border border-white/10 hover:border-white/20 text-white rounded-xl transition-all disabled:opacity-50"
              >
                {senhaSaving ? <Loader2 size={12} className="animate-spin" /> : <Lock size={12} />}
                {senhaSaving ? "Alterando..." : "Alterar senha"}
              </button>
            </div>
          </div>

          {/* ── Mercado Livre ── */}
          <div className="bg-dark-800 border border-white/8 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 flex items-center gap-3 border-b border-white/5">
              <ShoppingBag size={14} className="text-yellow-400" />
              <p className="text-xs font-bold text-white">Integração Mercado Livre</p>
            </div>
            <div className="px-5 py-4">
              {mlUserId ? (
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User size={14} className="text-yellow-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                        <p className="text-sm font-semibold text-white">
                          {mlNickname ?? "Conta conectada"}
                        </p>
                        <button
                          onClick={handleMlSync}
                          disabled={mlSyncing}
                          title="Atualizar dados da conta"
                          className="text-gray-500 hover:text-gray-300 disabled:opacity-50 transition-colors"
                        >
                          <RefreshCw size={11} className={mlSyncing ? "animate-spin" : ""} />
                        </button>
                      </div>
                      {mlNickname && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          ID: <span className="font-mono text-gray-400">{mlUserId}</span>
                        </p>
                      )}
                      {mlExpiresAt && (
                        <p className="text-xs text-gray-600 mt-0.5">
                          Token expira em: {new Date(mlExpiresAt).toLocaleString("pt-BR")}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={handleMlDisconnect}
                    disabled={mlDisconnecting}
                    className="flex items-center gap-1.5 px-3 py-2 bg-dark-700 border border-white/10 hover:border-red-400/30 hover:text-red-400 text-gray-400 text-xs font-semibold rounded-xl transition-all disabled:opacity-50 flex-shrink-0"
                  >
                    {mlDisconnecting ? <Loader2 size={12} className="animate-spin" /> : <Unlink size={12} />}
                    Desconectar
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-gray-600 inline-block" />
                      <p className="text-sm font-semibold text-gray-300">Não conectado</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">Conecte sua conta para publicar anúncios no ML</p>
                  </div>
                  <button
                    onClick={handleMlConnect}
                    disabled={mlConnecting}
                    className="flex items-center gap-1.5 px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-bold rounded-xl transition-all disabled:opacity-60"
                  >
                    {mlConnecting ? <Loader2 size={12} className="animate-spin" /> : <LinkIcon size={12} />}
                    {mlConnecting ? "Redirecionando..." : "Conectar ao ML"}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="pb-6" />
        </div>
      )}
    </div>
  );
}
