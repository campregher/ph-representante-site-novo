"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft, Save, Loader2, Upload, Lock, Mail, Eye, EyeOff,
  CheckCircle, ImageIcon, Clock, XCircle, Building2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface ClienteData {
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  inscricao_estadual?: string | null;
  status: "pendente" | "aprovado" | "reprovado";
  email: string;
  whatsapp: string;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  logo_url?: string | null;
  authEmail: string;
}

const statusConfig = {
  pendente:  { icon: Clock,       color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/20", label: "Aguardando aprovação" },
  aprovado:  { icon: CheckCircle, color: "text-green-400",  bg: "bg-green-400/10  border-green-400/20",  label: "Cadastro aprovado"     },
  reprovado: { icon: XCircle,     color: "text-red-400",    bg: "bg-red-400/10    border-red-400/20",    label: "Cadastro reprovado"    },
};

const inp = "w-full px-3 py-2.5 bg-dark-900 border border-white/10 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-brand/50 transition-all";
const lbl = "block text-xs font-semibold text-gray-400 mb-1.5";

function formatCep(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`;
}

export default function PortalPerfilPage() {
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [cepLoading,    setCepLoading]    = useState(false);
  const [authEmail,     setAuthEmail]     = useState("");
  const [logoUrl,       setLogoUrl]       = useState<string | null>(null);
  const [razaoSocial,   setRazaoSocial]   = useState("");
  const [cnpj,          setCnpj]          = useState("");
  const [inscricaoEst,  setInscricaoEst]  = useState<string | null>(null);
  const [statusCadastro, setStatusCadastro] = useState<"pendente" | "aprovado" | "reprovado">("pendente");

  // Campos editáveis
  const [nomeFant,    setNomeFant]    = useState("");
  const [whatsapp,    setWhatsapp]    = useState("");
  const [cep,         setCep]         = useState("");
  const [logradouro,  setLogradouro]  = useState("");
  const [numero,      setNumero]      = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro,      setBairro]      = useState("");
  const [cidade,      setCidade]      = useState("");
  const [estado,      setEstado]      = useState("");
  const [email,       setEmail]       = useState(""); // e-mail da tabela clientes

  // Segurança
  const [emailNovo,      setEmailNovo]      = useState("");
  const [emailSenha,     setEmailSenha]     = useState("");
  const [emailSaving,    setEmailSaving]    = useState(false);
  const [senhaAtual,     setSenhaAtual]     = useState("");
  const [senhaNova,      setSenhaNova]      = useState("");
  const [senhaNovaCfm,   setSenhaNovaCfm]   = useState("");
  const [senhaSaving,    setSenhaSaving]    = useState(false);
  const [showEmailSenha, setShowEmailSenha] = useState(false);
  const [showSenhaAtual, setShowSenhaAtual] = useState(false);
  const [showSenhaNova,  setShowSenhaNova]  = useState(false);

  const cepRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef  = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  async function load() {
    setLoading(true);
    try {
      const res  = await fetch("/api/portal/perfil");
      const json: ClienteData = await res.json();
      if (!res.ok) throw new Error((json as unknown as { error: string }).error);
      setAuthEmail(json.authEmail ?? "");
      setLogoUrl(json.logo_url ?? null);
      setRazaoSocial(json.razao_social ?? "");
      setCnpj(json.cnpj ?? "");
      setInscricaoEst(json.inscricao_estadual ?? null);
      setStatusCadastro(json.status ?? "pendente");
      setNomeFant(json.nome_fantasia ?? "");
      setWhatsapp(json.whatsapp ?? "");
      setEmail(json.email ?? "");
      setCep(json.cep ?? "");
      setLogradouro(json.logradouro ?? "");
      setNumero(json.numero ?? "");
      setComplemento(json.complemento ?? "");
      setBairro(json.bairro ?? "");
      setCidade(json.cidade ?? "");
      setEstado(json.estado ?? "");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao carregar perfil"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function handleCepChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatCep(e.target.value);
    setCep(formatted);
    const digits = formatted.replace(/\D/g, "");
    if (cepRef.current) clearTimeout(cepRef.current);
    if (digits.length === 8) {
      cepRef.current = setTimeout(async () => {
        setCepLoading(true);
        try {
          const r = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
          const d = await r.json();
          if (!d.erro) {
            if (!logradouro) setLogradouro(d.logradouro ?? "");
            if (!bairro)     setBairro(d.bairro ?? "");
            if (!cidade)     setCidade(d.localidade ?? "");
            if (!estado)     setEstado(d.uf ?? "");
            if (!complemento) setComplemento(d.complemento ?? "");
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
      const res  = await fetch("/api/portal/perfil/logo", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setLogoUrl(json.url);
      toast.success("Logo atualizado!");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro no upload"); }
    finally { setLogoUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function handleSave() {
    if (!whatsapp.trim()) { toast.error("WhatsApp obrigatório"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/portal/perfil", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome_fantasia: nomeFant.trim()    || null,
          email:         email.trim(),
          whatsapp:      whatsapp.trim(),
          cep:           cep.trim()         || null,
          logradouro:    logradouro.trim()  || null,
          numero:        numero.trim()      || null,
          complemento:   complemento.trim() || null,
          bairro:        bairro.trim()      || null,
          cidade:        cidade.trim()      || null,
          estado:        estado.trim()      || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
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
    if (!senhaAtual)          { toast.error("Informe a senha atual"); return; }
    if (!senhaNova)           { toast.error("Informe a nova senha"); return; }
    if (senhaNova.length < 6) { toast.error("Mínimo 6 caracteres"); return; }
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
          <div className="flex items-center gap-3">
            <Link href="/portal/dashboard"
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-dark-700 border border-white/10 text-gray-400 hover:text-white transition-all"
            >
              <ArrowLeft size={15} />
            </Link>
            <h1 className="text-sm font-bold text-white">Meu Perfil</h1>
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
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
          <Loader2 size={20} className="text-gray-500 animate-spin mx-auto" />
        </div>
      ) : (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">

          {/* ── Status ── */}
          {(() => {
            const s    = statusConfig[statusCadastro];
            const Icon = s.icon;
            return (
              <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${s.bg}`}>
                <Icon size={15} className={`${s.color} flex-shrink-0`} />
                <span className={`text-sm font-semibold ${s.color}`}>{s.label}</span>
              </div>
            );
          })()}

          {/* ── Dados da empresa (read-only) ── */}
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Building2 size={13} className="text-gray-500" />
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Dados da empresa</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
              <div className="col-span-2 sm:col-span-2">
                <p className="text-[11px] text-gray-500 mb-0.5">Razão Social</p>
                <p className="text-sm text-white font-semibold">{razaoSocial}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-500 mb-0.5">CNPJ</p>
                <p className="text-sm text-white font-mono tracking-wide">{cnpj}</p>
              </div>
              {inscricaoEst && (
                <div>
                  <p className="text-[11px] text-gray-500 mb-0.5">Inscrição Estadual</p>
                  <p className="text-sm text-white">{inscricaoEst}</p>
                </div>
              )}
            </div>
            <p className="text-[10px] text-gray-600 mt-4">Para alterar CNPJ ou Razão Social, entre em contato com a PH Representante.</p>
          </div>

          {/* ── Logo ── */}
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-5">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Logo da empresa</p>
            <div className="flex items-center gap-5">
              <div
                onClick={() => fileRef.current?.click()}
                className="relative w-20 h-20 bg-dark-900 border-2 border-dashed border-white/15 hover:border-brand/40 rounded-xl flex items-center justify-center cursor-pointer transition-all group overflow-hidden flex-shrink-0"
              >
                {logoUploading ? (
                  <Loader2 size={18} className="text-brand animate-spin" />
                ) : logoUrl ? (
                  <>
                    <Image src={logoUrl} alt="Logo" fill className="object-contain p-2" unoptimized />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Upload size={14} className="text-white" />
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-gray-600 group-hover:text-gray-400 transition-colors">
                    <ImageIcon size={20} />
                    <span className="text-[9px]">Logo</span>
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-white mb-1">
                  {logoUrl ? "Clique para trocar" : "Adicionar logo"}
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

          {/* ── Contato ── */}
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-5 space-y-4">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Contato</p>
            <div>
              <label className={lbl}>Nome Fantasia</label>
              <input value={nomeFant} onChange={e => setNomeFant(e.target.value)}
                placeholder="Nome fantasia (opcional)" className={inp} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>WhatsApp *</label>
                <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
                  placeholder="(00) 00000-0000" className={inp} />
              </div>
              <div>
                <label className={lbl}>E-mail de contato</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="contato@empresa.com" className={inp} />
              </div>
            </div>
          </div>

          {/* ── Endereço ── */}
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-5 space-y-4">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Endereço</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>
                  CEP {cepLoading && <span className="ml-1 text-[10px] text-brand animate-pulse">buscando...</span>}
                </label>
                <div className="relative">
                  <input value={cep} onChange={handleCepChange} placeholder="00000-000" maxLength={9} className={`${inp} pr-8`} />
                  {cepLoading && <Loader2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand animate-spin" />}
                </div>
              </div>
              <div>
                <label className={lbl}>Número</label>
                <input value={numero} onChange={e => setNumero(e.target.value)} placeholder="123" className={inp} />
              </div>
            </div>
            <div>
              <label className={lbl}>Logradouro</label>
              <input value={logradouro} onChange={e => setLogradouro(e.target.value)} placeholder="Rua, Avenida..." className={inp} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Complemento</label>
                <input value={complemento} onChange={e => setComplemento(e.target.value)} placeholder="Sala, Andar..." className={inp} />
              </div>
              <div>
                <label className={lbl}>Bairro</label>
                <input value={bairro} onChange={e => setBairro(e.target.value)} placeholder="Bairro" className={inp} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className={lbl}>Cidade</label>
                <input value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Cidade" className={inp} />
              </div>
              <div>
                <label className={lbl}>UF</label>
                <input value={estado} onChange={e => setEstado(e.target.value)} placeholder="SP" maxLength={2} className={inp} />
              </div>
            </div>
          </div>

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

            {/* Alterar e-mail de login */}
            <div className="px-5 py-4 border-b border-white/8 space-y-3">
              <div className="flex items-center gap-2">
                <Mail size={12} className="text-gray-500" />
                <p className="text-xs font-semibold text-gray-300">Alterar e-mail de acesso</p>
              </div>
              <p className="text-xs text-gray-600">Login atual: <span className="text-gray-400">{authEmail}</span></p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Novo e-mail</label>
                  <input type="email" value={emailNovo} onChange={e => setEmailNovo(e.target.value)}
                    placeholder="novo@email.com" className={inp} />
                </div>
                <div>
                  <label className={lbl}>Senha atual</label>
                  <div className="relative">
                    <input type={showEmailSenha ? "text" : "password"} value={emailSenha}
                      onChange={e => setEmailSenha(e.target.value)} placeholder="••••••••" className={`${inp} pr-9`} />
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

          <div className="pb-6" />
        </div>
      )}
    </div>
  );
}
