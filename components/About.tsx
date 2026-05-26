"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Headphones, Truck, Award, BarChart2, Globe } from "lucide-react";

const stats = [
  { value: "+1.000", label: "Produtos no catálogo" },
  { value: "+500",   label: "Sellers atendidos" },
  { value: "8+",     label: "Marcas representadas" },
  { value: "100%",   label: "Atendimento nacional" },
];

const pillars = [
  { icon: ShieldCheck, title: "Parceiros de grandes fabricantes", desc: "Representamos marcas consolidadas no mercado nacional de acessórios automotivos." },
  { icon: Headphones,  title: "Suporte comercial dedicado",       desc: "Time especializado para ajudar na negociação, pedidos e estratégia de vendas." },
  { icon: Truck,       title: "Logística nacional",               desc: "Enviamos para todo o Brasil com agilidade, atendendo atacado e dropshipping." },
  { icon: Award,       title: "Produtos de alta demanda",         desc: "Catálogo focado em itens com alto giro e boa margem nos principais marketplaces." },
  { icon: BarChart2,   title: "Especialistas em marketplaces",    desc: "Experiência sólida em Mercado Livre e Shopee — sabemos o que vende de verdade." },
  { icon: Globe,       title: "Seller do Brasil inteiro",         desc: "Atendemos sellers de norte a sul, de iniciantes a grandes operadores." },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

export default function About() {
  return (
    <section id="sobre" className="relative py-24 bg-dark-900">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand/35 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 text-sm font-semibold text-brand bg-brand/10 border border-brand/25 rounded-full mb-4">
            Quem Somos
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4 text-white">A PH Representante</h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
            Somos especialistas em representação comercial de acessórios automotivos,
            conectando fabricantes de qualidade a distribuidores, lojistas e sellers em todo o Brasil.
          </p>
        </motion.div>

        {/* Stats */}
        <motion.div variants={container} initial="hidden" whileInView="show" viewport={{ once: true }} className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-20">
          {stats.map((s) => (
            <motion.div key={s.label} variants={item}
              className="bg-dark-800 border border-white/7 rounded-2xl p-6 text-center hover:border-brand/30 transition-all duration-200 group"
            >
              <p className="text-4xl font-black mb-2 text-gradient">{s.value}</p>
              <p className="text-sm text-gray-500">{s.label}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Pillars */}
        <motion.div variants={container} initial="hidden" whileInView="show" viewport={{ once: true }} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {pillars.map((p) => (
            <motion.div key={p.title} variants={item} whileHover={{ scale: 1.02, y: -4 }}
              className="bg-dark-800 border border-white/7 rounded-2xl p-6 hover:border-brand/25 transition-all duration-300 group"
            >
              <div className="w-12 h-12 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center mb-4 group-hover:bg-brand/20 transition-colors">
                <p.icon size={22} className="text-brand" />
              </div>
              <h3 className="font-bold text-white mb-2">{p.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{p.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
