"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus, MessageCircle } from "lucide-react";
import { WHATSAPP_URL } from "@/lib/constants";

import { faqs } from "@/lib/faqs";

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="relative py-24 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="w-6 h-[3px] bg-brand flex-shrink-0" />
            <span className="text-xs font-bold text-brand uppercase tracking-widest">Dúvidas Frequentes</span>
            <span className="w-6 h-[3px] bg-brand flex-shrink-0" />
          </div>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-medium mb-4 text-gray-900">Perguntas <span className="text-brand">frequentes</span></h2>
          <p className="text-gray-600 text-lg">Não encontrou sua dúvida? Fale diretamente com nosso time.</p>
        </motion.div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05, duration: 0.4 }}
              className={`rounded-md border transition-all duration-200 overflow-hidden ${open === i ? "bg-white border-brand" : "bg-white border-gray-200 hover:border-gray-300"}`}
            >
              <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left">
                <span className="font-semibold text-sm sm:text-base text-gray-900">{faq.q}</span>
                <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${open === i ? "bg-brand text-white" : "bg-gray-100 text-gray-500"}`}>
                  {open === i ? <Minus size={13} /> : <Plus size={13} />}
                </span>
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: "easeInOut" }} className="overflow-hidden">
                    <div className="px-5 pb-5">
                      <p className="text-gray-600 text-sm leading-relaxed">{faq.a}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.3 }}
          className="text-center mt-12 p-6 bg-gray-50 border border-gray-200 rounded-md"
        >
          <p className="text-gray-600 mb-4 text-sm">Ainda tem dúvidas? Nossa equipe responde em minutos no WhatsApp.</p>
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-7 py-3 bg-brand hover:bg-brand-hover text-white font-bold rounded-md transition-all text-sm"
          ><MessageCircle size={18} /> Tirar dúvidas pelo WhatsApp</a>
        </motion.div>
      </div>
    </section>
  );
}
