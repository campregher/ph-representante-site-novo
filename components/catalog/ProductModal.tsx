"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, MessageCircle, ClipboardList } from "lucide-react";
import Image from "next/image";
import { getBrandBySlug } from "@/lib/brands";
import { WHATSAPP_NUMBER } from "@/lib/constants";
import type { Product } from "@/lib/produtos";

export default function ProductModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [imgError, setImgError] = useState(false);
  const brand = getBrandBySlug(product.brand);
  const images = product.images.filter(Boolean);

  useEffect(() => {
    setPhotoIndex(0);
    setImgError(false);
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setPhotoIndex((i) => (i - 1 + images.length) % images.length);
      if (e.key === "ArrowRight") setPhotoIndex((i) => (i + 1) % images.length);
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [product.id]);

  const waMsg = encodeURIComponent(
    `Olá! Tenho interesse no produto *${product.name}* (SKU: ${product.sku}). Pode me enviar a tabela de preços?`
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 12 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="bg-white border border-gray-200 rounded-md w-full max-w-2xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {brand && (
              <div className="rounded-md bg-gray-900 px-2 py-1 flex-shrink-0">
                <Image src={brand.logo} alt={brand.name} width={64} height={28} className="object-contain h-6 w-auto" unoptimized />
              </div>
            )}
            <span className="font-mono text-xs text-brand/80 bg-brand/10 px-2 py-0.5 rounded-md flex-shrink-0">{product.sku}</span>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:border-gray-400 transition-all flex-shrink-0 ml-2"
          ><X size={15} /></button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {/* Image gallery */}
          {images.length > 0 && (
            <div className="relative bg-gray-50 aspect-video flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.div key={photoIndex} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="w-full h-full relative">
                  {!imgError ? (
                    <Image src={images[photoIndex]} alt={product.name} fill className="object-contain p-4" onError={() => setImgError(true)} unoptimized />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">Imagem indisponível</div>
                  )}
                </motion.div>
              </AnimatePresence>
              {images.length > 1 && (
                <>
                  <button onClick={() => { setImgError(false); setPhotoIndex((i) => (i - 1 + images.length) % images.length); }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 border border-gray-200 shadow flex items-center justify-center text-gray-700 hover:text-gray-900 hover:bg-white transition-colors"
                  ><ChevronLeft size={18} /></button>
                  <button onClick={() => { setImgError(false); setPhotoIndex((i) => (i + 1) % images.length); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 border border-gray-200 shadow flex items-center justify-center text-gray-700 hover:text-gray-900 hover:bg-white transition-colors"
                  ><ChevronRight size={18} /></button>
                  {/* Thumbnails */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {images.map((src, i) => (
                      <button key={i} onClick={() => { setImgError(false); setPhotoIndex(i); }}
                        className={`w-8 h-8 rounded-md overflow-hidden border-2 bg-white transition-all ${i === photoIndex ? "border-brand" : "border-gray-200"}`}
                      >
                        <Image src={src} alt="" width={32} height={32} className="object-cover w-full h-full" unoptimized />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Details */}
          <div className="p-6 space-y-4">
            <h2 className="text-xl font-black text-gray-900 leading-snug">{product.name}</h2>
            {product.description && (
              <p className="text-gray-600 text-sm leading-relaxed">{product.description}</p>
            )}
          </div>
        </div>

        {/* Footer CTAs */}
        <div className="p-5 border-t border-gray-200 flex flex-col sm:flex-row gap-3 flex-shrink-0">
          <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${waMsg}`} target="_blank" rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#16a34a] hover:bg-[#15803d] text-white font-bold rounded-md transition-all text-sm"
          ><MessageCircle size={16} /> Solicitar via WhatsApp</a>
          <a href="/#contato"
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-brand hover:bg-brand-hover text-white font-bold rounded-md transition-all text-sm"
          ><ClipboardList size={16} /> Solicitar pelo Formulário</a>
        </div>
      </motion.div>
    </motion.div>
  );
}
