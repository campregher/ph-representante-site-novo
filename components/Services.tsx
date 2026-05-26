"use client";

import { motion } from "framer-motion";
import { LayoutDashboard, Megaphone, Search, BarChart3, MousePointerClick, TrendingUp, FileBarChart, MessageSquare, ArrowRight } from "lucide-react";
import { WHATSAPP_URL } from "@/lib/constants";

const services = [
  { icon: LayoutDashboard,  platform: "Mercado Livre", title: "Gestão de Conta MercadoLivre",     desc: "Gerenciamento completo: reputação, atendimento, métricas e saúde da conta.",        border: "border-yellow-500/20",  iconBg: "bg-yellow-500/10",  iconC: "text-yellow-400",  labelC: "text-yellow-500" },
  { icon: LayoutDashboard,  platform: "Shopee",        title: "Gestão de Conta Shopee",           desc: "Gestão profissional da loja Shopee: classificação, avaliações e operação completa.", border: "border-orange-500/20",  iconBg: "bg-orange-500/10",  iconC: "text-orange-400",  labelC: "text-orange-500" },
  { icon: Megaphone,        platform: "Anúncios",      title: "Criação de Anúncios Profissionais", desc: "Fotos, títulos otimizados, descrições persuasivas para maximizar conversão.",        border: "border-brand/20",       iconBg: "bg-brand/10",       iconC: "text-brand",       labelC: "text-brand" },
  { icon: Search,           platform: "SEO",           title: "SEO para Marketplace",             desc: "Otimização de anúncios para aparecer nas primeiras posições de busca orgânica.",    border: "border-green-500/20",   iconBg: "bg-green-500/10",   iconC: "text-green-400",   labelC: "text-green-500" },
  { icon: MousePointerClick,platform: "Ads",           title: "Gestão de Anúncios Pagos",         desc: "Campanhas ML Ads e Shopee Ads com estratégia de ROAS otimizado.",                   border: "border-blue-500/20",    iconBg: "bg-blue-500/10",    iconC: "text-blue-400",    labelC: "text-blue-500" },
  { icon: TrendingUp,       platform: "Estratégia",    title: "Estratégia de Vendas",             desc: "Planejamento de precificação, mix de produtos e posicionamento competitivo.",        border: "border-purple-500/20",  iconBg: "bg-purple-500/10",  iconC: "text-purple-400",  labelC: "text-purple-500" },
  { icon: FileBarChart,     platform: "Análise",       title: "Análise de Métricas",              desc: "Relatórios de desempenho, faturamento, ticket médio e diagnóstico de gargalos.",    border: "border-cyan-500/20",    iconBg: "bg-cyan-500/10",    iconC: "text-cyan-400",    labelC: "text-cyan-500" },
  { icon: BarChart3,        platform: "Conversão",     title: "Otimização de Conversão",          desc: "Testes A/B, melhoria de fotos, perguntas e respostas e taxa de conversão.",         border: "border-orange-500/20",  iconBg: "bg-orange-500/10",  iconC: "text-orange-400",  labelC: "text-orange-500" },
  { icon: MessageSquare,    platform: "Consultoria",   title: "Consultoria para Sellers",         desc: "Mentoria 1:1 para sellers que querem crescer e profissionalizar a operação.",        border: "border-pink-500/20",    iconBg: "bg-pink-500/10",    iconC: "text-pink-400",    labelC: "text-pink-500" },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

export default function Services() {
  return (
    <section id="servicos" className="relative py-24 bg-dark-950">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
      <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 text-sm font-semibold text-brand bg-brand/10 border border-brand/25 rounded-full mb-4">Serviços Digitais</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4 text-white">Gestão de <span className="text-gradient">Marketplaces</span></h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">Além da representação comercial, oferecemos serviços completos para sellers escalarem suas vendas.</p>
        </motion.div>

        <motion.div variants={container} initial="hidden" whileInView="show" viewport={{ once: true }} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((svc) => (
            <motion.div key={svc.title} variants={item} whileHover={{ scale: 1.02, y: -4 }}
              className={`bg-dark-900 rounded-2xl p-6 border ${svc.border} hover:border-opacity-60 transition-all duration-300`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-11 h-11 rounded-xl ${svc.iconBg} border ${svc.border} flex items-center justify-center flex-shrink-0`}>
                  <svc.icon size={20} className={svc.iconC} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className={`text-xs font-bold uppercase tracking-widest ${svc.labelC} mb-1 block`}>{svc.platform}</span>
                  <h3 className="font-bold text-white mb-2 text-sm leading-snug">{svc.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{svc.desc}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA banner */}
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-12 relative overflow-hidden rounded-3xl p-8 sm:p-10 bg-brand border border-brand"
        >
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/8 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-black/15 rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <h3 className="text-2xl font-black text-white mb-2">Quer escalar suas vendas?</h3>
              <p className="text-red-100 max-w-lg">Nossa equipe de especialistas pode transformar sua operação e multiplicar seu faturamento nos marketplaces.</p>
            </div>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-3 bg-white text-brand hover:bg-red-50 font-bold rounded-full transition-all text-sm whitespace-nowrap flex-shrink-0 shadow-lg"
            >Falar com especialista <ArrowRight size={15} /></a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
