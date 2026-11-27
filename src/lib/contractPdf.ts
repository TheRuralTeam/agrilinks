// Wrapper para preservar a API pública `generateContractPdf`.
// Reexporta a cópia de segurança em `legacy` para manter o comportamento atual
// enquanto fazemos a migração/validação.
export { generateContractPdf } from "../../legacy/src/lib/contractPdf";

export type ContractPdfData = import("../../legacy/src/lib/contractPdf").ContractPdfData;
