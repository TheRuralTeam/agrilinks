/**
 * Produtos agrícolas usados no formulário de sourcing.
 * Lista limitada a culturas e produtos vegetais cultivados/comercializados em Angola.
 * Não incluir pescado, carne, aves ou produtos inventados.
 */
export const SOURCING_AGRICULTURAL_PRODUCTS = [
  'Abacate',
  'Abacaxi (ananás)',
  'Abóbora',
  'Alface',
  'Alho',
  'Amendoim (ginguba)',
  'Arroz',
  'Banana',
  'Batata-doce',
  'Batata rena',
  'Beringela',
  'Cacau',
  'Café',
  'Caju (castanha de caju)',
  'Cana-de-açúcar',
  'Coco',
  'Cebola',
  'Cenoura',
  'Couve',
  'Ervilha',
  'Feijão',
  'Gengibre',
  'Gergelim',
  'Girassol',
  'Gindungo (piri-piri)',
  'Goiaba',
  'Laranja',
  'Limão',
  'Mandioca',
  'Mamão',
  'Manga',
  'Maracujá',
  'Massango',
  'Massambala',
  'Melancia',
  'Milho',
  'Pepino',
  'Pimento',
  'Quiabo',
  'Repolho',
  'Soja',
  'Sorgo',
  'Tangerina',
  'Trigo',
  'Tomate',
] as const

export const SOURCING_UNITS = [
  { value: 'kg', label: 'Quilogramas (kg)' },
  { value: 'tonelada', label: 'Toneladas (t)' },
  { value: 'saco', label: 'Sacos' },
  { value: 'caixa', label: 'Caixas' },
  { value: 'unidade', label: 'Unidades' },
] as const

export function getSourcingLocationLabel(
  provinceId?: string | null,
  municipalityId?: string | null,
  detail?: string | null,
): string {
  const parts = [provinceId, municipalityId, detail]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
  return parts.join(' · ')
}
