"use client";

import { CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";

/* ─── tipos ──────────────────────────────────────── */

export interface QualityAttr {
  id: string;
  name: string;
  required: boolean;
}

export interface QualityIndicatorProps {
  name:             string;
  sku:              string;
  price:            string;
  description:      string;
  images:           string[];
  condition?:       string;
  attrValues:       Record<string, string>;
  requiredAttrs:    QualityAttr[];
  optionalAttrs:    QualityAttr[];
  compatibilidades: unknown[];
  loadingAttrs?:    boolean;
}

/* ─── pesos de pontuação ──────────────────────────── */

/*
  Básico  (60 pts total) → score < 60% = não publica
  ─ Nome preenchido          8 pts
  ─ SKU preenchido           5 pts
  ─ Preço > 0               12 pts
  ─ Condição                 5 pts
  ─ 1+ foto                 10 pts
  ─ Descrição > 20 chars     5 pts
  ─ Atributos obrigatórios  15 pts  (repartido entre eles)

  Qualidade (40 pts total)
  ─ Título 40-60 chars       6 pts
  ─ Descrição > 200 chars    7 pts
  ─ 3+ fotos                 7 pts
  ─ Compatibilidade veicular 5 pts
  ─ Atributos opcionais     15 pts  (repartido entre até 5)
*/

const BASIC_FIXED   = 8 + 5 + 12 + 5 + 10 + 5;   // 45 pts de campos fixos básicos
const BASIC_ATTRS   = 15;                           // pts dos atributos obrigatórios
const QUALITY_FIXED = 6 + 7 + 7 + 5;               // 25 pts de qualidade fixos
const QUALITY_ATTRS = 15;                           // pts dos atributos opcionais

/* ─── cálculo ─────────────────────────────────────── */

interface Check {
  label:    string;
  ok:       boolean;
  pts:      number;
  required: boolean;   // bloqueia publicação se false
  group:    "basico" | "qualidade";
}

export function calcQualityScore(p: QualityIndicatorProps): {
  score: number;
  checks: Check[];
  canPublish: boolean;
  basicScore: number;
} {
  const checks: Check[] = [];

  /* ── básicos fixos ── */
  const nameOk  = p.name.trim().length > 0;
  const skuOk   = p.sku.trim().length > 0;
  const priceOk = Number(p.price.replace(",", ".")) > 0;
  const condOk  = Boolean(p.condition);
  const imgOk   = p.images.filter(Boolean).length >= 1;
  const descOk  = p.description.trim().length > 20;

  checks.push({ label: "Título preenchido",      ok: nameOk,  pts: 8,  required: true,  group: "basico"    });
  checks.push({ label: "SKU preenchido",          ok: skuOk,   pts: 5,  required: false, group: "basico"    });
  checks.push({ label: "Preço maior que zero",    ok: priceOk, pts: 12, required: true,  group: "basico"    });
  checks.push({ label: "Condição (Novo/Usado)",   ok: condOk,  pts: 5,  required: true,  group: "basico"    });
  checks.push({ label: "Pelo menos 1 foto",       ok: imgOk,   pts: 10, required: true,  group: "basico"    });
  checks.push({ label: "Descrição preenchida",    ok: descOk,  pts: 5,  required: false, group: "basico"    });

  /* ── atributos obrigatórios ML ── */
  const reqCount = p.requiredAttrs.length;
  if (reqCount > 0) {
    const ptsEach = BASIC_ATTRS / reqCount;
    for (const attr of p.requiredAttrs) {
      const filled = Boolean(p.attrValues[attr.id]?.trim());
      checks.push({
        label:    `${attr.name}`,
        ok:       filled,
        pts:      ptsEach,
        required: true,
        group:    "basico",
      });
    }
  } else if (!p.loadingAttrs) {
    /* sem atributos obrigatórios: distribui os pts como bônus */
    checks.push({ label: "Atributos ML",   ok: true,  pts: BASIC_ATTRS,    required: false, group: "basico"    });
  }

  /* ── qualidade fixa ── */
  const titleLenOk = p.name.trim().length >= 40 && p.name.trim().length <= 60;
  const descQualOk = p.description.trim().length > 200;
  const imgs3Ok    = p.images.filter(Boolean).length >= 3;
  const compatOk   = (p.compatibilidades ?? []).length > 0;

  checks.push({ label: "Título entre 40 e 60 caracteres", ok: titleLenOk, pts: 6, required: false, group: "qualidade" });
  checks.push({ label: "Descrição com 200+ caracteres",   ok: descQualOk, pts: 7, required: false, group: "qualidade" });
  checks.push({ label: "3 ou mais fotos",                 ok: imgs3Ok,    pts: 7, required: false, group: "qualidade" });
  checks.push({ label: "Compatibilidade veicular",        ok: compatOk,   pts: 5, required: false, group: "qualidade" });

  /* ── atributos opcionais ML (primeiros 5 que mais impactam) ── */
  const optSlice = p.optionalAttrs.slice(0, 5);
  const optCount = optSlice.length;
  if (optCount > 0) {
    const ptsEach = QUALITY_ATTRS / optCount;
    for (const attr of optSlice) {
      const filled = Boolean(p.attrValues[attr.id]?.trim());
      checks.push({
        label:    `${attr.name}`,
        ok:       filled,
        pts:      ptsEach,
        required: false,
        group:    "qualidade",
      });
    }
  } else if (!p.loadingAttrs) {
    checks.push({ label: "Atributos opcionais ML", ok: true, pts: QUALITY_ATTRS, required: false, group: "qualidade" });
  }

  const totalPts  = checks.reduce((s, c) => s + c.pts, 0);
  const earnedPts = checks.filter(c => c.ok).reduce((s, c) => s + c.pts, 0);
  const score     = Math.round((earnedPts / totalPts) * 100);

  /* pode publicar: todos os required checks ok */
  const requiredChecks = checks.filter(c => c.required);
  const canPublish     = requiredChecks.every(c => c.ok);

  /* pontuação básica (só campos básicos) */
  const basicChecks = checks.filter(c => c.group === "basico");
  const basicTotal  = basicChecks.reduce((s, c) => s + c.pts, 0);
  const basicEarned = basicChecks.filter(c => c.ok).reduce((s, c) => s + c.pts, 0);
  const basicScore  = Math.round((basicEarned / basicTotal) * 100);

  return { score, checks, canPublish, basicScore };
}

/* ─── componente visual ──────────────────────────── */

export default function QualityIndicator(props: QualityIndicatorProps) {
  const { score, checks, canPublish } = calcQualityScore(props);

  const color =
    score >= 90 ? "text-green-400"  :
    score >= 60 ? "text-yellow-400" :
    "text-red-400";

  const barColor =
    score >= 90 ? "bg-green-400"  :
    score >= 60 ? "bg-yellow-400" :
    "bg-red-400";

  const ringColor =
    score >= 90 ? "stroke-green-400"  :
    score >= 60 ? "stroke-yellow-400" :
    "stroke-red-400";

  /* SVG circle */
  const r     = 28;
  const circ  = 2 * Math.PI * r;
  const dash  = circ * (1 - score / 100);

  const basicChecks   = checks.filter(c => c.group === "basico");
  const qualChecks    = checks.filter(c => c.group === "qualidade");
  const missingReq    = basicChecks.filter(c => !c.ok && c.required);
  const missingOpt    = [...basicChecks, ...qualChecks].filter(c => !c.ok && !c.required);

  return (
    <div className="flex flex-col gap-4">

      {/* Score circle */}
      <div className="bg-dark-800 border border-white/8 rounded-2xl p-5">
        <div className="flex items-center gap-4">
          {/* Círculo SVG */}
          <div className="relative flex-shrink-0">
            <svg width="72" height="72" className="-rotate-90">
              <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
              <circle
                cx="36" cy="36" r={r}
                fill="none"
                className={`${ringColor} transition-all duration-500`}
                strokeWidth="6"
                strokeDasharray={circ}
                strokeDashoffset={dash}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-lg font-black ${color}`}>{score}%</span>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white mb-1">
              {score >= 90 ? "Anúncio completo" :
               score >= 60 ? "Publicável" :
               "Incompleto"}
            </p>
            {props.loadingAttrs ? (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Loader2 size={11} className="animate-spin" /> Carregando atributos...
              </div>
            ) : canPublish ? (
              <p className="text-xs text-gray-500">
                {score >= 90 ? "Todos os campos preenchidos" : `${missingOpt.length} campo${missingOpt.length !== 1 ? "s" : ""} para melhorar`}
              </p>
            ) : (
              <p className="text-xs text-red-400">
                {missingReq.length} campo{missingReq.length !== 1 ? "s" : ""} obrigatório{missingReq.length !== 1 ? "s" : ""} faltando
              </p>
            )}
          </div>
        </div>

        {/* Barra de progresso */}
        <div className="mt-4 h-1.5 bg-white/6 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>

      {/* Campos obrigatórios faltando */}
      {missingReq.length > 0 && (
        <div className="bg-dark-800 border border-red-400/20 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-red-400/10">
            <p className="text-[11px] font-bold text-red-400 uppercase tracking-wider">
              Necessários para publicar
            </p>
          </div>
          <div className="divide-y divide-white/4">
            {missingReq.map(c => (
              <div key={c.label} className="flex items-center gap-2.5 px-4 py-2.5">
                <XCircle size={13} className="text-red-400 flex-shrink-0" />
                <span className="text-xs text-gray-300">{c.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Checklist básico (campos preenchidos e faltando não-obrigatórios) */}
      <div className="bg-dark-800 border border-white/8 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/6">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Campos básicos</p>
        </div>
        <div className="divide-y divide-white/4">
          {basicChecks.map(c => (
            <div key={c.label} className="flex items-center gap-2.5 px-4 py-2.5">
              {c.ok
                ? <CheckCircle2 size={13} className="text-green-400 flex-shrink-0" />
                : c.required
                  ? <XCircle     size={13} className="text-red-400 flex-shrink-0" />
                  : <AlertCircle size={13} className="text-gray-600 flex-shrink-0" />
              }
              <span className={`text-xs ${c.ok ? "text-gray-400" : c.required ? "text-red-300" : "text-gray-500"}`}>
                {c.label}
              </span>
              {c.required && !c.ok && (
                <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-400/15 text-red-400 flex-shrink-0">
                  REQ
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Checklist qualidade */}
      <div className="bg-dark-800 border border-white/8 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/6">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Qualidade e rankeamento</p>
        </div>
        <div className="divide-y divide-white/4">
          {qualChecks.map(c => (
            <div key={c.label} className="flex items-center gap-2.5 px-4 py-2.5">
              {c.ok
                ? <CheckCircle2 size={13} className="text-green-400 flex-shrink-0" />
                : <AlertCircle  size={13} className="text-gray-600 flex-shrink-0" />
              }
              <span className={`text-xs ${c.ok ? "text-gray-400" : "text-gray-500"}`}>
                {c.label}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
