"use client";

import { motion } from "framer-motion";
import { MessageCircle, FileText, ArrowRight, TrendingUp, Users, Package, MapPin, ShoppingCart, Star, Zap } from "lucide-react";
import { WHATSAPP_URL } from "@/lib/constants";

const stats = [
  { icon: Package,   value: "+1.000", label: "Produtos" },
  { icon: Users,     value: "+500",   label: "Sellers Atendidos" },
  { icon: MapPin,    value: "Todo",   label: "Brasil" },
  { icon: TrendingUp,value: "+8",     label: "Marcas Representadas" },
];

function MarketplaceDashboard() {
  return (
    <div className="relative w-full max-w-sm mx-auto lg:mx-0">
      {/* Main card — Mercado Livre */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.6 }}
        className="bg-dark-800 rounded-2xl border border-white/8 shadow-2xl p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-black text-xs">ML</span>
          </div>
          <span className="font-bold text-white text-sm">Mercado Livre</span>
          <span className="ml-auto flex items-center gap-1 text-green-400 text-xs font-bold">
            <TrendingUp size={11} /> +47%
          </span>
        </div>
        <p className="text-2xl font-black text-white">R$ 23.847</p>
        <p className="text-gray-500 text-xs mb-3">Faturamento do mês</p>
        <div className="h-2 bg-dark-600 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }} animate={{ width: "74%" }} transition={{ delay: 0.8, duration: 1, ease: "easeOut" }}
            className="h-full bg-yellow-400 rounded-full"
          />
        </div>
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-gray-600">Meta: R$ 32k</span>
          <span className="text-xs font-bold text-yellow-500">74% atingido</span>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/6">
          {[{ label: "Pedidos", value: "147" }, { label: "Visitas", value: "2.841" }, { label: "Conversão", value: "5,2%" }].map((m) => (
            <div key={m.label} className="text-center">
              <p className="font-black text-white text-sm">{m.value}</p>
              <p className="text-gray-500 text-xs">{m.label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Shopee card */}
      <motion.div
        initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6, duration: 0.5 }}
        className="bg-dark-800 rounded-xl border border-white/8 shadow-xl p-4 mt-3 ml-6"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#ee4d2d" }}>
            <ShoppingCart size={13} className="text-white" />
          </div>
          <span className="font-bold text-white text-sm">Shopee</span>
          <span className="ml-auto flex items-center gap-1 text-green-400 text-xs font-bold">
            <TrendingUp size={11} /> +31%
          </span>
        </div>
        <div className="flex items-center gap-4 mt-3">
          <div>
            <p className="font-black text-white text-lg">R$ 8.940</p>
            <p className="text-gray-500 text-xs">Faturamento</p>
          </div>
          <div className="flex-1 h-8 flex items-end gap-0.5">
            {[40, 55, 45, 70, 60, 85, 75].map((h, i) => (
              <motion.div key={i} initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ delay: 0.9 + i * 0.05, duration: 0.4 }}
                className="flex-1 rounded-sm" style={{ background: i === 6 ? "#ee4d2d" : "rgba(238,77,45,0.25)" }}
              />
            ))}
          </div>
        </div>
      </motion.div>

      {/* Dropshipping badge */}
      <motion.div
        initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7, duration: 0.5 }}
        className="absolute -left-4 bottom-20 bg-brand rounded-xl shadow-lg px-4 py-3 glow-red"
      >
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-white" />
          <span className="text-xs font-bold text-white">Dropshipping</span>
        </div>
        <p className="text-xs mt-0.5 text-red-200">Sem estoque necessário</p>
      </motion.div>

      {/* Stars badge */}
      <motion.div
        animate={{ y: [-4, 4, -4] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-3 -right-2 bg-dark-700 border border-white/10 rounded-full shadow-xl px-3 py-1.5 flex items-center gap-1.5"
      >
        {[1,2,3,4,5].map((s) => <Star key={s} size={11} className="text-yellow-400 fill-yellow-400" />)}
        <span className="text-xs font-bold text-white">5.0</span>
      </motion.div>
    </div>
  );
}

export default function Hero() {
  const scrollToForm = () => document.querySelector("#contato")?.scrollIntoView({ behavior: "smooth" });

  return (
    <section id="inicio" className="relative min-h-screen flex flex-col justify-center overflow-hidden bg-dark-950">
      {/* Background layers */}
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-brand/8 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-brand/5 blur-3xl pointer-events-none" />

      {/* Top red line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-brand to-transparent" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-8 lg:pt-36">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* Left */}
          <div>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 bg-brand/10 border border-brand/25 rounded-full text-sm text-brand font-semibold mb-6"
            >
              <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
              Representação Comercial Automotiva
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight mb-6 tracking-tight text-white"
            >
              Seu parceiro em{" "}
              <span className="text-gradient">acessórios</span>{" "}
              automotivos para{" "}
              <span className="text-gradient">ATACADO</span> e{" "}
              <span className="text-gradient">DROPSHIPPING</span>
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg text-gray-400 mb-8 leading-relaxed max-w-xl"
            >
              Atendemos distribuidores, lojistas e sellers Shopee / Mercado Livre
              com condições diferenciadas, suporte comercial e produtos de alta
              demanda em todo o Brasil.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 mb-10"
            >
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-7 py-4 bg-brand hover:bg-brand-hover text-white font-bold rounded-full transition-all duration-200 glow-red hover:scale-105 text-base"
              >
                <MessageCircle size={20} /> Falar no WhatsApp
              </a>
              <button onClick={scrollToForm}
                className="flex items-center justify-center gap-2 px-7 py-4 bg-dark-800 hover:bg-dark-700 border border-white/10 hover:border-white/20 text-gray-300 hover:text-white font-semibold rounded-full transition-all duration-200 text-base group"
              >
                <FileText size={20} />
                Solicitar Catálogo
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.5 }}
              className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-600"
            >
              {["Atendimento Nacional", "Sem Taxa de Adesão", "Suporte Comercial", "Pagamento Facilitado"].map((item) => (
                <span key={item} className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand" />{item}
                </span>
              ))}
            </motion.div>
          </div>

          {/* Right — dashboard */}
          <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.2 }}
            className="flex justify-center lg:justify-end pr-4"
          >
            <MarketplaceDashboard />
          </motion.div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="relative z-10 w-full border-t border-white/6 bg-dark-900/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, i) => (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.6 + i * 0.1 }}
                className="flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center flex-shrink-0">
                  <stat.icon size={18} className="text-brand" />
                </div>
                <div>
                  <p className="text-xl font-black text-white">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
