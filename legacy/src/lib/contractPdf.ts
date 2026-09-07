export interface ContractPdfData {
  id?: string
  seller?: string | null
  buyer?: string | null
  product?: string | null
  quantity?: number | null
  price?: number | null
  delivery_terms?: string | null
}

export function generateContractPdf(c: ContractPdfData) {
  // Backup copy of previous client-side PDF generator
  console.log('generateContractPdf (legacy) called with', c)
}
