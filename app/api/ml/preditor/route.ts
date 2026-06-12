import { NextRequest, NextResponse } from 'next/server'
import { getMarcaUser } from '@/lib/marca-auth'
import { getValidToken } from '@/lib/ml-auth'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get('q')
  if (!q?.trim()) return NextResponse.json([], )

  try {
    const ctx = await getMarcaUser()
    if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const token = await getValidToken(ctx.marcaSlug)

    const res = await fetch(
      `https://api.mercadolibre.com/sites/MLB/category_predictor/predict?q=${encodeURIComponent(q)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    if (!res.ok) return NextResponse.json([])

    const data = await res.json()

    // ML retorna um objeto com a melhor categoria + waterfall de sugestões
    // Normalizamos para array de sugestões ordenadas por confiança
    const suggestions = []

    if (data.id) {
      suggestions.push({
        id:         data.id,
        name:       data.name,
        path:       (data.path_from_root ?? []).map((p: { name: string }) => p.name),
        confidence: data.prediction_probability ?? 1,
      })
    }

    if (Array.isArray(data.waterfall)) {
      for (const item of data.waterfall) {
        if (item.id && item.id !== data.id) {
          suggestions.push({
            id:         item.id,
            name:       item.name,
            path:       (item.path_from_root ?? []).map((p: { name: string }) => p.name),
            confidence: item.prediction_probability ?? 0,
          })
        }
      }
    }

    return NextResponse.json(suggestions)
  } catch {
    return NextResponse.json([])
  }
}
