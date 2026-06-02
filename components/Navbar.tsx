"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ChevronDown, BookOpen, UserCircle2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";

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
    if (pathname !== "/") {
      router.push("/" + href);
    } else {
      setTimeout(() => {
        document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
      }, 250);
    }
  };

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? "bg-dark-950/98 backdrop-blur-xl border-b border-white/6 shadow-[0_4px_24px_rgba(0,0,0,0.7)]" : "bg-dark-950/90 backdrop-blur-md border-b border-white/4"
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
                  className="flex items-center gap-1 px-4 py-2 text-sm text-gray-400 hover:text-white font-medium transition-colors rounded-lg hover:bg-white/5 cursor-pointer"
                >
                  {link.label}
                  {link.dropdown && <ChevronDown size={13} className={`transition-transform duration-200 ${activeDropdown === link.label ? "rotate-180" : ""}`} />}
                </button>

                <AnimatePresence>
                  {link.dropdown && activeDropdown === link.label && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 mt-1 bg-dark-900 border border-white/8 rounded-xl p-2 min-w-40 shadow-xl"
                    >
                      {link.dropdown.map((item) => (
                        <button key={item.label} onClick={() => handleNavClick(item.href)}
                          className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/6 rounded-lg transition-colors cursor-pointer"
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
            <Link href="/catalogo"
              className="flex items-center gap-2 px-4 py-2.5 bg-dark-800 hover:bg-dark-700 border border-white/10 hover:border-brand/30 text-gray-300 hover:text-white text-sm font-semibold rounded-full transition-all duration-200"
            >
              <BookOpen size={15} /> Catálogo
            </Link>
            <Link href="/portal/login"
              className="flex items-center gap-2 px-5 py-2.5 bg-brand hover:bg-brand-hover text-white text-sm font-semibold rounded-full transition-all duration-200 glow-red-sm hover:scale-105"
            >
              <UserCircle2 size={16} /> Área do Cliente
            </Link>
          </div>

          {/* Mobile toggle */}
          <button onClick={() => setIsOpen(!isOpen)} className="lg:hidden p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors" aria-label="Menu">
            {isOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}
            className="lg:hidden bg-dark-950 border-t border-white/6 overflow-hidden"
          >
            <div className="px-4 py-4 space-y-1">
              {navLinks.map((link) => (
                <button key={link.label} onClick={() => handleNavClick(link.href)}
                  className="w-full text-left px-4 py-3 text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors font-medium"
                >{link.label}</button>
              ))}
              <div className="pt-3 space-y-2">
                <Link href="/catalogo" onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center gap-2 w-full px-5 py-3 bg-dark-800 border border-white/10 text-gray-300 font-semibold rounded-full transition-colors"
                >
                  <BookOpen size={18} /> Ver Catálogo
                </Link>
                <Link href="/portal/login" onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center gap-2 w-full px-5 py-3 bg-brand hover:bg-brand-hover text-white font-semibold rounded-full transition-colors"
                >
                  <UserCircle2 size={18} /> Área do Cliente
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
