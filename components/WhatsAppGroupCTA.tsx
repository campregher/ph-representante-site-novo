"use client";

import { motion } from "framer-motion";
import { Users, ArrowRight, ShieldCheck } from "lucide-react";
import { WHATSAPP_GROUP_URL } from "@/lib/constants";

export default function WhatsAppGroupCTA() {
  return (
    <section className="relative py-20 bg-dark-950 overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
      <div className="absolute inset-0 bg-grid opacity-40 pointer-events-none" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-brand/8 blur-3xl pointer-events-none" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="bg-dark-900 border border-brand/20 rounded-3xl px-6 py-12 sm:px-12 text-center glow-red"
        >
          <div className="w-16 h-16 mx-auto rounded-2xl bg-brand/10 border border-brand/25 flex items-center justify-center mb-6">
            <Users size={28} className="text-brand" />
          </div>

          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
            Entre no <span className="text-gradient">grupo VIP</span> do WhatsApp
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto mb-8">
            Receba lançamentos, condições exclusivas e promoções direto no seu WhatsApp, em primeira mão.
          </p>

          <a
            href={WHATSAPP_GROUP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-brand hover:bg-brand-hover text-white font-bold rounded-full transition-all duration-200 glow-red hover:scale-105 text-base"
          >
            <Users size={20} /> Entrar no grupo
            <ArrowRight size={18} />
          </a>

          <p className="mt-5 flex items-center justify-center gap-1.5 text-sm text-gray-500">
            <ShieldCheck size={15} className="text-brand" />
            Só a PH envia mensagens — sem spam, sem bate-papo de grupo.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
