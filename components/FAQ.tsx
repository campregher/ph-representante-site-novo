"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus, MessageCircle } from "lucide-react";
import { WHATSAPP_URL } from "@/lib/constants";

const faqs = [
  { q: "Como funciona o dropshipping automotivo?",           a: "Você anuncia os produtos da PH no Mercado Livre ou Shopee com sua margem. Quando o cliente compra, você repassa o pedido para nós e nós enviamos diretamente ao consumidor. Você lucra sem precisar ter estoque ou capital empatado." },
  { q: "Preciso ter estoque para trabalhar com vocês?",      a: "Não! No dropshipping você vende sem estoque. No atacado, você compra por volume e mantém seu próprio estoque. Nossa equipe ajuda a escolher o modelo ideal para o seu perfil." },
  { q: "Qual o prazo de pagamento no atacado?",              a: "Trabalhamos com diversas condições: à vista com desconto, parcelamento em boleto (7, 14, 21 dias) e condições especiais para clientes frequentes. Entre em contato para receber a tabela de preços." },
  { q: "Vocês atendem todo o Brasil?",                      a: "Sim! Atendemos distribuidores, lojistas e sellers de todo o Brasil. Nossos fabricantes parceiros possuem logística nacional com prazos competitivos." },
  { q: "Como funciona o atacado? Existe pedido mínimo?",     a: "Sim, existe uma quantidade mínima por pedido que varia conforme a marca e o produto. Os preços são escalonados — quanto mais você compra, melhor o preço. Entre em contato para receber as tabelas com os mínimos por SKU." },
  { q: "Vocês fazem gestão de conta no Mercado Livre e Shopee?", a: "Sim! Oferecemos serviços completos: criação de anúncios, SEO, gestão de Ads, análise de métricas, otimização de conversão e consultoria estratégica. Temos cases de sellers que triplicaram o faturamento." },
  { q: "Como faço para começar no dropshipping?",           a: "Entre em contato pelo WhatsApp ou formulário, nossa equipe apresenta o catálogo com os produtos disponíveis para drop, você começa a anunciar, e a cada pedido nos envia os dados para envio. Sem taxa de adesão ou mensalidade." },
  { q: "Quais produtos posso vender pelo dropshipping?",    a: "Tapetes bandeja (ATTIS), calhas de chuva (ECOFLEX), frisos e calotas (TIGER), apoio de braço e soleiras (SOFISTICAR), tapetes de carpete (TEVIC), racks e longarinas (VHIP). O catálogo cresce constantemente." },
];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="relative py-24 bg-dark-900">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand/25 to-transparent" />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-center mb-12">
          <span className="inline-block px-4 py-1.5 text-sm font-semibold text-brand bg-brand/10 border border-brand/25 rounded-full mb-4">Dúvidas Frequentes</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4 text-white">Perguntas <span className="text-gradient">frequentes</span></h2>
          <p className="text-gray-400 text-lg">Não encontrou sua dúvida? Fale diretamente com nosso time.</p>
        </motion.div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05, duration: 0.4 }}
              className={`rounded-2xl border transition-all duration-200 overflow-hidden ${open === i ? "bg-dark-800 border-brand/30" : "bg-dark-800 border-white/7 hover:border-white/12"}`}
            >
              <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left">
                <span className="font-semibold text-sm sm:text-base text-white">{faq.q}</span>
                <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${open === i ? "bg-brand text-white" : "bg-dark-500 text-gray-400"}`}>
                  {open === i ? <Minus size={13} /> : <Plus size={13} />}
                </span>
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: "easeInOut" }} className="overflow-hidden">
                    <div className="px-5 pb-5">
                      <p className="text-gray-400 text-sm leading-relaxed">{faq.a}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.3 }}
          className="text-center mt-12 p-6 bg-dark-800 border border-white/7 rounded-2xl"
        >
          <p className="text-gray-500 mb-4 text-sm">Ainda tem dúvidas? Nossa equipe responde em minutos no WhatsApp.</p>
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-7 py-3 bg-brand hover:bg-brand-hover text-white font-bold rounded-full transition-all glow-red-sm text-sm"
          ><MessageCircle size={18} /> Tirar dúvidas pelo WhatsApp</a>
        </motion.div>
      </div>
    </section>
  );
}
