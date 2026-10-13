import type { jsPDF } from 'jspdf';
import agrilinkLogo from '../assets/agrilink-logo.png';

/**
 * Adds the official AgriLink logo asset to a jsPDF document.
 * The logo is loaded from the bundled local asset, not recreated as text.
 */
export async function addOfficialAgriLinkLogo(
  doc: jsPDF,
  x: number,
  y: number,
  width = 25,
  height = 17,
): Promise<void> {
  const response = await fetch(agrilinkLogo);
  if (!response.ok) {
    throw new Error('Não foi possível carregar o logótipo oficial da AgriLink.');
  }

  const blob = await response.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Não foi possível preparar o logótipo oficial para o PDF.'));
    };
    reader.onerror = () => reject(new Error('Não foi possível ler o logótipo oficial da AgriLink.'));
    reader.readAsDataURL(blob);
  });

  doc.addImage(dataUrl, 'PNG', x, y, width, height);
}
