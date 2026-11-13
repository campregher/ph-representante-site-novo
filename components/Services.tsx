"use client";

import { motion } from "framer-motion";
import { LayoutDashboard, Megaphone, Search, BarChart3, MousePointerClick, TrendingUp, FileBarChart, MessageSquare, ArrowRight } from "lucide-react";
import { WHATSAPP_URL } from "@/lib/constants";

const services = [
  { icon: LayoutDashboard,  platform: "Mercado Livre", title: "Gestão de Conta MercadoLivre",     desc: "Gerenciamento completo: reputação, atendimento, métricas e saúde da conta.",        border: "border-yellow-300",  iconBg: "bg-yellow-50",  iconC: "text-yellow-600",  labelC: "text-yellow-600" },
  { icon: LayoutDashboard,  platform: "Shopee",        title: "Gestão de Conta Shopee",           desc: "Gestão profissional da loja Shopee: classificação, avaliações e operação completa.", border: "border-orange-300",  iconBg: "bg-orange-50",  iconC: "text-orange-600",  labelC: "text-orange-600" },
  { icon: Megaphone,        platform: "Anúncios",      title: "Criação de Anúncios Profissionais", desc: "Fotos, títulos otimizados, descrições persuasivas para maximizar conversão.",        border: "border-brand/40",    iconBg: "bg-brand/10",   iconC: "text-brand",       labelC: "text-brand" },
  { icon: Search,           platform: "SEO",           title: "SEO para Marketplace",             desc: "Otimização de anúncios para aparecer nas primeiras posições de busca orgânica.",    border: "border-green-300",   iconBg: "bg-green-50",   iconC: "text-green-600",   labelC: "text-green-600" },
  { icon: MousePointerClick,platform: "Ads",           title: "Gestão de Anúncios Pagos",         desc: "Campanhas ML Ads e Shopee Ads com estratégia de ROAS otimizado.",                   border: "border-blue-300",    iconBg: "bg-blue-50",    iconC: "text-blue-600",    labelC: "text-blue-600" },
  { icon: TrendingUp,       platform: "Estratégia",    title: "Estratégia de Vendas",             desc: "Planejamento de precificação, mix de produtos e posicionamento competitivo.",        border: "border-purple-300",  iconBg: "bg-purple-50",  iconC: "text-purple-600",  labelC: "text-purple-600" },
  { icon: FileBarChart,     platform: "Análise",       title: "Análise de Métricas",              desc: "Relatórios de desempenho, faturamento, ticket médio e diagnóstico de gargalos.",    border: "border-cyan-300",    iconBg: "bg-cyan-50",    iconC: "text-cyan-600",    labelC: "text-cyan-600" },
  { icon: BarChart3,        platform: "Conversão",     title: "Otimização de Conversão",          desc: "Testes A/B, melhoria de fotos, perguntas e respostas e taxa de conversão.",         border: "border-orange-300",  iconBg: "bg-orange-50",  iconC: "text-orange-600",  labelC: "text-orange-600" },
  { icon: MessageSquare,    platform: "Consultoria",   title: "Consultoria para Sellers",         desc: "Mentoria 1:1 para sellers que querem crescer e profissionalizar a operação.",        border: "border-pink-300",    iconBg: "bg-pink-50",    iconC: "text-pink-600",    labelC: "text-pink-600" },
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
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4 text-gray-900">Gestão de <span className="text-brand">Marketplaces</span></h2>
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
              <p className="text-red-100 max-w-lg">Nossa equipe de especialistas pode transformar sua operação e multiplicar seu faturamento nos marketplaces.</p>
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
