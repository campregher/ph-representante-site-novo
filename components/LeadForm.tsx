"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User, Building2, Hash, Phone, Mail, MapPin, Store, ShoppingBag, CheckCircle2, X, Send, Loader2 } from "lucide-react";
import { formatCNPJ, formatPhone, validateCNPJ } from "@/utils/cnpj";
import { WHATSAPP_NUMBER } from "@/lib/constants";

const schema = z.object({
  name: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
  company: z.string().optional(),
  cnpj: z.string().min(18, "CNPJ invalido").refine((v) => validateCNPJ(v), "CNPJ invalido - verifique os digitos"),
  phone: z.string().min(14, "WhatsApp invalido"),
  email: z.string().email("E-mail invalido"),
  city: z.string().min(2, "Informe a cidade"),
  businessType: z.enum(["distribuidor", "loja", "seller-ml", "seller-shopee", "dropshipping"], { message: "Selecione o tipo de negocio" }),
  interest: z.enum(["atacado", "dropshipping", "gestao", "tudo"], { message: "Selecione o seu interesse" }),
  message: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const businessTypeOptions = [
  { value: "distribuidor", label: "Distribuidor" },
  { value: "loja", label: "Loja / Autopecas" },
  { value: "seller-ml", label: "Seller Mercado Livre" },
  { value: "seller-shopee", label: "Seller Shopee" },
  { value: "dropshipping", label: "Dropshipping" },
];

const interestOptions = [
  { value: "atacado", label: "Atacado" },
  { value: "dropshipping", label: "Dropshipping" },
  { value: "gestao", label: "Gestao de Marketplace" },
  { value: "tudo", label: "Todos os servicos" },
];

function InputField({
  label,
  error,
  icon: Icon,
  required,
  children,
}: {
  label: string;
  error?: string;
  icon: React.ElementType;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-300 mb-1.5">
        {label}{required && <span className="text-brand ml-0.5">*</span>}
      </label>
      <div className="relative">
        <Icon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
        {children}
      </div>
      {error && <p className="mt-1 text-xs text-brand flex items-center gap-1"><X size={10} />{error}</p>}
    </div>
  );
}

const inputCls = "w-full pl-9 pr-4 py-3 bg-dark-900 border border-white/8 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-brand/50 focus:ring-2 focus:ring-brand/10 transition-all duration-200";
const selectCls = "w-full pl-9 pr-4 py-3 bg-dark-900 border border-white/8 rounded-xl text-white text-sm focus:outline-none focus:border-brand/50 focus:ring-2 focus:ring-brand/10 transition-all duration-200 appearance-none cursor-pointer";

export default function LeadForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [submittedData, setSubmittedData] = useState<FormData | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { register, handleSubmit, setValue, watch, formState: { errors }, reset } = useForm<FormData>({ resolver: zodResolver(schema) });
  const cnpjValue = watch("cnpj") ?? "";
  const phoneValue = watch("phone") ?? "";

  const buildWhatsAppMessage = (data: FormData) => {
    const lines = [
      "*Novo Lead - PH Representante*",
      `*Nome:* ${data.name}`,
      data.company ? `*Empresa:* ${data.company}` : null,
      `*CNPJ:* ${data.cnpj}`,
      `*WhatsApp:* ${data.phone}`,
      `*E-mail:* ${data.email}`,
      `*Cidade:* ${data.city}`,
      `*Tipo:* ${businessTypeOptions.find((o) => o.value === data.businessType)?.label}`,
      `*Interesse:* ${interestOptions.find((o) => o.value === data.interest)?.label}`,
      data.message ? `*Mensagem:* ${data.message}` : null,
    ].filter(Boolean).join("\n");
    return encodeURIComponent(lines);
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Nao foi possivel enviar o formulario.");
      }

      setSubmittedData(data);
      setShowSuccess(true);
      reset();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Nao foi possivel enviar o formulario.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="contato" className="relative py-24 bg-dark-900 overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand/35 to-transparent" />
      <div className="absolute inset-0 bg-grid opacity-40 pointer-events-none" />
      <div className="absolute top-1/3 -right-32 w-96 h-96 rounded-full bg-brand/6 blur-3xl pointer-events-none" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-center mb-12">
          <span className="inline-block px-4 py-1.5 text-sm font-semibold text-brand bg-brand/10 border border-brand/25 rounded-full mb-4">Fale Conosco</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4 text-white">Solicite seu <span className="text-gradient">acesso</span></h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">Preencha o formulario para recebermos seus dados e retornarmos o contato.</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.1 }}
          className="bg-dark-800 rounded-3xl p-6 sm:p-8 border border-white/7"
        >
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="grid sm:grid-cols-2 gap-5">
              <InputField label="Nome completo" error={errors.name?.message} icon={User} required>
                <input {...register("name")} placeholder="Joao da Silva" className={inputCls} />
              </InputField>
              <InputField label="Empresa" error={errors.company?.message} icon={Building2}>
                <input {...register("company")} placeholder="Nome da empresa (opcional)" className={inputCls} />
              </InputField>
              <InputField label="CNPJ" error={errors.cnpj?.message} icon={Hash} required>
                <input value={cnpjValue} onChange={(e) => setValue("cnpj", formatCNPJ(e.target.value), { shouldValidate: cnpjValue.length >= 17 })} placeholder="00.000.000/0000-00" className={inputCls} maxLength={18} inputMode="numeric" />
              </InputField>
              <InputField label="WhatsApp" error={errors.phone?.message} icon={Phone} required>
                <input value={phoneValue} onChange={(e) => setValue("phone", formatPhone(e.target.value), { shouldValidate: phoneValue.length >= 13 })} placeholder="(11) 99999-9999" className={inputCls} maxLength={15} inputMode="tel" />
              </InputField>
              <InputField label="E-mail" error={errors.email?.message} icon={Mail} required>
                <input {...register("email")} type="email" placeholder="seuemail@empresa.com.br" className={inputCls} />
              </InputField>
              <InputField label="Cidade / Estado" error={errors.city?.message} icon={MapPin} required>
                <input {...register("city")} placeholder="Ex: Sao Paulo, SP" className={inputCls} />
              </InputField>
              <InputField label="Tipo de negocio" error={errors.businessType?.message} icon={Store} required>
                <select {...register("businessType")} className={selectCls}>
                  <option value="">Selecione...</option>
                  {businessTypeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </InputField>
              <InputField label="Interesse principal" error={errors.interest?.message} icon={ShoppingBag} required>
                <select {...register("interest")} className={selectCls}>
                  <option value="">Selecione...</option>
                  {interestOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </InputField>
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">
                  Mensagem <span className="text-gray-600 text-xs font-normal">(opcional)</span>
                </label>
                <textarea {...register("message")} placeholder="Conte um pouco sobre seu negocio ou duvidas..." rows={3}
                  className="w-full px-4 py-3 bg-dark-900 border border-white/8 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-brand/50 focus:ring-2 focus:ring-brand/10 transition-all resize-none"
                />
              </div>
            </div>
            <p className="text-xs text-gray-700 mt-5 mb-3">Seus dados serao salvos com seguranca e enviados para nossa equipe comercial.</p>
            {submitError && (
              <p className="text-sm text-brand mb-4 bg-brand/10 border border-brand/20 rounded-xl px-4 py-3">
                {submitError}
              </p>
            )}
            <button type="submit" disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-4 bg-brand hover:bg-brand-hover disabled:opacity-50 text-white font-bold rounded-full transition-all glow-red hover:scale-[1.01] disabled:cursor-not-allowed text-base"
            >
              {isSubmitting ? (<><Loader2 size={18} className="animate-spin" />Enviando...</>) : (<><Send size={18} />Enviar formulario</>)}
            </button>
          </form>
        </motion.div>
      </div>

      <AnimatePresence>
        {showSuccess && submittedData && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowSuccess(false)}
          >
            <motion.div initial={{ scale: 0.8, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="bg-dark-800 border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={() => setShowSuccess(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"><X size={20} /></button>
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center mb-4">
                  <CheckCircle2 size={32} className="text-green-400" />
                </div>
                <h3 className="text-2xl font-black text-white mb-2">Contato enviado!</h3>
                <p className="text-gray-400 mb-6 text-sm leading-relaxed">Recebemos seus dados e nossa equipe foi notificada por e-mail. Se preferir, fale agora pelo WhatsApp.</p>
                <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${buildWhatsAppMessage(submittedData)}`} target="_blank" rel="noopener noreferrer"
                  onClick={() => setShowSuccess(false)}
                  className="w-full flex items-center justify-center gap-2 py-4 bg-[#25d366] hover:bg-[#22c45b] text-white font-bold rounded-full transition-all"
                ><Phone size={18} />Falar agora no WhatsApp</a>
                <button onClick={() => setShowSuccess(false)} className="mt-3 text-sm text-gray-600 hover:text-gray-400 transition-colors">Fechar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
