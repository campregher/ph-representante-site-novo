export interface Brand {
  slug: string;
  name: string;
  segment: string;
  logo: string;
}

export const brands: Brand[] = [
  { slug: "attis",      name: "ATTIS",                 segment: "Tapetes e Proteção",       logo: "/images/brands/attis.png" },
  { slug: "ecoflex",    name: "ECOFLEX",               segment: "Proteção contra chuva",    logo: "/images/brands/ecoflex.png" },
  { slug: "mega",       name: "MEGA AUTOMOTIVE",       segment: "Proteção e Engate",        logo: "/images/brands/mega.png" },
  { slug: "sofisticar", name: "SOFISTICAR AUTOMOTIVE", segment: "Conforto e Interior",      logo: "/images/brands/sofisticar.png" },
  { slug: "tevic",      name: "TEVIC",                 segment: "Tapetes e Acessórios",     logo: "/images/brands/tevic.png" },
  { slug: "tiger",      name: "TIGER",                 segment: "Acessórios Completos",     logo: "/images/brands/tiger.png" },
  { slug: "topmix",     name: "TOP MIX",               segment: "Estética Automotiva",      logo: "/images/brands/topmix.png" },
  { slug: "vhip",       name: "VHIP ACESSÓRIOS",       segment: "Transporte e Bagageiro",   logo: "/images/brands/vhip.png" },
];

export function getBrandBySlug(slug: string): Brand | undefined {
  return brands.find((b) => b.slug === slug);
}
