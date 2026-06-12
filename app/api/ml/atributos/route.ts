import { NextRequest, NextResponse } from 'next/server'

const ML_BASE = 'https://api.mercadolibre.com'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const categoryId = searchParams.get('category_id')

  if (!categoryId) {
    return NextResponse.json({ error: 'category_id obrigatório' }, { status: 400 })
  }

  try {
    const res = await fetch(`${ML_BASE}/categories/${categoryId}/attributes`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) throw new Error(`Atributos para ${categoryId} não encontrados`)
    const data: MLAttribute[] = await res.json()

    const BLOCKLIST = new Set(["BRAND", "PART_NUMBER", "HAS_COMPATIBILITIES", "EMPTY_GTIN_REASON"])

    // Normalizar para o que o formulário precisa
    const attributes = data
      .filter((attr) => !BLOCKLIST.has(attr.id))
      .filter((attr) => !attr.tags?.hidden && !attr.tags?.read_only)
      .map((attr) => ({
        id: attr.id,
        name: attr.name,
        value_type: attr.value_type,
        required: attr.tags?.required === true,
        multivalued: attr.tags?.multivalued === true,
        values: attr.values?.map((v) => ({ id: v.id, name: v.name })) ?? [],
        hint: attr.hint ?? null,
        default_unit: attr.default_unit ?? null,
        allowed_units: attr.allowed_units?.map((u) => ({ id: u.id, name: u.name })) ?? [],
        attribute_group_id:   attr.attribute_group_id   ?? "OTHERS",
        attribute_group_name: attr.attribute_group_name ?? "Outros",
      }))

    return NextResponse.json(attributes)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

interface MLAttribute {
  id: string
  name: string
  value_type: string
  tags?: Record<string, unknown>
  values?: { id: string; name: string }[]
  hint?: string
  default_unit?: string
  allowed_units?: { id: string; name: string }[]
  attribute_group_id?: string
  attribute_group_name?: string
}
