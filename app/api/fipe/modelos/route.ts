import { NextRequest, NextResponse } from 'next/server'

const FIPE = 'https://parallelum.com.br/fipe/api/v1'

export async function GET(req: NextRequest) {
  const marcaCodigo = new URL(req.url).searchParams.get('marca')
  if (!marcaCodigo) return NextResponse.json({ error: 'marca obrigatória' }, { status: 400 })

  try {
    const res = await fetch(`${FIPE}/carros/marcas/${marcaCodigo}/modelos`, {
      next: { revalidate: 86400 },
    })
    if (!res.ok) throw new Error('Falha ao buscar modelos')
    const data: { modelos: { codigo: number; nome: string }[] } = await res.json()
    return NextResponse.json(data.modelos)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
