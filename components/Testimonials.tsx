"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, ChevronLeft, ChevronRight, Quote } from "lucide-react";

const testimonials = [
  { name: "Ricardo Almeida", role: "Seller Mercado Livre",   city: "São Paulo, SP",       stars: 5, text: "Parceria incrível! Comecei no dropshipping sem nenhum estoque e em 3 meses já estava faturando mais de R$20 mil mensais. O suporte da PH é diferenciado — sempre respondem rápido e ajudam a resolver qualquer problema.", initials: "RA", color: "bg-blue-600" },
  { name: "Fernanda Costa",  role: "Distribuidora Automotiva",city: "Belo Horizonte, MG",  stars: 5, text: "Trabalho no atacado com a PH há mais de 2 anos. A qualidade dos produtos ATTIS e ECOFLEX é excelente, e as condições de pagamento são as melhores do mercado. Não troco por nada.", initials: "FC", color: "bg-purple-600" },
  { name: "Carlos Eduardo",  role: "Seller Shopee",          city: "Curitiba, PR",         stars: 5, text: "A consultoria de gestão de marketplace valeu cada centavo. Em 60 dias minha conta subiu de nível, meus anúncios estão na primeira posição e as vendas triplicaram. Recomendo 100%.", initials: "CE", color: "bg-green-700" },
  { name: "Ana Paula Lima",  role: "Loja de Autopeças",      city: "Salvador, BA",         stars: 5, text: "Encontrei na PH Representante o parceiro ideal para minha loja. Produtos de qualidade, entrega rápida e um atendimento que realmente entende o negócio automotivo.", initials: "AL", color: "bg-orange-600" },
  { name: "Marcos Vieira",   role: "E-commerce Automotivo",  city: "Porto Alegre, RS",     stars: 5, text: "Comecei do zero com o dropshipping automotivo e hoje tenho uma operação de R$80 mil mensais. A PH me deu todo o suporte que precisei — do catálogo ao suporte operacional.", initials: "MV", color: "bg-brand" },
  { name: "Juliana Santos",  role: "Seller Mercado Livre",   city: "Fortaleza, CE",        stars: 5, text: "O serviço de criação de anúncios profissionais foi um divisor de águas. Minha taxa de conversão subiu mais de 200%. Resultados reais!", initials: "JS", color: "bg-pink-600" },
];

function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => <Star key={i} size={13} className="text-yellow-400 fill-yellow-400" />)}
    </div>
  );
}

export default function Testimonials() {
  const [current, setCurrent] = useState(0);
  const prev = () => setCurrent((c) => (c - 1 + testimonials.length) % testimonials.length);
  const next = () => setCurrent((c) => (c + 1) % testimonials.length);
  const visible = [testimonials[current % testimonials.length], testimonials[(current + 1) % testimonials.length], testimonials[(current + 2) % testimonials.length]];

  return (
    <section className="relative py-24 bg-dark-950 overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-brand/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-center mb-14">
          <span className="inline-block px-4 py-1.5 text-sm font-semibold text-brand bg-brand/10 border border-brand/25 rounded-full mb-4">Depoimentos</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4 text-white">O que nossos <span className="text-gradient">clientes</span> dizem</h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">Mais de 500 sellers e distribuidores já confiam na PH Representante.</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-5">
          {visible.map((t, i) => (
            <AnimatePresence key={`${t.name}-${current}-${i}`} mode="wait">
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3, delay: i * 0.07 }}
                className={`bg-dark-900 rounded-2xl p-6 border flex flex-col transition-all duration-300 ${i === 1 ? "border-brand/30" : "border-white/7 hover:border-white/12"}`}
              >
                <Quote size={24} className="text-brand/30 mb-3 flex-shrink-0" />
                <p className="text-gray-400 text-sm leading-relaxed flex-1 mb-5">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-3 pt-4 border-t border-white/6">
                  <div className={`w-10 h-10 rounded-full ${t.color} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>{t.initials}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-sm truncate">{t.name}</p>
                    <p className="text-xs text-gray-500 truncate">{t.role}</p>
                  </div>
                  <div className="flex-shrink-0">
                    <Stars count={t.stars} />
                    <p className="text-xs text-gray-600 text-right mt-0.5">{t.city}</p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          ))}
        </div>

        <div className="flex items-center justify-center gap-4 mt-8">
          <button onClick={prev} className="w-10 h-10 rounded-full bg-dark-900 border border-white/8 flex items-center justify-center text-gray-500 hover:text-white hover:border-brand/30 transition-all" aria-label="Anterior"><ChevronLeft size={18} /></button>
          <div className="flex gap-2">
            {testimonials.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)} className={`rounded-full transition-all duration-300 ${i === current % testimonials.length ? "w-6 h-2 bg-brand" : "w-2 h-2 bg-white/15 hover:bg-white/30"}`} aria-label={`Depoimento ${i + 1}`} />
            ))}
          </div>
          <button onClick={next} className="w-10 h-10 rounded-full bg-dark-900 border border-white/8 flex items-center justify-center text-gray-500 hover:text-white hover:border-brand/30 transition-all" aria-label="Próximo"><ChevronRight size={18} /></button>
        </div>
      </div>
    </section>
  );
}
