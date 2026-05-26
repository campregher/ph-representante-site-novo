"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MessageCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { WHATSAPP_NUMBER, WHATSAPP_URL } from "@/lib/constants";

type Modality = "ATACADO" | "DROP" | "AMBOS";

interface Brand {
  name: string;
  slug: string;
  segment: string;
  modality: Modality;
  products: string[];
  highlight?: boolean;
  description: string;
  productImages: string[];
}

const brands: Brand[] = [
  {
    name: "ATTIS",
    slug: "attis",
    segment: "Tapetes e Proteção",
    modality: "AMBOS",
    highlight: true,
    products: ["Tapetes bandeja", "Lameiros", "Proteções de soleira"],
    description: "A ATTIS é referência nacional em tapetes automotivos e proteções de soleira. Produtos com alto padrão de qualidade, disponíveis para atacado e dropshipping, com excelente aceitação no Mercado Livre e Shopee.",
    productImages: [
      "/images/products/attis/1.jpeg",
      "/images/products/attis/2.jpeg",
      "/images/products/attis/3.png",
      "/images/products/attis/4.jpeg",
      "/images/products/attis/5.png",
    ],
  },
  {
    name: "ECOFLEX",
    slug: "ecoflex",
    segment: "Proteção contra chuva",
    modality: "AMBOS",
    products: ["Calhas de chuva", "Defletores", "Proteção lateral"],
    description: "A ECOFLEX fabrica calhas de chuva e defletores com material de alta durabilidade. Cobertura para as principais montadoras do mercado brasileiro, com ótimo giro nos marketplaces.",
    productImages: [
      "/images/products/ecoflex/1.jpeg",
      "/images/products/ecoflex/2.webp",
      "/images/products/ecoflex/3.webp",
    ],
  },
  {
    name: "MEGA AUTOMOTIVE",
    slug: "mega",
    segment: "Proteção e Engate",
    modality: "ATACADO",
    highlight: true,
    products: ["Protetores de cárter", "Engates removíveis", "Engates fixos"],
    description: "A MEGA AUTOMOTIVE é especialista em engates e protetores de cárter. Produtos certificados e com alta durabilidade, ideais para distribuidores e lojas de autopeças de todo o Brasil.",
    productImages: [
      "/images/products/mega/1.jpeg",
      "/images/products/mega/2.jpeg",
      "/images/products/mega/3.jpg",
      "/images/products/mega/4.jpg",
    ],
  },
  {
    name: "TOP MIX",
    slug: "topmix",
    segment: "Estética Automotiva",
    modality: "ATACADO",
    products: ["Frisos laterais", "Calotas", "Capas de estepe"],
    description: "A TOP MIX oferece linha completa de estética automotiva: frisos laterais, calotas e capas de estepe. Produtos com ótimo acabamento e grande variedade de modelos para o mercado nacional.",
    productImages: [
      "/images/products/topmix/1.jpg",
      "/images/products/topmix/2.jpg",
      "/images/products/topmix/3.jpg",
      "/images/products/topmix/4.webp",
      "/images/products/topmix/5.webp",
    ],
  },
  {
    name: "TIGER",
    slug: "tiger",
    segment: "Acessórios Completos",
    modality: "DROP",
    highlight: true,
    products: ["Frisos", "Calotas", "Calhas de chuva", "Pingadeiras"],
    description: "A TIGER oferece um portfólio completo de acessórios automotivos. Com ampla cobertura de modelos e alta demanda no dropshipping, é uma das marcas de maior volume no Mercado Livre e Shopee.",
    productImages: [
      "/images/products/tiger/1.jpg",
      "/images/products/tiger/2.jpg",
      "/images/products/tiger/3.jpg",
      "/images/products/tiger/4.webp",
      "/images/products/tiger/5.webp",
    ],
  },
  {
    name: "SOFISTICAR AUTOMOTIVE",
    slug: "sofisticar",
    segment: "Conforto e Interior",
    modality: "AMBOS",
    products: ["Apoio de braço", "Grades", "Subconjuntos", "Soleiras"],
    description: "A SOFISTICAR AUTOMOTIVE é especializada em itens de conforto e acessórios de interior. Apoios de braço, soleiras e grades com design sofisticado e qualidade premium para o mercado automotivo.",
    productImages: [
      "/images/products/sofisticar/1.jpg",
      "/images/products/sofisticar/2.png",
      "/images/products/sofisticar/3.png",
      "/images/products/sofisticar/4.webp",
    ],
  },
  {
    name: "TEVIC",
    slug: "tevic",
    segment: "Tapetes e Acessórios",
    modality: "AMBOS",
    highlight: true,
    products: ["Tapetes de carpete", "Puxa e empurra", "Conjuntos"],
    description: "A TEVIC produz tapetes de carpete com alta qualidade e durabilidade. Produtos com excelente apresentação e grande aceitação nos principais marketplaces, disponíveis para atacado e dropshipping.",
    productImages: [
      "/images/products/tevic/1.webp",
      "/images/products/tevic/2.webp",
    ],
  },
  {
    name: "VHIP ACESSÓRIOS",
    slug: "vhip",
    segment: "Transporte e Bagageiro",
    modality: "AMBOS",
    products: ["Racks", "Longarinas transversais", "Capas", "Triângulo"],
    description: "A VHIP ACESSÓRIOS é referência em soluções de transporte e bagageiro. Racks, longarinas e acessórios para transporte com qualidade e resistência, para uma ampla variedade de veículos.",
    productImages: [
      "/images/products/vhip/1.png",
      "/images/products/vhip/2.webp",
      "/images/products/vhip/3.webp",
    ],
  },
];

const modalityConfig: Record<Modality, { label: string; cls: string; dot: string }> = {
  ATACADO: { label: "Atacado",        cls: "badge-atacado", dot: "bg-blue-400" },
  DROP:    { label: "Dropshipping",   cls: "badge-drop",    dot: "bg-brand" },
  AMBOS:   { label: "Atacado + Drop", cls: "badge-both",    dot: "bg-orange-400" },
};

function BrandLogo({ slug, name, className = "" }: { slug: string; name: string; className?: string }) {
  const [err, setErr] = useState(false);
  if (err) return <span className="font-black text-white text-sm text-center leading-tight">{name}</span>;
  return (
    <img
      src={`/images/brands/${slug}.png`}
      alt={name}
      className={`object-contain ${className}`}
      onError={() => setErr(true)}
    />
  );
}

function ProductThumb({ src, alt, onClick }: { src: string; alt: string; onClick: () => void }) {
  const [err, setErr] = useState(false);
  if (err) {
    return (
      <div className="aspect-square rounded-xl bg-dark-700 border border-white/8 flex items-center justify-center cursor-default">
        <span className="text-gray-600 text-xs text-center px-2">{alt}</span>
      </div>
    );
  }
  return (
    <button onClick={onClick} className="aspect-square rounded-xl overflow-hidden bg-dark-700 border border-white/8 group/img relative">
      <img src={src} alt={alt} className="w-full h-full object-contain bg-white p-1 group-hover/img:scale-105 transition-transform duration-300" onError={() => setErr(true)} />
      <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors duration-200 flex items-center justify-center">
        <div className="opacity-0 group-hover/img:opacity-100 transition-opacity duration-200 bg-white/20 backdrop-blur-sm rounded-full p-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-white"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"/></svg>
        </div>
      </div>
    </button>
  );
}

function Lightbox({ images, index, onClose }: { images: string[]; index: number; onClose: () => void }) {
  const [current, setCurrent] = useState(index);
  const prev = () => setCurrent((c) => (c - 1 + images.length) % images.length);
  const next = () => setCurrent((c) => (c + 1) % images.length);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-sm"
      onClick={onClose}
    >
      <button onClick={(e) => { e.stopPropagation(); prev(); }}
        className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors z-10"
      ><ChevronLeft size={20} /></button>

      <motion.img
        key={current}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        src={images[current]}
        alt={`Produto ${current + 1}`}
        className="max-h-[85vh] max-w-[85vw] object-contain rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />

      <button onClick={(e) => { e.stopPropagation(); next(); }}
        className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors z-10"
      ><ChevronRight size={20} /></button>

      <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
        <X size={16} />
      </button>
      <p className="absolute bottom-4 text-gray-500 text-sm">{current + 1} / {images.length}</p>
    </motion.div>
  );
}

function BrandModal({ brand, onClose }: { brand: Brand; onClose: () => void }) {
  const mod = modalityConfig[brand.modality];
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape" && lightboxIndex === null) onClose(); };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [lightboxIndex, onClose]);

  const whatsappMsg = encodeURIComponent(`Olá! Tenho interesse nos produtos da marca ${brand.name}. Pode me passar mais informações e tabela de preços?`);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 24 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 24 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="bg-dark-800 border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-4 p-6 border-b border-white/8 flex-shrink-0">
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-black text-white leading-tight">{brand.name}</h3>
              <p className="text-sm text-gray-500">{brand.segment}</p>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold mt-1 ${mod.cls}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${mod.dot}`} />{mod.label}
              </span>
            </div>
            <button onClick={onClose}
              className="w-9 h-9 rounded-full bg-dark-700 border border-white/8 flex items-center justify-center text-gray-500 hover:text-white hover:border-white/20 transition-all flex-shrink-0"
            ><X size={16} /></button>
          </div>

          {/* Body (scrollable) */}
          <div className="overflow-y-auto flex-1 p-6 space-y-6">
            <p className="text-gray-400 leading-relaxed">{brand.description}</p>

            <div>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Linha de Produtos</h4>
              <div className="flex flex-wrap gap-2">
                {brand.products.map((p) => (
                  <span key={p} className="px-3 py-1.5 bg-dark-700 border border-white/8 rounded-full text-xs text-gray-300">{p}</span>
                ))}
              </div>
            </div>

            {brand.productImages.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Fotos dos Produtos</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {brand.productImages.map((src, i) => (
                    <ProductThumb key={i} src={src} alt={`${brand.name} — produto ${i + 1}`} onClick={() => setLightboxIndex(i)} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer CTA */}
          <div className="p-6 border-t border-white/8 flex-shrink-0">
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMsg}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3.5 bg-brand hover:bg-brand-hover text-white font-bold rounded-full transition-all glow-red-sm text-sm"
            >
              <MessageCircle size={18} /> Consultar preços da {brand.name}
            </a>
          </div>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {lightboxIndex !== null && (
          <Lightbox
            images={brand.productImages}
            index={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const cardItem  = { hidden: { opacity: 0, scale: 0.96, y: 16 }, show: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.4 } } };

export default function Brands() {
  const [selected, setSelected] = useState<Brand | null>(null);

  return (
    <section id="representadas" className="relative py-24 bg-dark-900">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand/25 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 text-sm font-semibold text-brand bg-brand/10 border border-brand/25 rounded-full mb-4">Marcas Representadas</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4 text-white">Nosso <span className="text-gradient">portfólio</span> de marcas</h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">Clique em uma marca para ver detalhes e fotos dos produtos.</p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            {(Object.entries(modalityConfig) as [Modality, typeof modalityConfig[Modality]][]).map(([key, cfg]) => (
              <span key={key} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${cfg.cls}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{cfg.label}
              </span>
            ))}
          </div>
        </motion.div>

        <motion.div variants={container} initial="hidden" whileInView="show" viewport={{ once: true }} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {brands.map((brand) => {
            const mod = modalityConfig[brand.modality];
            return (
              <motion.div key={brand.name} variants={cardItem} whileHover={{ scale: 1.03, y: -5 }}
                className={`relative bg-dark-800 rounded-2xl p-6 border transition-all duration-300 group cursor-pointer ${
                  brand.highlight ? "border-brand/25 hover:border-brand/50" : "border-white/7 hover:border-white/15"
                }`}
                onClick={() => setSelected(brand)}
              >
                {brand.highlight && <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-brand animate-pulse" />}

                {/* Logo area */}
                <div className="w-full h-28 flex items-center justify-center px-2 mb-4 overflow-hidden">
                  <BrandLogo slug={brand.slug} name={brand.name} className="h-24 w-full object-contain object-center" />
                </div>

                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold mb-3 ${mod.cls}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${mod.dot}`} />{mod.label}
                </span>
                <h3 className="text-sm font-black text-white mb-1 leading-tight">{brand.name}</h3>
                <p className="text-xs text-gray-600 mb-3 font-medium uppercase tracking-wide">{brand.segment}</p>
                <ul className="space-y-1 mb-4">
                  {brand.products.slice(0, 3).map((p) => (
                    <li key={p} className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="w-1 h-1 rounded-full bg-brand/50 flex-shrink-0" />{p}
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-1 text-xs text-brand font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  Ver produtos
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.3 }} className="text-center mt-12">
          <p className="text-gray-600 mb-4 text-sm">Catálogo completo com tabelas de preços disponível via WhatsApp</p>
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-7 py-3 bg-brand hover:bg-brand-hover text-white font-bold rounded-full transition-all glow-red-sm text-sm"
          ><MessageCircle size={18} /> Solicitar Tabela de Preços</a>
        </motion.div>
      </div>

      <AnimatePresence>
        {selected && <BrandModal brand={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </section>
  );
}
