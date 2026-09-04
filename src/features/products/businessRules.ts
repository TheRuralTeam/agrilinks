export type ProductSubmissionInput = {
  product_type: string
  quantity: number
  harvest_date: string
  price: number
  province_id: string
  municipality_id: string
  logistics_access: 'sim' | 'nao' | 'parcial'
  photos?: string[]
  category?: string
}

export type ProductForOrder = {
  id: string
  status: string
  quantity: number
  user_id: string
  price: number
}

export type PreOrderInput = {
  product: ProductForOrder
  buyer_id: string
  quantity: number
  location?: string
}

export const validateProductSubmission = (input: ProductSubmissionInput) => {
  const errors: string[] = []

  if (!input.product_type || input.product_type.trim().length < 2) {
    errors.push('Nome do produto é obrigatório.')
  }

  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    errors.push('Quantidade deve ser maior que zero.')
  }

  if (!Number.isFinite(input.price) || input.price <= 0) {
    errors.push('Preço deve ser maior que zero.')
  }

  if (!input.province_id || !input.municipality_id) {
    errors.push('Província e município são obrigatórios.')
  }

  if (!['sim', 'nao', 'parcial'].includes(input.logistics_access)) {
    errors.push('Acesso logístico inválido.')
  }

  if (!Array.isArray(input.photos) || input.photos.length < 3) {
    errors.push('É obrigatório adicionar pelo menos 3 imagens do produto.')
  }

  if (!input.category || input.category.trim().length < 2) {
    errors.push('Categoria do produto é obrigatória.')
  }

  const harvestDate = new Date(input.harvest_date)
  const minimumDate = new Date()
  minimumDate.setDate(minimumDate.getDate() + 30)

  if (Number.isNaN(harvestDate.getTime()) || harvestDate < minimumDate) {
    errors.push('A data de colheita deve estar pelo menos 30 dias no futuro.')
  }

  if (errors.length > 0) {
    throw new Error(errors.join(' '))
  }

  return { valid: true }
}

export const validatePreOrderSubmission = ({
  product,
  buyer_id,
  quantity,
  location,
}: PreOrderInput) => {
  if (!product || product.status !== 'active') {
    throw new Error('Produto não disponível para compra.')
  }

  if (!buyer_id || buyer_id === product.user_id) {
    throw new Error('Não pode comprar o seu próprio produto.')
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('Quantidade da compra deve ser maior que zero.')
  }

  if (quantity > product.quantity) {
    throw new Error('Quantidade solicitada é maior que o stock disponível.')
  }

  if (!location || location.trim().length < 3) {
    throw new Error('Local de entrega é obrigatório.')
  }

  if (!Number.isFinite(product.price) || product.price <= 0) {
    throw new Error('Preço do produto inválido.')
  }

  return {
    valid: true,
    total_price: quantity * product.price,
  }
}
