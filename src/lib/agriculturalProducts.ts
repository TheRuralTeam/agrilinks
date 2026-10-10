/**
 * Catálogo curado para pedidos da AgriLink, focado em produtos agrícolas,
 * pecuários e piscatórios conhecidos e comercializados em Angola.
 *
 * As opções evitam variedades exóticas ou produtos sem relevância local
 * identificada. O formulário aceita apenas opções deste catálogo.
 */
export const AGRICULTURAL_PRODUCT_GROUPS = [
  {
    label: "Cereais e grãos",
    products: ["Milho", "Milho branco", "Milho amarelo", "Milho verde", "Arroz", "Trigo", "Massango", "Massambala", "Mexoeira", "Sorgo"],
  },
  {
    label: "Feijões, leguminosas e oleaginosas",
    products: ["Feijão manteiga", "Feijão catarino", "Feijão macunde", "Feijão-nhemba", "Feijão-frade", "Feijão vermelho", "Feijão preto", "Feijão branco", "Feijão seco", "Soja", "Amendoim (ginguba)", "Gergelim", "Girassol", "Ervilha", "Fava"],
  },
  {
    label: "Raízes, tubérculos e derivados",
    products: ["Mandioca", "Mandioca fresca", "Mandioca seca", "Fuba de bombó", "Farinha de mandioca", "Batata rena", "Batata-doce", "Inhame", "Gengibre", "Batata"],
  },
  {
    label: "Frutas tropicais e regionais",
    products: ["Banana", "Banana-pão", "Manga", "Papaia (mamão)", "Ananás", "Abacate", "Maracujá", "Goiaba", "Coco", "Caju", "Pinha", "Múcua (fruto do embondeiro)", "Maboque", "Tamarindo", "Melancia", "Melão", "Jaca", "Fruta-pão", "Ginguba verde", "Maçã-de-caju"],
  },
  {
    label: "Cítricos",
    products: ["Laranja", "Limão", "Tangerina", "Toranja"],
  },
  {
    label: "Hortaliças, legumes e verduras",
    products: ["Tomate", "Cebola", "Alho", "Alface", "Couve", "Repolho", "Cenoura", "Pepino", "Abóbora", "Quiabo", "Beringela", "Pimento", "Pimento verde", "Pimento vermelho", "Jindungo", "Piri-piri", "Malagueta", "Pimenta", "Maxixe", "Feijão-verde", "Espinafre", "Agrião", "Beterraba", "Nabo", "Chuchu", "Rama de mandioca", "Folhas de abóbora", "Folhas de batata-doce", "Cebolinha"],
  },
  {
    label: "Ervas, temperos e aromáticas",
    products: ["Salsa", "Coentro", "Hortelã", "Manjericão", "Louro", "Alho seco", "Cebola seca", "Jindungo seco"],
  },
  {
    label: "Culturas comerciais e produtos de plantação",
    products: ["Café", "Cacau", "Cana-de-açúcar", "Algodão", "Dendém", "Palma (óleo de palma)", "Sisal", "Tabaco"],
  },
  {
    label: "Frutos secos, sementes e produtos do campo",
    products: ["Castanha de caju", "Sementes de milho", "Sementes de feijão", "Sementes de hortaliças", "Sementes de amendoim", "Moringa", "Cera de abelha"],
  },
  {
    label: "Produtos transformados do campo",
    products: ["Fuba de milho", "Farinha de milho", "Farinha de trigo", "Farinha de arroz", "Farinha de massango", "Farinha de massambala", "Farinha de mexoeira", "Amido de mandioca", "Goma de mandioca", "Amendoim torrado", "Óleo de palma", "Óleo de ginguba", "Café torrado", "Café moído", "Polpa de fruta", "Polpa de tomate", "Fruta seca", "Mel embalado"],
  },
  {
    label: "Pecuária e produtos de origem animal",
    products: ["Bovinos vivos", "Caprinos vivos", "Ovinos vivos", "Suínos vivos", "Frangos vivos", "Galinhas poedeiras", "Pintos de um dia", "Carne bovina", "Carne caprina", "Carne ovina", "Carne suína", "Frango", "Ovos", "Leite", "Queijo", "Manteiga", "Iogurte", "Mel"],
  },
  {
    label: "Pescado e aquicultura em Angola",
    products: ["Cacusso", "Bagre", "Carapau", "Sardinha", "Cachucho", "Chopa", "Corvina", "Atum", "Cavala", "Garoupa", "Peixe-serra", "Peixe seco", "Peixe fumado", "Peixe salgado", "Camarão", "Lagosta", "Caranguejo", "Tilápia"],
  },
] as const;

export const AGRICULTURAL_PRODUCTS = AGRICULTURAL_PRODUCT_GROUPS.flatMap((group) => group.products);
