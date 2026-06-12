import { NextRequest, NextResponse } from 'next/server'

const FIPE = 'https://parallelum.com.br/fipe/api/v1'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const marcaCodigo  = searchParams.get('marca')
  const modeloCodigo = searchParams.get('modelo')
  if (!marcaCodigo || !modeloCodigo)
    return NextResponse.json({ error: 'marca e modelo obrigatórios' }, { status: 400 })

  try {
    const res = await fetch(
      `${FIPE}/carros/marcas/${marcaCodigo}/modelos/${modeloCodigo}/anos`,
      { next: { revalidate: 86400 } }
    )
    if (!res.ok) throw new Error('Falha ao buscar anos')
    const data: { codigo: string; nome: string }[] = await res.json()
    // Extrai só o ano (ex: "2013 Diesel" → "2013", "2013-3" → "2013")
    const anos = data.map((a) => ({
      codigo: a.codigo,
      nome: a.nome.replace(/\s*(Gasolina|Diesel|Flex|Elétrico|Híbrido).*/i, '').trim(),
    }))
    return NextResponse.json(anos)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
