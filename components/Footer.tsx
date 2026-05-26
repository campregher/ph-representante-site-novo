"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Mail, MapPin, MessageCircle, ArrowUpRight } from "lucide-react";
import { WHATSAPP_URL, EMAIL, INSTAGRAM, FACEBOOK, COMPANY_CITY } from "@/lib/constants";

const quickLinks = [
  { label: "Início",        href: "#inicio" },
  { label: "Sobre nós",     href: "#sobre" },
  { label: "Atacado",       href: "#atacado" },
  { label: "Dropshipping",  href: "#dropshipping" },
  { label: "Representadas", href: "#representadas" },
  { label: "Serviços",      href: "#servicos" },
  { label: "Contato",       href: "#contato" },
];

const brands = ["ATTIS","ECOFLEX","MEGA AUTOMOTIVE","TOP MIX","TIGER","SOFISTICAR AUTOMOTIVE","TEVIC","VHIP ACESSÓRIOS"];

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

export default function Footer() {
  const handleNavClick = (href: string) => document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
  const year = new Date().getFullYear();

  return (
    <footer className="relative bg-dark-950 text-white">
      {/* Red accent top */}
      <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-brand to-transparent" />

      {/* Pre-footer CTA */}
      <div className="border-b border-white/6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="flex flex-col sm:flex-row items-center justify-between gap-6"
          >
            <div>
              <h3 className="text-xl font-black text-white mb-1">Pronto para começar?</h3>
              <p className="text-gray-500 text-sm">Entre em contato e receba nossa tabela de preços completa.</p>
            </div>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-7 py-3 bg-brand hover:bg-brand-hover text-white font-bold rounded-full transition-all glow-red-sm text-sm whitespace-nowrap"
            ><MessageCircle size={16} /> Falar no WhatsApp</a>
          </motion.div>
        </div>
      </div>

      {/* Main footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Company */}
          <div className="lg:col-span-1">
            <div className="mb-4">
              <Image src="/images/ph.png" alt="PH Representante" width={150} height={38} className="object-contain h-9 w-auto" />
            </div>
            <p className="text-gray-500 text-sm leading-relaxed mb-5">
              Representação comercial de acessórios automotivos para atacado, dropshipping e gestão de marketplaces.
            </p>
            <div className="space-y-2">
              <a href={`mailto:${EMAIL}`} className="flex items-center gap-2 text-gray-500 hover:text-white text-sm transition-colors">
                <Mail size={13} className="text-brand flex-shrink-0" />{EMAIL}
              </a>
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <MapPin size={13} className="text-brand flex-shrink-0" />{COMPANY_CITY}
              </div>
            </div>
            {/* Social */}
            <div className="flex gap-3 mt-5">
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"
                className="w-9 h-9 rounded-xl bg-[#25d366]/10 border border-[#25d366]/20 flex items-center justify-center text-[#25d366] hover:bg-[#25d366]/20 transition-colors"
              ><WhatsAppIcon /></a>
              <a href={INSTAGRAM} target="_blank" rel="noopener noreferrer" aria-label="Instagram"
                className="w-9 h-9 rounded-xl bg-pink-500/10 border border-pink-500/15 flex items-center justify-center text-pink-400 hover:bg-pink-500/20 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                  <rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.5" fill="currentColor"/>
                </svg>
              </a>
              <a href={FACEBOOK} target="_blank" rel="noopener noreferrer" aria-label="Facebook"
                className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/15 flex items-center justify-center text-blue-400 hover:bg-blue-500/20 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-bold text-white mb-4 text-xs uppercase tracking-widest">Links Rápidos</h4>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.label}>
                  <button onClick={() => handleNavClick(link.href)} className="flex items-center gap-1.5 text-gray-500 hover:text-white text-sm transition-colors group">
                    <span className="w-1 h-1 rounded-full bg-brand/40 group-hover:bg-brand transition-colors" />{link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Brands */}
          <div>
            <h4 className="font-bold text-white mb-4 text-xs uppercase tracking-widest">Representadas</h4>
            <ul className="space-y-2">
              {brands.map((b) => (
                <li key={b} className="flex items-center gap-1.5 text-gray-500 text-sm">
                  <span className="w-1 h-1 rounded-full bg-brand/40" />{b}
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-bold text-white mb-4 text-xs uppercase tracking-widest">Serviços</h4>
            <ul className="space-y-2">
              {["Atacado Automotivo","Dropshipping","Gestão Mercado Livre","Gestão Shopee","Criação de Anúncios","SEO para Marketplace","Gestão de Ads","Consultoria Sellers"].map((s) => (
                <li key={s} className="flex items-center gap-1.5 text-gray-500 text-sm">
                  <span className="w-1 h-1 rounded-full bg-brand/40" />{s}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-gray-600 text-xs">© {year} PH Representante. Todos os direitos reservados.</p>
          <a href="#inicio" onClick={(e) => { e.preventDefault(); handleNavClick("#inicio"); }} className="flex items-center gap-1 text-gray-600 hover:text-gray-400 text-xs transition-colors">
            Voltar ao topo <ArrowUpRight size={12} />
          </a>
        </div>
      </div>
    </footer>
  );
}
