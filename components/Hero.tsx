"use client";

import { motion } from "framer-motion";
import { Store, Users2, TrendingUp, Package, MapPin } from "lucide-react";
import Link from "next/link";
import { WHATSAPP_GROUP_URL } from "@/lib/constants";
import ProductWall from "@/components/ProductWall";

const stats = [
  { icon: Package,   value: "+1.000", label: "Produtos" },
  { icon: Users2,    value: "+500",   label: "Sellers Atendidos" },
  { icon: MapPin,    value: "Todo",   label: "Brasil" },
  { icon: TrendingUp,value: "+8",     label: "Marcas Representadas" },
];

export default function Hero() {

  return (
    <section id="inicio" className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-dark-950">
      {/* Fundo — vitrine de produtos reais do catálogo */}
      <ProductWall overlay="none" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/92 via-black/80 to-black/55" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/40" />

      <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-36 pb-8 lg:pt-44">
        <div className="max-w-2xl">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="flex items-center gap-2 mb-5"
          >
            <span className="w-6 h-[3px] bg-brand flex-shrink-0" />
            <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">Representação Comercial Automotiva</span>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight mb-6 tracking-tight text-white"
          >
            Acessórios automotivos para{" "}
            <span className="text-brand">atacado</span> e{" "}
            <span className="text-brand">dropshipping</span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg text-gray-300 mb-8 leading-relaxed max-w-xl"
          >
            Atendemos distribuidores, lojistas e sellers Shopee / Mercado Livre
            com condições diferenciadas, suporte comercial e produtos de alta
            demanda em todo o Brasil.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-wrap gap-3 mb-10"
          >
            {["Calotas", "Tapetes", "Engates", "Acessórios internos"].map((item) => (
              <span key={item} className="text-xs font-bold text-white border border-white/30 bg-white/5 backdrop-blur-sm px-3 py-1.5 uppercase tracking-wide rounded-md">
                {item}
              </span>
            ))}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-3 mb-10"
          >
            <Link href="/drop/cadastro"
              className="flex items-center justify-center gap-2 px-7 py-4 bg-brand hover:bg-brand-hover text-white font-bold rounded-md transition-all duration-200 text-base"
            >
              <Store size={20} /> Vender no Dropshipping
            </Link>
            <a href={WHATSAPP_GROUP_URL} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-7 py-4 bg-white/10 hover:bg-white/15 border border-white/25 backdrop-blur-sm text-white font-bold rounded-md transition-all duration-200 text-base"
            >
              <Users2 size={20} /> Entrar no grupo
            </a>
          </motion.div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="relative z-10 w-full border-t border-white/10 bg-black/60 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, i) => (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.6 + i * 0.1 }}
                className="flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-md bg-brand/20 border border-brand/40 flex items-center justify-center flex-shrink-0">
                  <stat.icon size={18} className="text-brand" />
                </div>
                <div>
                  <p className="text-xl font-black text-white">{stat.value}</p>
                  <p className="text-xs text-gray-400">{stat.label}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
