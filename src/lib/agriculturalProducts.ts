/**
 * Catálogo de produtos do agronegócio da AgriLink: culturas vegetais, produtos
 * pecuários, ovos, lacticínios, mel e produtos transformados relacionados.
 */
export const AGRICULTURAL_PRODUCT_GROUPS = [
  {
    label: "Cereais e grãos",
    products: ["Milho", "Milho branco", "Milho amarelo", "Milho verde", "Arroz", "Trigo", "Massango", "Massambala", "Mexoeira", "Sorgo"],
  },
  {
    label: "Feijões, leguminosas e oleaginosas",
    products: ["Feijão manteiga", "Feijão catarino", "Feijão macunde", "Feijão-nhemba", "Feijão-frade", "Feijão vermelho", "Feijão preto", "Feijão branco", "Feijão seco", "Feijão-verde", "Soja", "Amendoim (ginguba)", "Gergelim", "Girassol", "Ervilha", "Fava"],
  },
  {
    label: "Raízes, tubérculos e derivados",
    products: ["Mandioca", "Mandioca fresca", "Mandioca seca", "Batata rena", "Batata-doce", "Inhame", "Gengibre", "Fuba de bombó", "Farinha de mandioca", "Amido de mandioca", "Goma de mandioca"],
  },
  {
    label: "Frutas tropicais e regionais",
    products: ["Banana", "Banana-pão", "Manga", "Papaia", "Ananás", "Abacate", "Maracujá", "Goiaba", "Coco", "Caju", "Pinha", "Múcua", "Maboque", "Tamarindo", "Melancia", "Melão", "Jaca", "Fruta-pão", "Maçã-de-caju"],
  },
  {
    label: "Cítricos",
    products: ["Laranja", "Limão", "Tangerina", "Toranja"],
  },
  {
    label: "Hortícolas, legumes e verduras",
    products: ["Tomate", "Cebola", "Alho", "Alface", "Couve", "Repolho", "Cenoura", "Pepino", "Abóbora", "Quiabo", "Beringela", "Pimento", "Pimento verde", "Pimento vermelho", "Jindungo", "Piri-piri", "Malagueta", "Pimenta", "Maxixe", "Espinafre", "Agrião", "Beterraba", "Nabo", "Chuchu", "Rama de mandioca", "Folhas de abóbora", "Folhas de batata-doce", "Cebolinha"],
  },
  {
    label: "Ervas e temperos",
    products: ["Salsa", "Coentro", "Hortelã", "Manjericão", "Louro", "Alho seco", "Cebola seca", "Jindungo seco"],
  },
  {
    label: "Culturas comerciais e de plantação",
    products: ["Café", "Cacau", "Cana-de-açúcar", "Algodão", "Dendém", "Óleo de palma", "Sisal", "Tabaco"],
  },
  {
    label: "Sementes e materiais vegetais para plantio",
    products: ["Sementes de milho", "Sementes de feijão", "Sementes de hortícolas", "Sementes de amendoim", "Sementes de girassol", "Sementes de gergelim", "Mudas de tomate", "Mudas de cebola", "Mudas de fruteiras", "Mudas de café", "Estacas de mandioca"],
  },
  {
    label: "Ovos e produtos avícolas",
    products: ["Ovos de galinha", "Ovos caipiras", "Ovos de codorniz", "Ovos de pata", "Ovos férteis para incubação", "Frango vivo", "Frango abatido", "Galinha viva", "Galinha caipira", "Pato vivo", "Peru", "Pintos de um dia"],
  },
  {
    label: "Leite e produtos lácteos",
    products: ["Leite de vaca fresco", "Leite de cabra", "Leite pasteurizado", "Leite em pó", "Iogurte natural", "Iogurte aromatizado", "Queijo fresco", "Queijo curado", "Manteiga", "Nata", "Requeijão"],
  },
  {
    label: "Mel e produtos apícolas",
    products: ["Mel puro", "Mel em favo", "Cera de abelha", "Própolis"],
  },
  {
    label: "Produtos transformados de origem vegetal",
    products: ["Fuba de milho", "Farinha de milho", "Farinha de trigo", "Farinha de arroz", "Farinha de massango", "Farinha de massambala", "Farinha de mexoeira", "Farinha de banana", "Farinha de batata-doce", "Amendoim torrado", "Pasta de amendoim", "Óleo de ginguba", "Óleo de girassol", "Café torrado", "Café moído", "Cacau em pó", "Polpa de fruta", "Polpa de tomate", "Fruta seca", "Banana-passa", "Sumo natural", "Açúcar", "Mandioca descascada", "Mandioca congelada", "Batata descascada", "Composto orgânico", "Estrume vegetal compostado", "Húmus de minhoca"],
  },
] as const;

export const AGRICULTURAL_PRODUCTS = AGRICULTURAL_PRODUCT_GROUPS.flatMap((group) => group.products);
