import { NextResponse } from 'next/server'

const FIPE = 'https://parallelum.com.br/fipe/api/v1'

export async function GET() {
  try {
    const res = await fetch(`${FIPE}/carros/marcas`, { next: { revalidate: 86400 } })
    if (!res.ok) throw new Error('Falha ao buscar marcas')
    const data: { codigo: string; nome: string }[] = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
