const DEFAULT_PHOTOS = [
  "/images/products/tiger/1.jpg",
  "/images/products/mega/1.jpeg",
  "/images/products/vhip/1.png",
  "/images/products/tevic/1.webp",
  "/images/products/ecoflex/1.jpeg",
  "/images/products/attis/1.jpeg",
];

/** Fundo "papel de parede" com fotos reais do catálogo, escurecido — usado atrás de texto em claro. */
export default function ProductWall({
  photos = DEFAULT_PHOTOS,
  cols = 3,
  overlay = "dark",
}: {
  photos?: string[];
  cols?: number;
  /** "dark" aplica um véu padrão; "none" só a grade de fotos (pro chamador fazer seu próprio gradiente) */
  overlay?: "dark" | "darker" | "none";
}) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {photos.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={src + i} src={src} alt="" className="h-full w-full scale-110 object-cover" />
        ))}
      </div>
      {overlay !== "none" && (
        <div className={`absolute inset-0 ${overlay === "darker" ? "bg-black/88" : "bg-black/75"}`} />
      )}
    </div>
  );
}
