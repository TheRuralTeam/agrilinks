/**
 * Catálogo de pesquisa de produtos agrícolas, pecuários, florestais e aquícolas.
 * É uma lista inicial extensa, adaptada ao contexto angolano, não uma lista fechada:
 * a interface também aceita nomes que ainda não estejam no catálogo.
 */
export const AGRICULTURAL_PRODUCT_GROUPS = [
  {
    label: "Cereais e grãos",
    products: ["Milho", "Arroz", "Trigo", "Sorgo", "Massango", "Mexoeira", "Milheto", "Cevada", "Aveia", "Centeio", "Teff", "Quinoa", "Triticale", "Milho branco", "Milho amarelo", "Milho para pipocas"],
  },
  {
    label: "Leguminosas e feijões",
    products: ["Feijão manteiga", "Feijão catarino", "Feijão vermelho", "Feijão preto", "Feijão branco", "Feijão-frade", "Feijão macunde", "Feijão bóer", "Feijão mungo", "Feijão-nhemba", "Ervilha", "Grão-de-bico", "Lentilha", "Fava", "Soja", "Amendoim", "Tremoço", "Guandu"],
  },
  {
    label: "Raízes, tubérculos e rizomas",
    products: ["Mandioca", "Farinha de mandioca", "Fuba de bombó", "Batata rena", "Batata-doce", "Batata-doce de polpa alaranjada", "Inhame", "Inhame-da-costa", "Cará", "Taro", "Cocoyam", "Gengibre", "Curcuma", "Rábano", "Rabanete", "Beterraba", "Cenoura", "Nabo", "Açafrão-da-terra"],
  },
  {
    label: "Frutas tropicais",
    products: ["Banana", "Banana-pão", "Banana-da-terra", "Manga", "Papaia", "Mamão", "Ananás", "Abacaxi", "Abacate", "Maracujá", "Goiaba", "Coco", "Caju", "Maçã-de-caju", "Jaca", "Fruta-pão", "Pinha", "Anona", "Graviola", "Maboque", "Múcua", "Tamarindo", "Litchi", "Lichia", "Pitanga", "Jambo", "Sapoti", "Dióspiro", "Romã", "Carambola", "Fruta-do-conde", "Melancia", "Melão", "Melão cantalupo", "Melão amarelo", "Morango", "Uva", "Figo", "Tâmara", "Pera", "Maçã", "Pêssego", "Ameixa", "Damasco", "Kiwi", "Pera-abacate", "Framboesa", "Amora", "Mirtilo", "Cacau", "Café-cereja"],
  },
  {
    label: "Cítricos",
    products: ["Laranja", "Limão", "Lima", "Tangerina", "Mandarina", "Toranja", "Pomelo", "Cidra", "Clementina"],
  },
  {
    label: "Hortaliças, folhas e verduras",
    products: ["Alface", "Couve", "Couve-galega", "Couve-flor", "Brócolos", "Repolho", "Couve-roxa", "Espinafre", "Amaranthus", "Feijão-verde", "Quiabo", "Tomate", "Tomate-cereja", "Pepino", "Abóbora", "Abóbora-menina", "Abobrinha", "Curgete", "Beringela", "Pimento verde", "Pimento vermelho", "Pimento amarelo", "Pimenta", "Malagueta", "Cebola", "Cebola roxa", "Alho", "Alho-francês", "Cebolinha", "Alho-poró", "Espargo", "Aipo", "Salsa", "Coentro", "Agrião", "Rúcula", "Mostarda de folha", "Acelga", "Jindungo", "Beldroega", "Folhas de mandioca", "Folhas de abóbora", "Folhas de feijão", "Folhas de batata-doce", "Cogumelos", "Cogumelo ostra", "Cogumelo shiitake", "Milho verde", "Chuchu", "Maxixe", "Melão amargo", "Cabaça", "Pepino africano"],
  },
  {
    label: "Oleaginosas e culturas industriais",
    products: ["Girassol", "Gergelim", "Sésamo", "Amendoim para óleo", "Soja para óleo", "Colza", "Canola", "Palma", "Dendém", "Óleo de palma bruto", "Algodão", "Cana-de-açúcar", "Beterraba sacarina", "Tabaco", "Sisal", "Juta", "Rícino", "Linhaça", "Cártamo", "Cacau em amêndoa", "Café verde", "Café torrado", "Chá", "Borracha natural"],
  },
  {
    label: "Especiarias, ervas e aromáticas",
    products: ["Pimenta-preta", "Pimenta-branca", "Piri-piri", "Jindungo seco", "Páprica", "Baunilha", "Canela", "Cravinho", "Noz-moscada", "Cardamomo", "Cominho", "Coentro em grão", "Anis", "Erva-doce", "Orégãos", "Tomilho", "Alecrim", "Hortelã", "Manjericão", "Louro", "Capim-limão", "Erva-cidreira", "Cúrcuma", "Gengibre seco", "Alho seco", "Cebola seca"],
  },
  {
    label: "Frutos secos, sementes e castanhas",
    products: ["Castanha de caju", "Amêndoa", "Noz", "Avelã", "Pistácio", "Castanha", "Macadâmia", "Noz-pecã", "Sementes de abóbora", "Sementes de girassol", "Sementes de gergelim", "Sementes de chia", "Sementes de linhaça", "Sementes de melancia", "Sementes de hortaliças", "Sementes de cereais", "Sementes de leguminosas", "Sementes para plantio", "Moringa", "Alfarroba"],
  },
  {
    label: "Produtos pecuários e animais vivos",
    products: ["Bovinos vivos", "Vacas leiteiras", "Gado para engorda", "Bezerros", "Caprinos vivos", "Cabritos", "Ovinos vivos", "Borregos", "Suínos vivos", "Leitões", "Frangos vivos", "Frangas poedeiras", "Pintos de um dia", "Patos vivos", "Perus vivos", "Codornizes vivas", "Coelhos vivos", "Abelhas", "Colmeias", "Peixes vivos para criação", "Alevinos", "Ração animal", "Feno", "Palha", "Silagem", "Forragem verde", "Farelo de milho", "Farelo de trigo", "Bagaço de cana", "Casca de soja"],
  },
  {
    label: "Carnes e produtos de origem animal",
    products: ["Carne bovina", "Carne de vitela", "Carne suína", "Carne caprina", "Carne ovina", "Frango", "Galinha", "Pato", "Peru", "Codorniz", "Coelho", "Miudezas bovinas", "Miudezas de frango", "Carne congelada", "Carne refrigerada", "Carne fumada", "Enchidos", "Ovos de galinha", "Ovos de codorniz", "Leite cru", "Leite fresco", "Leite em pó", "Natas", "Manteiga", "Queijo", "Iogurte", "Requeijão", "Mel", "Cera de abelha", "Própolis"],
  },
  {
    label: "Pescado e aquicultura",
    products: ["Peixe fresco", "Peixe congelado", "Peixe seco", "Peixe fumado", "Peixe salgado", "Tilápia", "Cacusso", "Bagre", "Corvina", "Cachucho", "Sardinha", "Carapau", "Atum", "Cavala", "Pescada", "Garoupa", "Cherne", "Salmão", "Robalo", "Dourada", "Sável", "Peixe-gato", "Camarão", "Lagosta", "Caranguejo", "Lula", "Polvo", "Choco", "Mexilhão", "Ostra", "Amêijoa", "Conchas", "Rãs de aquicultura", "Algas comestíveis"],
  },
  {
    label: "Produtos transformados do campo",
    products: ["Fuba de milho", "Fuba de bombó", "Farinha de trigo", "Farinha de arroz", "Farinha de mandioca", "Farinha de batata-doce", "Farinha de soja", "Farinha de banana", "Farinha de sorgo", "Farinha de massango", "Farinha de mexoeira", "Amido de mandioca", "Goma de mandioca", "Milho seco", "Feijão seco", "Arroz descascado", "Arroz integral", "Amendoim torrado", "Pasta de amendoim", "Castanha de caju processada", "Polpa de fruta", "Fruta desidratada", "Banana-passa", "Sumo natural", "Polpa de tomate", "Tomate seco", "Legumes congelados", "Legumes desidratados", "Óleo vegetal", "Açúcar", "Mel embalado", "Café moído", "Cacau em pó", "Mandioca descascada", "Mandioca congelada", "Batata descascada", "Batata pré-frita", "Ração produzida localmente", "Composto orgânico", "Estrume curtido", "Húmus de minhoca"],
  },
] as const;

export const AGRICULTURAL_PRODUCTS = AGRICULTURAL_PRODUCT_GROUPS.flatMap((group) => group.products);
