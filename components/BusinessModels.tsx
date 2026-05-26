"use client";

import { motion } from "framer-motion";
import { Warehouse, Zap, TrendingUp, ArrowRight, CheckCircle2, Store, Package, Send, ShoppingCart, DollarSign } from "lucide-react";
import { WHATSAPP_URL } from "@/lib/constants";

const atacadoBenefits = ["Melhor margem de lucro","Prazo de pagamento diferenciado","Ideal para distribuidores e lojas","Estoque próprio com variedade","Preço especial por volume","Suporte comercial exclusivo","Entrega expressa para todo Brasil","Mix de produtos por região"];
const dropBenefits    = ["Zero estoque necessário","Baixo investimento inicial","Ideal para iniciantes e sellers","Pagamento semanal ou diário","Integração com Mercado Livre e Shopee","Envio direto ao cliente final","Suporte para criação de anúncios","Crescimento sem limite de capital"];

const dropSteps = [
  { icon: Store,        number: "01", title: "Você anuncia",  desc: "Seller publica o produto no marketplace com sua margem.",       accent: "border-brand/30",  iconBg: "bg-brand/10",      iconC: "text-brand" },
  { icon: ShoppingCart, number: "02", title: "Cliente compra", desc: "Consumidor realiza a compra no seu anúncio.",                  accent: "border-orange-500/30", iconBg: "bg-orange-500/10", iconC: "text-orange-400" },
  { icon: Send,         number: "03", title: "Você repassa",  desc: "Seller envia o pedido para a PH com os dados do comprador.",    accent: "border-yellow-500/30", iconBg: "bg-yellow-500/10", iconC: "text-yellow-400" },
  { icon: Package,      number: "04", title: "Nós enviamos",  desc: "PH Representante envia o produto direto ao cliente final.",     accent: "border-green-500/30",  iconBg: "bg-green-500/10",  iconC: "text-green-400" },
  { icon: DollarSign,   number: "05", title: "Você lucra",    desc: "Você recebe a diferença do valor de venda sem ter investido.",  accent: "border-blue-500/30",   iconBg: "bg-blue-500/10",   iconC: "text-blue-400" },
];

const cardV = { hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

export default function BusinessModels() {
  return (
    <section id="modelos" className="relative py-24 bg-dark-950">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 text-sm font-semibold text-brand bg-brand/10 border border-brand/25 rounded-full mb-4">Modelos de Negócio</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4 text-white">Como trabalhar <span className="text-gradient">conosco</span></h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">Escolha o modelo ideal. Atendemos desde grandes distribuidores até quem está começando do zero.</p>
        </motion.div>

        {/* Two models */}
        <div id="atacado" className="grid md:grid-cols-2 gap-6 mb-20">
          {/* ATACADO */}
          <motion.div variants={cardV} initial="hidden" whileInView="show" viewport={{ once: true }}
            className="bg-dark-900 rounded-3xl p-8 border border-white/7 hover:border-blue-500/25 transition-all duration-300"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Warehouse size={22} className="text-blue-400" />
              </div>
              <div>
                <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">Modelo 1</span>
                <h3 className="text-2xl font-black text-white">Atacado</h3>
              </div>
            </div>
            <p className="text-gray-400 mb-6 leading-relaxed">Compre em volume com condições especiais. Ideal para distribuidores, lojistas e centros automotivos que buscam estoque próprio.</p>
            <ul className="space-y-2.5 mb-8">
              {atacadoBenefits.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm text-gray-400">
                  <CheckCircle2 size={15} className="text-blue-400 mt-0.5 flex-shrink-0" />{b}
                </li>
              ))}
            </ul>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-300 font-semibold rounded-full transition-all text-sm group"
            >Quero comprar no atacado <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" /></a>
          </motion.div>

          {/* DROPSHIPPING */}
          <motion.div id="dropshipping" variants={cardV} initial="hidden" whileInView="show" viewport={{ once: true }} transition={{ delay: 0.1 }}
            className="bg-dark-900 rounded-3xl p-8 border border-brand/30 hover:border-brand/50 transition-all duration-300 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-48 h-48 bg-brand/6 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute top-4 right-4 bg-brand text-white text-xs font-bold px-3 py-1 rounded-full">Popular</div>
            <div className="relative">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-brand/10 border border-brand/25 flex items-center justify-center">
                  <Zap size={22} className="text-brand" />
                </div>
                <div>
                  <span className="text-xs font-bold text-brand uppercase tracking-widest">Modelo 2</span>
                  <h3 className="text-2xl font-black text-white">Dropshipping</h3>
                </div>
              </div>
              <p className="text-gray-400 mb-6 leading-relaxed">Venda sem estoque. Anuncie nos marketplaces, receba os pedidos e nós cuidamos do envio. Baixo investimento inicial.</p>
              <ul className="space-y-2.5 mb-8">
                {dropBenefits.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm text-gray-400">
                    <CheckCircle2 size={15} className="text-brand mt-0.5 flex-shrink-0" />{b}
                  </li>
                ))}
              </ul>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-brand hover:bg-brand-hover text-white font-semibold rounded-full transition-all text-sm glow-red-sm group"
              >Quero fazer dropshipping <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" /></a>
            </div>
          </motion.div>
        </div>

        {/* Steps */}
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
          <div className="text-center mb-10">
            <h3 className="text-2xl sm:text-3xl font-black mb-2 text-white">Como funciona o <span className="text-gradient">Dropshipping</span> na prática?</h3>
            <p className="text-gray-500 text-sm">5 passos simples para começar a vender hoje</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {dropSteps.map((step, i) => (
              <motion.div key={step.number} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.4 }}
                whileHover={{ scale: 1.04, y: -4 }}
                className={`relative bg-dark-900 rounded-2xl p-5 border ${step.accent} transition-all duration-300`}
              >
                {i < dropSteps.length - 1 && (
                  <div className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-dark-800 border border-white/8 items-center justify-center">
                    <ArrowRight size={11} className="text-gray-600" />
                  </div>
                )}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-3xl font-black text-white/8">{step.number}</span>
                  <div className={`w-10 h-10 rounded-xl ${step.iconBg} flex items-center justify-center`}>
                    <step.icon size={18} className={step.iconC} />
                  </div>
                </div>
                <h4 className="font-bold text-white mb-1.5 text-sm">{step.title}</h4>
                <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>

          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10 p-6 bg-dark-900 border border-white/7 rounded-2xl"
          >
            <div className="flex items-center gap-3">
              <TrendingUp size={24} className="text-brand" />
              <div>
                <p className="font-bold text-white">Pronto para começar?</p>
                <p className="text-sm text-gray-500">Fale com um especialista agora</p>
              </div>
            </div>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-7 py-3 bg-brand hover:bg-brand-hover text-white font-bold rounded-full transition-all glow-red-sm text-sm whitespace-nowrap"
            >Começar agora <ArrowRight size={15} /></a>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
