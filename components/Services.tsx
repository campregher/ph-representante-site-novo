"use client";

import { motion } from "framer-motion";
import { LayoutDashboard, Megaphone, Search, BarChart3, MousePointerClick, TrendingUp, FileBarChart, MessageSquare, ArrowRight } from "lucide-react";
import { WHATSAPP_URL } from "@/lib/constants";

// Todos os cards usam o mesmo tratamento neutro — cor fica reservada pro único
// card que já é a nossa especialidade principal (Anúncios) e pro banner de CTA.
const NEUTRAL = { border: "border-gray-200", iconBg: "bg-gray-100", iconC: "text-gray-600", labelC: "text-gray-500" };
const HIGHLIGHT = { border: "border-brand/40", iconBg: "bg-brand/10", iconC: "text-brand", labelC: "text-brand" };

const services = [
  { icon: LayoutDashboard,  platform: "Mercado Livre", title: "Gestão de conta no Mercado Livre",     desc: "Gerenciamento completo: reputação, atendimento, métricas e saúde da conta.",        ...NEUTRAL },
  { icon: LayoutDashboard,  platform: "Shopee",        title: "Gestão de conta na Shopee",           desc: "Gestão profissional da loja Shopee: classificação, avaliações e operação completa.", ...NEUTRAL },
  { icon: Megaphone,        platform: "Anúncios",      title: "Criação de Anúncios Profissionais", desc: "Fotos, títulos otimizados e descrições claras para melhorar a conversão.",        ...HIGHLIGHT },
  { icon: Search,           platform: "SEO",           title: "SEO para Marketplace",             desc: "Otimização de títulos, descrições e palavras-chave para melhorar a visibilidade dos anúncios nas buscas.",    ...NEUTRAL },
  { icon: MousePointerClick,platform: "Ads",           title: "Gestão de anúncios pagos",         desc: "Campanhas no Mercado Livre e na Shopee com foco no retorno sobre o investimento em publicidade.",                   ...NEUTRAL },
  { icon: TrendingUp,       platform: "Estratégia",    title: "Estratégia de Vendas",             desc: "Planejamento de precificação, mix de produtos e posicionamento competitivo.",        ...NEUTRAL },
  { icon: FileBarChart,     platform: "Análise",       title: "Análise de Métricas",              desc: "Relatórios de desempenho, faturamento, ticket médio e diagnóstico de gargalos.",    ...NEUTRAL },
  { icon: BarChart3,        platform: "Conversão",     title: "Otimização de Conversão",          desc: "Testes A/B, melhoria de fotos, perguntas e respostas e taxa de conversão.",         ...NEUTRAL },
  { icon: MessageSquare,    platform: "Consultoria",   title: "Consultoria para Sellers",         desc: "Mentoria 1:1 para sellers que querem crescer e profissionalizar a operação.",        ...NEUTRAL },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

export default function Services() {
  return (
    <section id="servicos" className="relative py-24 bg-white">
      <div className="absolute inset-0 bg-grid pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-center mb-16">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="w-6 h-[3px] bg-brand flex-shrink-0" />
            <span className="text-xs font-bold text-brand uppercase tracking-widest">Serviços Digitais</span>
            <span className="w-6 h-[3px] bg-brand flex-shrink-0" />
          </div>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-medium mb-4 text-gray-900">Gestão de <span className="text-brand">Marketplaces</span></h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">Além da representação comercial, oferecemos serviços completos para sellers escalarem suas vendas.</p>
        </motion.div>

        <motion.div variants={container} initial="hidden" whileInView="show" viewport={{ once: true }} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((svc) => (
            <motion.div key={svc.title} variants={item} whileHover={{ y: -4 }}
              className={`bg-white rounded-md p-6 border ${svc.border} hover:shadow-lg transition-all duration-300`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-11 h-11 rounded-md ${svc.iconBg} border ${svc.border} flex items-center justify-center flex-shrink-0`}>
                  <svc.icon size={20} className={svc.iconC} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className={`text-xs font-bold uppercase tracking-widest ${svc.labelC} mb-1 block`}>{svc.platform}</span>
                  <h3 className="font-bold text-gray-900 mb-2 text-sm leading-snug">{svc.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{svc.desc}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA banner */}
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-12 relative overflow-hidden rounded-md p-8 sm:p-10 bg-brand"
        >
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <h3 className="text-2xl font-black text-white mb-2">Quer escalar suas vendas?</h3>
              <p className="text-red-100 max-w-lg">Conte com nossa equipe para organizar sua operação e desenvolver suas vendas nos marketplaces.</p>
            </div>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-3 bg-white text-brand hover:bg-red-50 font-bold rounded-md transition-all text-sm whitespace-nowrap flex-shrink-0 shadow-lg"
            >Falar com especialista <ArrowRight size={15} /></a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
