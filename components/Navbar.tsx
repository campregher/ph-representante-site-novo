"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ChevronDown, BookOpen, Package, MapPin, Mail, Phone } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { WHATSAPP_URL, EMAIL, COMPANY_CITY } from "@/lib/constants";

const navLinks = [
  { label: "Início",        href: "#inicio" },
  { label: "Sobre",         href: "#sobre" },
  { label: "Modelos",       href: "#modelos", dropdown: [{ label: "Atacado", href: "#atacado" }, { label: "Dropshipping", href: "#dropshipping" }] },
  { label: "Representadas", href: "#representadas" },
  { label: "Serviços",      href: "#servicos" },
  { label: "Contato",       href: "#contato" },
];

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleNavClick = (href: string) => {
    setIsOpen(false);
    if (href.startsWith("/")) {
      router.push(href);
      return;
    }
    if (pathname !== "/") {
      router.push("/" + href);
    } else {
      setTimeout(() => {
        document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
      }, 250);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      {/* Topbar — contato rápido */}
      <div className="hidden bg-brand text-white lg:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2 text-xs font-medium lg:px-8">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5">
              <MapPin size={13} /> {COMPANY_CITY} · Atendimento todo o Brasil
            </span>
            <span className="flex items-center gap-1.5">
              <Mail size={13} /> {EMAIL}
            </span>
          </div>
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:underline">
            <Phone size={13} /> Fale com a gente agora
          </a>
        </div>
      </div>

      {/* Nav principal */}
      <div className={`bg-white transition-all duration-300 ${
        scrolled ? "border-b border-gray-900 shadow-[0_4px_18px_rgba(0,0,0,0.08)]" : "border-b border-gray-200"
      }`}>
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-3">

            {/* Logo */}
            <Link href="#inicio" onClick={() => handleNavClick("#inicio")}>
              <Image src="/images/ph.png" alt="PH Representante" width={160} height={40} className="object-contain h-10 w-auto" priority />
            </Link>

            {/* Desktop nav */}
            <div className="hidden lg:flex items-center gap-1">
              {navLinks.map((link) => (
                <div key={link.label} className="relative"
                  onMouseEnter={() => link.dropdown ? setActiveDropdown(link.label) : undefined}
                  onMouseLeave={() => setActiveDropdown(null)}
                >
                  <button onClick={() => !link.dropdown && handleNavClick(link.href)}
                    className="flex items-center gap-1 px-4 py-2 text-sm text-gray-700 hover:text-brand font-semibold uppercase tracking-wide transition-colors rounded-md hover:bg-gray-50 cursor-pointer"
                  >
                    {link.label}
                    {link.dropdown && <ChevronDown size={13} className={`transition-transform duration-200 ${activeDropdown === link.label ? "rotate-180" : ""}`} />}
                  </button>

                  <AnimatePresence>
                    {link.dropdown && activeDropdown === link.label && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.15 }}
                        className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md p-2 min-w-40 shadow-lg"
                      >
                        {link.dropdown.map((item) => (
                          <button key={item.label} onClick={() => handleNavClick(item.href)}
                            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:text-brand hover:bg-gray-50 rounded-md transition-colors cursor-pointer"
                          >{item.label}</button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="hidden lg:flex items-center gap-2">
              <Link href="/drop/login"
                className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 border border-gray-900 text-gray-900 text-sm font-bold uppercase tracking-wide rounded-md transition-all duration-200"
              >
                <Package size={15} /> Dropshipping
              </Link>
              <Link href="/catalogo"
                className="flex items-center gap-2 px-5 py-2.5 bg-brand hover:bg-brand-hover text-white text-sm font-bold uppercase tracking-wide rounded-md transition-all duration-200"
              >
                <BookOpen size={16} /> Catálogo
              </Link>
            </div>

            {/* Mobile toggle */}
            <button onClick={() => setIsOpen(!isOpen)} className="lg:hidden p-2 text-gray-700 hover:text-brand rounded-md hover:bg-gray-50 transition-colors" aria-label="Menu">
              {isOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </nav>

        {/* Mobile menu */}
        <AnimatePresence>
          {isOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}
              className="lg:hidden bg-white border-t border-gray-200 overflow-hidden"
            >
              <div className="px-4 py-4 space-y-1">
                {navLinks.map((link) => (
                  <button key={link.label} onClick={() => handleNavClick(link.href)}
                    className="w-full text-left px-4 py-3 text-gray-700 hover:text-brand hover:bg-gray-50 rounded-md transition-colors font-semibold uppercase tracking-wide text-sm"
                  >{link.label}</button>
                ))}
                <div className="pt-3 space-y-2">
                  <Link href="/drop/login" onClick={() => setIsOpen(false)}
                    className="flex items-center justify-center gap-2 w-full px-5 py-3 bg-white border border-gray-900 text-gray-900 font-bold uppercase tracking-wide rounded-md transition-colors"
                  >
                    <Package size={18} /> Dropshipping
                  </Link>
                  <Link href="/catalogo" onClick={() => setIsOpen(false)}
                    className="flex items-center justify-center gap-2 w-full px-5 py-3 bg-brand hover:bg-brand-hover text-white font-bold uppercase tracking-wide rounded-md transition-colors"
                  >
                    <BookOpen size={18} /> Ver Catálogo
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
