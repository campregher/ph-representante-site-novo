"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, CheckCircle, AlertCircle, Loader2, Eye, EyeOff, PencilLine, MapPin } from "lucide-react";

// ── Máscaras ──────────────────────────────────────────────
function maskCNPJ(v: string) {
  return v.replace(/\D/g, "").slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}
function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
  return d.replace(/^(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
}
function maskCEP(v: string) {
  return v.replace(/\D/g, "").slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
}
function maskIE(v: string) {
  return v.replace(/[^\dXx./-]/g, "").slice(0, 20);
}
// ─────────────────────────────────────────────────────────

// ── Validações ────────────────────────────────────────────
function validateIE(v: string) {
  if (!v.trim()) return "Inscrição Estadual é obrigatória";
  if (v.replace(/\D/g, "").length < 8) return "Inscrição Estadual inválida (mínimo 8 dígitos)";
  return "";
}
function validateEmail(v: string) {
  if (!v.trim()) return "Email é obrigatório";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return "Email inválido";
  return "";
}
function validateWhatsApp(v: string) {
  const d = v.replace(/\D/g, "");
  if (!v) return "WhatsApp é obrigatório";
  if (d.length < 10) return "Número inválido — inclua o DDD";
  if (d.length === 10) return "WhatsApp deve ser celular (11 dígitos com DDD)";
  return "";
}
function validatePassword(v: string) {
  if (!v) return "Senha é obrigatória";
  if (v.length < 6) return "Mínimo 6 caracteres";
  return "";
}
function validateConfirm(v: string, pass: string) {
  if (!v) return "Confirme a senha";
  if (v !== pass) return "Senhas não conferem";
  return "";
}
function passwordScore(v: string) {
  if (!v) return 0;
  let s = 0;
  if (v.length >= 6)  s++;
  if (v.length >= 10) s++;
  if (/[A-Z]/.test(v)) s++;
  if (/[0-9]/.test(v)) s++;
  if (/[^A-Za-z0-9]/.test(v)) s++;
  return s; // 0–5
}
// ─────────────────────────────────────────────────────────

type CnpjStatus = "idle" | "loading" | "found" | "error" | "manual";

interface RfData {
  cnpj: string; razao_social: string; nome_fantasia: string;
  cnae_codigo: string; cnae_descricao: string; is_automotive: boolean;
  cep: string; logradouro: string; numero: string; complemento: string;
  bairro: string; cidade: string; estado: string;
}

const inp  = "w-full px-3 py-2.5 bg-dark-900 border border-white/10 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-brand/50 transition-all";
const inpE = "w-full px-3 py-2.5 bg-dark-900 border border-red-500/50 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-red-500 transition-all";
const inp2 = "w-full px-3 py-2.5 bg-dark-700/60 border border-white/8 rounded-xl text-gray-400 text-sm cursor-not-allowed select-none";
const lbl  = "block text-xs font-semibold text-gray-400 mb-1.5";

function FieldError({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <p className="flex items-center gap-1 text-red-400 text-xs mt-1.5">
      <AlertCircle size={11} className="flex-shrink-0" /> {msg}
    </p>
  );
}

const Star = () => <span className="text-brand ml-0.5">*</span>;

export default function RegistroPage() {
  // CNPJ
  const [cnpj,       setCnpj]       = useState("");
  const [cnpjStatus, setCnpjStatus] = useState<CnpjStatus>("idle");
  const [cnpjErr,    setCnpjErr]    = useState("");
  const [rfData,     setRfData]     = useState<RfData | null>(null);

  // Empresa (manual ou editável)
  const [razaoSocial,  setRazaoSocial]  = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");

  // IE
  const [ie,    setIe]    = useState("");
  const [ieErr, setIeErr] = useState("");

  // Endereço
  const [addr,       setAddr]       = useState({ cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "" });
  const [cepLoading, setCepLoading] = useState(false);
  const setA = (k: keyof typeof addr, v: string) => setAddr(p => ({ ...p, [k]: v }));

  // Contato & Acesso
  const [email,           setEmail]           = useState("");
  const [emailErr,        setEmailErr]        = useState("");
  const [whatsapp,        setWhatsapp]        = useState("");
  const [whatsappErr,     setWhatsappErr]     = useState("");
  const [password,        setPassword]        = useState("");
  const [passwordErr,     setPasswordErr]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmErr,      setConfirmErr]      = useState("");
  const [showPass,        setShowPass]        = useState(false);

  // Envio
  const [submitting, setSubmitting] = useState(false);
  const [formErr,    setFormErr]    = useState("");
  const [success,    setSuccess]    = useState(false);

  const resolved = cnpjStatus === "found" || cnpjStatus === "manual";
  const score    = passwordScore(password);
  const strengthLabels = ["", "Fraca", "Fraca", "Média", "Boa", "Forte"];
  const strengthColors = ["", "bg-red-500", "bg-red-500", "bg-yellow-400", "bg-blue-400", "bg-green-400"];

  // ── Pesquisar CNPJ ──
  async function lookupCNPJ() {
    const clean = cnpj.replace(/\D/g, "");
    if (clean.length !== 14) { setCnpjErr("Digite os 14 dígitos do CNPJ."); return; }
    setCnpjStatus("loading"); setCnpjErr(""); setRfData(null);
    try {
      const res  = await fetch(`/api/cnpj/${clean}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "CNPJ não encontrado");
      setRfData(data);
      setNomeFantasia(data.nome_fantasia ?? "");
      setAddr({
        cep:         data.cep        ? maskCEP(data.cep) : "",
        logradouro:  data.logradouro  ?? "",
        numero:      data.numero      ?? "",
        complemento: data.complemento ?? "",
        bairro:      data.bairro      ?? "",
        cidade:      data.cidade      ?? "",
        estado:      data.estado      ?? "",
      });
      setCnpjStatus("found");
    } catch (e) {
      setCnpjErr(e instanceof Error ? e.message : "Erro ao consultar CNPJ");
      setCnpjStatus("error");
    }
  }

  function resetCnpj() {
    setCnpjStatus("idle"); setCnpjErr(""); setRfData(null);
    setNomeFantasia(""); setRazaoSocial("");
    setAddr({ cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "" });
  }

  // ── Busca de CEP ──
  const lookupCEP = useCallback(async (masked: string) => {
    const clean = masked.replace(/\D/g, "");
    if (clean.length !== 8) return;
    setCepLoading(true);
    try {
      const res  = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setAddr(p => ({
          ...p,
          logradouro: data.logradouro || p.logradouro,
          bairro:     data.bairro     || p.bairro,
          cidade:     data.localidade || p.cidade,
          estado:     data.uf         || p.estado,
        }));
      }
    } catch {
      // CEP não encontrado — usuário preenche manualmente
    } finally { setCepLoading(false); }
  }, []);

  function handleCepChange(v: string) {
    const masked = maskCEP(v);
    setA("cep", masked);
    lookupCEP(masked);
  }

  // ── Enviar ──
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validar todos os campos antes de enviar
    const eIE      = validateIE(ie);
    const eEmail   = validateEmail(email);
    const eWA      = validateWhatsApp(whatsapp);
    const ePass    = validatePassword(password);
    const eConfirm = validateConfirm(confirmPassword, password);

    setIeErr(eIE); setEmailErr(eEmail); setWhatsappErr(eWA);
    setPasswordErr(ePass); setConfirmErr(eConfirm);

    if (!resolved) { setFormErr("Pesquise o CNPJ antes de enviar."); return; }
    if (cnpjStatus === "manual" && !razaoSocial.trim()) { setFormErr("Razão Social é obrigatória."); return; }
    if (eIE || eEmail || eWA || ePass || eConfirm) { setFormErr("Corrija os campos destacados antes de continuar."); return; }
    if (!addr.logradouro || !addr.numero || !addr.cidade || !addr.estado) {
      setFormErr("Preencha o endereço completo (logradouro, número, cidade e UF)."); return;
    }

    setSubmitting(true); setFormErr("");
    try {
      const res = await fetch("/api/portal/registro", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          cnpj:               cnpj.replace(/\D/g, ""),
          razao_social:       rfData?.razao_social ?? razaoSocial.trim(),
          nome_fantasia:      nomeFantasia.trim()  || null,
          cnae_codigo:        rfData?.cnae_codigo    ?? null,
          cnae_descricao:     rfData?.cnae_descricao ?? null,
          inscricao_estadual: ie.trim(),
          cep:                addr.cep,
          logradouro:         addr.logradouro,
          numero:             addr.numero,
          complemento:        addr.complemento || null,
          bairro:             addr.bairro      || null,
          cidade:             addr.cidade,
          estado:             addr.estado,
          whatsapp,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao cadastrar");
      setSuccess(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao cadastrar";
      setFormErr(msg);
    } finally { setSubmitting(false); }
  }

  // ── Tela de sucesso ──
  if (success) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center space-y-5">
        <div className="w-16 h-16 rounded-full bg-green-500/15 border border-green-500/25 flex items-center justify-center mx-auto">
          <CheckCircle size={32} className="text-green-400" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white mb-2">Cadastro enviado!</h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            Seu cadastro está em análise. Você receberá um email em{" "}
            <span className="text-white font-semibold">{email}</span> assim que for aprovado.
          </p>
        </div>
        <Link href="/portal/login"
          className="inline-block px-6 py-2.5 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl text-sm transition-all"
        >
          Ir para o login
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-xl mx-auto">

        {/* Logo */}
        <div className="text-center mb-8">
          <Image src="/images/ph.png" alt="PH Representante" width={140} height={36} className="h-9 w-auto object-contain mx-auto mb-5" />
          <h1 className="text-2xl font-black text-white">Cadastro de Cliente</h1>
          <p className="text-gray-500 text-sm mt-1">Solicite seu acesso ao portal de representantes</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* ══ BLOCO 1 — CNPJ & EMPRESA ══ */}
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-5 space-y-4">

            {/* Campo CNPJ */}
            <div>
              <label className={lbl}>CNPJ <Star /></label>
              <div className="flex gap-2">
                <input
                  value={cnpj}
                  onChange={(e) => { setCnpj(maskCNPJ(e.target.value)); resetCnpj(); }}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), lookupCNPJ())}
                  placeholder="00.000.000/0000-00"
                  disabled={resolved}
                  className={`${inp} flex-1 disabled:opacity-60 disabled:cursor-not-allowed`}
                />
                {!resolved ? (
                  <button type="button" onClick={lookupCNPJ} disabled={cnpjStatus === "loading"}
                    className="px-4 py-2.5 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl text-xs transition-all disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap"
                  >
                    {cnpjStatus === "loading" ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                    Pesquisar
                  </button>
                ) : (
                  <button type="button" onClick={resetCnpj}
                    className="px-3 py-2.5 bg-dark-700 border border-white/10 text-gray-400 hover:text-white rounded-xl text-xs transition-all flex-shrink-0 whitespace-nowrap"
                  >
                    Alterar
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-600 mt-1.5">Dados consultados diretamente na Receita Federal</p>
            </div>

            {/* Erro CNPJ */}
            {cnpjStatus === "error" && (
              <div className="space-y-3">
                <div className="flex items-start gap-2 text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2.5">
                  <AlertCircle size={13} className="flex-shrink-0 mt-0.5" /> {cnpjErr}
                </div>
                <button type="button" onClick={() => setCnpjStatus("manual")}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-dark-700 border border-white/10 text-gray-300 hover:text-white hover:border-white/20 rounded-xl text-sm font-medium transition-all"
                >
                  <PencilLine size={14} /> Preencher dados manualmente
                </button>
              </div>
            )}

            {/* CNPJ encontrado */}
            {cnpjStatus === "found" && rfData && (
              <>
                <div className="flex items-center gap-2 text-green-400 text-xs bg-green-400/10 border border-green-400/20 rounded-xl px-3 py-2">
                  <CheckCircle size={13} className="flex-shrink-0" />
                  CNPJ encontrado na Receita Federal
                </div>
                {!rfData.is_automotive && (
                  <div className="flex items-start gap-2 text-yellow-400 text-xs bg-yellow-400/10 border border-yellow-400/20 rounded-xl px-3 py-2.5">
                    <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                    CNAE não é do ramo automotivo — o cadastro passará por análise adicional.
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500 mb-1">Razão Social</p>
                  <p className="text-sm text-white font-semibold">{rfData.razao_social}</p>
                </div>
                <div className="text-xs text-gray-500">{rfData.cnae_codigo} — {rfData.cnae_descricao}</div>
              </>
            )}

            {/* Manual */}
            {cnpjStatus === "manual" && (
              <>
                <div className="flex items-center gap-2 text-gray-400 text-xs bg-white/5 border border-white/8 rounded-xl px-3 py-2">
                  <PencilLine size={13} className="flex-shrink-0" /> Preenchendo dados manualmente
                </div>
                <div>
                  <label className={lbl}>Razão Social <Star /></label>
                  <input value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} placeholder="Nome jurídico da empresa" className={inp} />
                </div>
              </>
            )}

            {/* Nome Fantasia — editável em ambos os casos */}
            {resolved && (
              <div>
                <label className={lbl}>Nome Fantasia</label>
                <input
                  value={nomeFantasia}
                  onChange={(e) => setNomeFantasia(e.target.value)}
                  placeholder="Nome comercial (opcional)"
                  className={inp}
                />
              </div>
            )}

            {/* Inscrição Estadual */}
            {resolved && (
              <div>
                <label className={lbl}>Inscrição Estadual <Star /></label>
                <input
                  value={ie}
                  onChange={(e) => setIe(maskIE(e.target.value))}
                  onBlur={() => setIeErr(validateIE(ie))}
                  placeholder="000.000.000.000"
                  className={ieErr ? inpE : inp}
                />
                <FieldError msg={ieErr} />
              </div>
            )}
          </div>

          {/* ══ BLOCO 2 — ENDEREÇO ══ */}
          {resolved && (
            <div className="bg-dark-800 border border-white/8 rounded-2xl p-5 space-y-4">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Endereço <Star /></h2>

              {/* CEP com busca automática */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={lbl}>CEP</label>
                  <div className="relative">
                    <input
                      value={addr.cep}
                      onChange={(e) => handleCepChange(e.target.value)}
                      placeholder="00000-000"
                      className={`${inp} pr-8`}
                    />
                    {cepLoading
                      ? <Loader2 size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 animate-spin" />
                      : addr.cidade && <MapPin size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-green-400" />
                    }
                  </div>
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Logradouro <Star /></label>
                  <input value={addr.logradouro} onChange={(e) => setA("logradouro", e.target.value)} placeholder="Rua, Av., Rodovia..." required className={inp} />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className={lbl}>Número <Star /></label>
                  <input value={addr.numero} onChange={(e) => setA("numero", e.target.value)} placeholder="123" required className={inp} />
                </div>
                <div className="col-span-3">
                  <label className={lbl}>Complemento</label>
                  <input value={addr.complemento} onChange={(e) => setA("complemento", e.target.value)} placeholder="Sala, bloco, galpão..." className={inp} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={lbl}>Bairro</label>
                  <input value={addr.bairro} onChange={(e) => setA("bairro", e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Cidade <Star /></label>
                  <input value={addr.cidade} onChange={(e) => setA("cidade", e.target.value)} required className={inp} />
                </div>
                <div>
                  <label className={lbl}>UF <Star /></label>
                  <input value={addr.estado} onChange={(e) => setA("estado", e.target.value.toUpperCase().slice(0, 2))} placeholder="SP" required maxLength={2} className={inp} />
                </div>
              </div>
            </div>
          )}

          {/* ══ BLOCO 3 — CONTATO & ACESSO ══ */}
          {resolved && (
            <div className="bg-dark-800 border border-white/8 rounded-2xl p-5 space-y-4">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Contato & Acesso</h2>

              {/* Email */}
              <div>
                <label className={lbl}>
                  Email <Star />
                  <span className="text-gray-600 font-normal ml-1">(usado para login)</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (emailErr) setEmailErr(validateEmail(e.target.value)); }}
                  onBlur={() => setEmailErr(validateEmail(email))}
                  placeholder="contato@suaempresa.com.br"
                  className={emailErr ? inpE : inp}
                />
                <FieldError msg={emailErr} />
              </div>

              {/* WhatsApp */}
              <div>
                <label className={lbl}>WhatsApp <Star /></label>
                <input
                  value={whatsapp}
                  onChange={(e) => { const v = maskPhone(e.target.value); setWhatsapp(v); if (whatsappErr) setWhatsappErr(validateWhatsApp(v)); }}
                  onBlur={() => setWhatsappErr(validateWhatsApp(whatsapp))}
                  placeholder="(11) 99999-9999"
                  className={whatsappErr ? inpE : inp}
                />
                <FieldError msg={whatsappErr} />
              </div>

              {/* Senha */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Senha <Star /></label>
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (passwordErr) setPasswordErr(validatePassword(e.target.value));
                        if (confirmErr && confirmPassword) setConfirmErr(validateConfirm(confirmPassword, e.target.value));
                      }}
                      onBlur={() => setPasswordErr(validatePassword(password))}
                      placeholder="Mín. 6 caracteres"
                      className={`${passwordErr ? inpE : inp} pr-10`}
                    />
                    <button type="button" tabIndex={-1} onClick={() => setShowPass(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {/* Indicador de força */}
                  {password && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1">
                        {[1,2,3,4,5].map((i) => (
                          <div key={i} className={`h-1 flex-1 rounded-full transition-all ${score >= i ? strengthColors[score] : "bg-white/10"}`} />
                        ))}
                      </div>
                      <p className={`text-xs ${strengthColors[score].replace("bg-", "text-")}`}>
                        {strengthLabels[score]}
                      </p>
                    </div>
                  )}
                  <FieldError msg={passwordErr} />
                </div>

                <div>
                  <label className={lbl}>Confirmar senha <Star /></label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); if (confirmErr) setConfirmErr(validateConfirm(e.target.value, password)); }}
                    onBlur={() => setConfirmErr(validateConfirm(confirmPassword, password))}
                    placeholder="Repita a senha"
                    className={confirmErr ? inpE : inp}
                  />
                  <FieldError msg={confirmErr} />
                </div>
              </div>
            </div>
          )}

          {/* Erro geral */}
          {formErr && (
            <div className="flex items-start gap-2 text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" /> {formErr}
            </div>
          )}

          {/* Botão enviar */}
          {resolved && (
            <button type="submit" disabled={submitting}
              className="w-full py-3.5 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 size={15} className="animate-spin" />}
              {submitting ? "Enviando..." : "Enviar cadastro para análise"}
            </button>
          )}
        </form>

        <p className="text-center text-xs text-gray-600 mt-6">
          Já tem conta?{" "}
          <Link href="/portal/login" className="text-brand hover:underline">Fazer login</Link>
        </p>
      </div>
    </div>
  );
}
