import { NextRequest, NextResponse } from 'next/server'

const ML_BASE = 'https://api.mercadolibre.com'

// Categorias raiz relevantes para o negócio automotivo
// (o ML bloqueia /sites/MLB/categories em servidores — usamos lista estática)
const ROOT_CATEGORIES = [
  { id: 'MLB1747',  name: 'Aces. de Carros e Caminhonetes' },
  { id: 'MLB1771',  name: 'Aces. de Motos e Quadriciclos' },
  { id: 'MLB22693', name: 'Peças de Carros e Caminhonetes' },
  { id: 'MLB243551',name: 'Peças de Motos e Quadriciclos' },
  { id: 'MLB2238',  name: 'Pneus e Acessórios' },
  { id: 'MLB255788',name: 'Rodas' },
  { id: 'MLB3381',  name: 'Som Automotivo' },
  { id: 'MLB2227',  name: 'Ferramentas para Veículos' },
  { id: 'MLB188063',name: 'Limpeza Automotiva' },
  { id: 'MLB456046',name: 'Peças Náuticas' },
  { id: 'MLB260634',name: 'Performance' },
  { id: 'MLB2239',  name: 'Segurança Veicular' },
  { id: 'MLB1776',  name: 'Tuning' },
  { id: 'MLB5802',  name: 'Outros Acessórios Veiculares' },
]

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const categoryId = searchParams.get('id')

  try {
    if (!categoryId) {
      return NextResponse.json(ROOT_CATEGORIES)
    }

    // Retorna detalhes + filhos de uma categoria específica
    const res = await fetch(`${ML_BASE}/categories/${categoryId}`, { next: { revalidate: 3600 } })
    if (!res.ok) throw new Error(`Categoria ${categoryId} não encontrada`)
    const data = await res.json()

    const children = Array.isArray(data.children_categories) ? data.children_categories : []

    return NextResponse.json({
      id: data.id,
      name: data.name,
      path_from_root: data.path_from_root ?? [],
      children_categories: children,
      attribute_types: data.attribute_types,
      is_leaf: children.length === 0,
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
