export interface Municipality {
  id: string;
  name: string;
}

export interface Province {
  id: string;
  name: string;
  municipalities: Municipality[];
}

export interface CountryLocations {
  [countryCode: string]: Province[];
}

// Angola provinces (atualizado 2025 com novas províncias)
const angolaProvinces: Province[] = [
  {
    id: "cabinda", name: "Cabinda",
    municipalities: [
      { id: "cabinda", name: "Cabinda" },
      { id: "cacongo", name: "Cacongo" },
      { id: "buco-zau", name: "Buco Zau" },
      { id: "belize", name: "Belize" },
      { id: "miconje", name: "Miconje" },
      { id: "massabi", name: "Massabi" },
      { id: "necuto", name: "Necuto" },
      { id: "tando-zinze", name: "Tando Zinze" },
      { id: "liambo", name: "Liambo" },
      { id: "ngoio", name: "Ngoio" }
    ]
  },
  {
    id: "zaire", name: "Zaire",
    municipalities: [
      { id: "soyo", name: "Soyo" },
      { id: "mbanza-kongo", name: "Mbanza Kongo" },
      { id: "nzeto", name: "Nzeto" },
      { id: "tomboco", name: "Tomboco" },
      { id: "cuimba", name: "Cuimba" },
      { id: "noqui", name: "Nóqui" },
      { id: "luvo", name: "Luvo" },
      { id: "lufico", name: "Lufico" },
      { id: "quelo", name: "Quêlo" },
      { id: "serra-de-canda", name: "Serra de Canda" },
      { id: "quindeje", name: "Quindeje" }
    ]
  },
  {
    id: "uige", name: "Uíge",
    municipalities: [
      { id: "dange-quitexe", name: "Dange Quitexe" },
      { id: "bungo", name: "Bungo" },
      { id: "ambuila", name: "Ambuíla" },
      { id: "negage", name: "Negage" },
      { id: "puri", name: "Puri" },
      { id: "maquela-do-zombo", name: "Maquela do Zombo" },
      { id: "damba", name: "Damba" },
      { id: "sanza-pombo", name: "Sanza Pombo" },
      { id: "bembe", name: "Bembe" },
      { id: "milunga", name: "Milunga" },
      { id: "songo", name: "Songo" },
      { id: "quimbele", name: "Quimbele" },
      { id: "cangola", name: "Cangola" },
      { id: "uige", name: "Uíge" },
      { id: "mucaba", name: "Mucaba" },
      { id: "nova-esperanca", name: "Nova Esperança" },
      { id: "sacandica", name: "Sacandica" },
      { id: "nsosso", name: "Nsosso" },
      { id: "lucunga", name: "Lucunga" },
      { id: "quipedro", name: "Quipedro" },
      { id: "massau", name: "Massau" },
      { id: "vista-alegre", name: "Vista Alegre" },
      { id: "alto-zaza", name: "Alto Zaza" }
    ]
  },
  {
    id: "bengo", name: "Bengo",
    municipalities: [
      { id: "dande", name: "Dande" },
      { id: "quibaxe", name: "Quibaxe" },
      { id: "muxaluando", name: "Muxaluando" },
      { id: "bula-atumba", name: "Bula Atumba" },
      { id: "ambriz", name: "Ambriz" },
      { id: "pango-aluquem", name: "Pango Aluquém" },
      { id: "barra-do-dande", name: "Barra do Dande" },
      { id: "piri", name: "Piri" },
      { id: "quicunzo", name: "Quicunzo" },
      { id: "nambuangongo", name: "Nambuangongo" },
      { id: "ucua", name: "Úcua" },
      { id: "panguila", name: "Panguila" }
    ]
  },
  {
    id: "luanda", name: "Luanda",
    municipalities: [
      { id: "ingombota", name: "Ingombota" },
      { id: "cacuaco", name: "Cacuaco" },
      { id: "cazenga", name: "Cazenga" },
      { id: "viana", name: "Viana" },
      { id: "belas", name: "Belas" },
      { id: "kilamba-kiaxi", name: "Kilamba Kiaxi" },
      { id: "talatona", name: "Talatona" },
      { id: "mussulo", name: "Mussulo" },
      { id: "sambizanga", name: "Sambizanga" },
      { id: "rangel", name: "Rangel" },
      { id: "maianga", name: "Maianga" },
      { id: "samba", name: "Samba" },
      { id: "camama", name: "Camama" },
      { id: "mulenvos", name: "Mulenvos" },
      { id: "kilamba", name: "Kilamba" },
      { id: "hoji-ya-henda", name: "Hoji ya Henda" }
    ]
  },
  {
    id: "icolo-e-bengo", name: "Icolo e Bengo",
    municipalities: [
      { id: "catete", name: "Catete" },
      { id: "quicama", name: "Quiçama" },
      { id: "calumbo", name: "Calumbo" },
      { id: "cabiri", name: "Cabiri" },
      { id: "cabo-ledo", name: "Cabo Ledo" },
      { id: "bom-jesus", name: "Bom Jesus" },
      { id: "sequele", name: "Sequele" }
    ]
  },
  {
    id: "cuanza-norte", name: "Cuanza-Norte",
    municipalities: [
      { id: "cazengo", name: "Cazengo" },
      { id: "golungo-alto", name: "Golungo Alto" },
      { id: "cambambe", name: "Cambambe" },
      { id: "samba-caju", name: "Samba Caju" },
      { id: "ambaca", name: "Ambaca" },
      { id: "lucala", name: "Lucala" },
      { id: "banga", name: "Banga" },
      { id: "bolongongo", name: "Bolongongo" },
      { id: "quiculungo", name: "Quiculungo" },
      { id: "ngonguembo", name: "Ngonguembo" },
      { id: "massangano", name: "Massangano" },
      { id: "cerca", name: "Cêrca" },
      { id: "tango", name: "Tango" },
      { id: "terreiro", name: "Terreiro" },
      { id: "aldeia-nova", name: "Aldeia Nova" },
      { id: "caculo-cabaca", name: "Caculo Cabaça" },
      { id: "luinga", name: "Luinga" }
    ]
  },
  {
    id: "cuanza-sul", name: "Cuanza-Sul",
    municipalities: [
      { id: "sumbe", name: "Sumbe" },
      { id: "calulo", name: "Calulo" },
      { id: "gabela", name: "Gabela" },
      { id: "cassongue", name: "Cassongue" },
      { id: "porto-amboim", name: "Porto Amboím" },
      { id: "quibala", name: "Quibala" },
      { id: "seles", name: "Seles" },
      { id: "waku-kungo", name: "Waku Kungo" },
      { id: "mussende", name: "Mussende" },
      { id: "quilenda", name: "Quilenda" },
      { id: "ebo", name: "Ebo" },
      { id: "conda", name: "Conda" },
      { id: "quirimbo", name: "Quirimbo" },
      { id: "munenga", name: "Munenga" },
      { id: "quissongo", name: "Quissongo" },
      { id: "gungo", name: "Gungo" },
      { id: "sanga", name: "Sanga" },
      { id: "gangula", name: "Gangula" },
      { id: "pambangala", name: "Pambangala" },
      { id: "conde", name: "Condé" },
      { id: "amboiva", name: "Amboiva" },
      { id: "lonhe", name: "Lonhe" },
      { id: "quenha", name: "Quenha" },
      { id: "boa-entrada", name: "Boa Entrada" }
    ]
  },
  {
    id: "malanje", name: "Malanje",
    municipalities: [
      { id: "calandula", name: "Calandula" },
      { id: "malanje", name: "Malanje" },
      { id: "cacuso", name: "Cacuso" },
      { id: "massango", name: "Massango" },
      { id: "marimba", name: "Marimba" },
      { id: "quela", name: "Quela" },
      { id: "quirima", name: "Quirima" },
      { id: "cangandala", name: "Cangandala" },
      { id: "cahombo", name: "Cahombo" },
      { id: "kunda-dya-baze", name: "Kunda dya Baze" },
      { id: "cambundi-catembo", name: "Cambundi Catembo" },
      { id: "caculama", name: "Caculama" },
      { id: "kiwaba-nzoji", name: "Kiwaba Nzoji" },
      { id: "luquembo", name: "Luquembo" },
      { id: "cateco-cangola", name: "Cateco Cangola" },
      { id: "mbanji-ya-ngola", name: "Mbanji ya Ngola" },
      { id: "cuale", name: "Cuale" },
      { id: "pungu-a-ndongo", name: "Pungu a Ndongo" },
      { id: "ngola-luiji", name: "Ngola Luiji" },
      { id: "quihuhu", name: "Quihuhu" },
      { id: "xandel", name: "Xandel" },
      { id: "cambo-suinginge", name: "Cambo Suinginge" },
      { id: "milando", name: "Milando" },
      { id: "quitapa", name: "Quitapa" },
      { id: "capunda", name: "Capunda" },
      { id: "muquixe", name: "Muquixe" },
      { id: "quessua", name: "Quêssua" }
    ]
  },
  {
    id: "lunda-norte", name: "Lunda-Norte",
    municipalities: [
      { id: "cuilo", name: "Cuilo" },
      { id: "dundo", name: "Dundo" },
      { id: "lubalo", name: "Lubalo" },
      { id: "capenda-camulemba", name: "Capenda Camulemba" },
      { id: "cuango", name: "Cuango" },
      { id: "lucapa", name: "Lucapa" },
      { id: "cambulo", name: "Cambulo" },
      { id: "xa-muteba", name: "Xá Muteba" },
      { id: "caungula", name: "Caungula" },
      { id: "lovua", name: "Lóvua" },
      { id: "chitato", name: "Chitato" },
      { id: "xa-cassau", name: "Xá Cassau" },
      { id: "camaxilo", name: "Camaxilo" },
      { id: "luangue", name: "Luangue" },
      { id: "luremo", name: "Luremo" },
      { id: "canzar", name: "Canzar" },
      { id: "cassanje-calucala", name: "Cassanje Calucala" },
      { id: "mussungue", name: "Mussungue" },
      { id: "cafunfo", name: "Cafunfo" }
    ]
  },
  {
    id: "lunda-sul", name: "Lunda-Sul",
    municipalities: [
      { id: "saurimo", name: "Saurimo" },
      { id: "muconda", name: "Muconda" },
      { id: "cacolo", name: "Cacolo" },
      { id: "dala", name: "Dala" },
      { id: "chiluage", name: "Chiluage" },
      { id: "cassai-sul", name: "Cassai-Sul" },
      { id: "xassengue", name: "Xassengue" },
      { id: "alto-chicapa", name: "Alto Chicapa" },
      { id: "sombo", name: "Sombo" },
      { id: "muriege", name: "Muriege" },
      { id: "luma-cassai", name: "Luma Cassai" },
      { id: "cazage", name: "Cazage" },
      { id: "muangueji", name: "Muangueji" },
      { id: "cassengo", name: "Cassengo" }
    ]
  },
  {
    id: "moxico", name: "Moxico",
    municipalities: [
      { id: "luena", name: "Luena" },
      { id: "cangamba", name: "Cangamba" },
      { id: "lumbala-nguimbo", name: "Lumbala Nguimbo" },
      { id: "camanongue", name: "Camanongue" },
      { id: "leua", name: "Léua" },
      { id: "lutembo", name: "Lutembo" },
      { id: "lucusse", name: "Lucusse" },
      { id: "cangumbe", name: "Cangumbe" },
      { id: "chiume", name: "Chiúme" },
      { id: "alto-cuito", name: "Alto Cuito" },
      { id: "ninda", name: "Ninda" },
      { id: "lutuai", name: "Lutuai" }
    ]
  },
  {
    id: "moxico-leste", name: "Moxico Leste",
    municipalities: [
      { id: "cazombo", name: "Cazombo" },
      { id: "luacano", name: "Luacano" },
      { id: "cameia", name: "Cameia" },
      { id: "luau", name: "Luau" },
      { id: "nana-candundo", name: "Nana Candundo" },
      { id: "macondo", name: "Macondo" },
      { id: "caianda", name: "Caianda" },
      { id: "lovua-do-zambeze", name: "Lóvua do Zambeze" },
      { id: "lago-dilolo", name: "Lago Dilolo" }
    ]
  },
  {
    id: "bie", name: "Bié",
    municipalities: [
      { id: "andulo", name: "Andulo" },
      { id: "chitembo", name: "Chitembo" },
      { id: "cuito", name: "Cuito" },
      { id: "camacupa", name: "Camacupa" },
      { id: "chinguar", name: "Chinguar" },
      { id: "catabola", name: "Catabola" },
      { id: "cunhinga", name: "Cunhinga" },
      { id: "cuemba", name: "Cuemba" },
      { id: "nharea", name: "Nharêa" },
      { id: "luando", name: "Luando" },
      { id: "ringoma", name: "Ringoma" },
      { id: "mumbue", name: "Mumbué" },
      { id: "calucinga", name: "Calucinga" },
      { id: "chicala", name: "Chicala" },
      { id: "chipeta", name: "Chipeta" },
      { id: "umpulo", name: "Umpulo" },
      { id: "lubia", name: "Lúbia" },
      { id: "cambandua", name: "Cambândua" },
      { id: "belo-horizonte", name: "Belo Horizonte" }
    ]
  },
  {
    id: "huambo", name: "Huambo",
    municipalities: [
      { id: "bailundo", name: "Bailundo" },
      { id: "huambo", name: "Huambo" },
      { id: "londuimbali", name: "Londuimbali" },
      { id: "caala", name: "Caála" },
      { id: "chicala-choloanga", name: "Chicala Choloanga" },
      { id: "cachiungo", name: "Cachiungo" },
      { id: "mungo", name: "Mungo" },
      { id: "longonjo", name: "Longonjo" },
      { id: "ucuma", name: "Ucuma" },
      { id: "ecunha", name: "Ecunha" },
      { id: "chinjenje", name: "Chinjenje" },
      { id: "bimbe", name: "Bimbe" },
      { id: "sambo", name: "Sambo" },
      { id: "galanga", name: "Galanga" },
      { id: "alto-hama", name: "Alto Hama" },
      { id: "chilata", name: "Chilata" },
      { id: "cuima", name: "Cuima" }
    ]
  },
  {
    id: "benguela", name: "Benguela",
    municipalities: [
      { id: "benguela", name: "Benguela" },
      { id: "ganda", name: "Ganda" },
      { id: "lobito", name: "Lobito" },
      { id: "catumbela", name: "Catumbela" },
      { id: "bocoio", name: "Bocoio" },
      { id: "balombo", name: "Balombo" },
      { id: "cubal", name: "Cubal" },
      { id: "baia-farta", name: "Baía Farta" },
      { id: "caimbambo", name: "Caimbambo" },
      { id: "chongoroi", name: "Chongorói" },
      { id: "egito-praia", name: "Egito Praia" },
      { id: "chindumbo", name: "Chindumbo" },
      { id: "dombe-grande", name: "Dombe Grande" },
      { id: "capupa", name: "Capupa" },
      { id: "biopio", name: "Biópio" },
      { id: "chila", name: "Chila" },
      { id: "chicuma", name: "Chicuma" },
      { id: "babaera", name: "Babaera" },
      { id: "iambala", name: "Iambala" },
      { id: "catengue", name: "Catengue" },
      { id: "bolonguera", name: "Bolonguera" },
      { id: "canhamela", name: "Canhamela" },
      { id: "navegantes", name: "Navegantes" }
    ]
  },
  {
    id: "namibe", name: "Namibe",
    municipalities: [
      { id: "mocamedes", name: "Moçâmedes" },
      { id: "tombwa", name: "Tômbwa" },
      { id: "bibala", name: "Bibala" },
      { id: "virei", name: "Virei" },
      { id: "camucuio", name: "Camucuio" },
      { id: "lucira", name: "Lucira" },
      { id: "iona", name: "Iona" },
      { id: "sacomar", name: "Sacomar" },
      { id: "cacimbas", name: "Cacimbas" }
    ]
  },
  {
    id: "huila", name: "Huíla",
    municipalities: [
      { id: "caconda", name: "Caconda" },
      { id: "gambos", name: "Gambos" },
      { id: "humpata", name: "Humpata" },
      { id: "lubango", name: "Lubango" },
      { id: "cuvango", name: "Cuvango" },
      { id: "quipungo", name: "Quipungo" },
      { id: "chibia", name: "Chibia" },
      { id: "quilengues", name: "Quilengues" },
      { id: "caluquembe", name: "Caluquembe" },
      { id: "matala", name: "Matala" },
      { id: "jamba-mineira", name: "Jamba Mineira" },
      { id: "chipindo", name: "Chipindo" },
      { id: "chicomba", name: "Chicomba" },
      { id: "cacula", name: "Cacula" },
      { id: "dongo", name: "Dongo" },
      { id: "hoque", name: "Hoque" },
      { id: "capelongo", name: "Capelongo" },
      { id: "chituto", name: "Chituto" },
      { id: "capunda-cavilongo", name: "Capunda Cavilongo" },
      { id: "viti-vivali", name: "Viti Vivali" },
      { id: "galangue", name: "Galangue" },
      { id: "palanca", name: "Palanca" },
      { id: "chicungo", name: "Chicungo" }
    ]
  },
  {
    id: "cunene", name: "Cunene",
    municipalities: [
      { id: "ombadja", name: "Ombadja" },
      { id: "cuanhama", name: "Cuanhama" },
      { id: "curoca", name: "Curoca" },
      { id: "cahama", name: "Cahama" },
      { id: "cuvelai", name: "Cuvelai" },
      { id: "namacunde", name: "Namacunde" },
      { id: "chiede", name: "Chiéde" },
      { id: "nehone", name: "Nehone" },
      { id: "humbe", name: "Humbe" },
      { id: "mupa", name: "Mupa" },
      { id: "naulila", name: "Naulila" },
      { id: "chitado", name: "Chitado" },
      { id: "cafima", name: "Cafima" },
      { id: "chissuata", name: "Chissuata" }
    ]
  },
  {
    id: "cubango", name: "Cubango",
    municipalities: [
      { id: "menongue", name: "Menongue" },
      { id: "cuchi", name: "Cuchi" },
      { id: "calai", name: "Calai" },
      { id: "nancova", name: "Nancova" },
      { id: "cuangar", name: "Cuangar" },
      { id: "savate", name: "Savate" },
      { id: "caiundo", name: "Caiundo" },
      { id: "longa", name: "Longa" },
      { id: "cutato", name: "Cutato" },
      { id: "chinguanja", name: "Chinguanja" },
      { id: "mavengue", name: "Mavengue" }
    ]
  },
  {
    id: "cuando", name: "Cuando",
    municipalities: [
      { id: "cuito-cuanavale", name: "Cuito Cuanavale" },
      { id: "dirico", name: "Dirico" },
      { id: "mavinga", name: "Mavinga" },
      { id: "rivungo", name: "Rivungo" },
      { id: "xipundo", name: "Xipundo" },
      { id: "dima", name: "Dima" },
      { id: "luiana", name: "Luiana" },
      { id: "mucusso", name: "Mucusso" },
      { id: "luengue", name: "Luengue" }
    ]
  }
];

// DR Congo provinces
const congoProvinces: Province[] = [
  {
    id: "kinshasa", name: "Kinshasa",
    municipalities: [
      { id: "gombe", name: "Gombe" },
      { id: "lingwala", name: "Lingwala" },
      { id: "barumbu", name: "Barumbu" },
      { id: "kinshasa-city", name: "Kinshasa" }
    ]
  },
  {
    id: "kongo-central", name: "Kongo Central",
    municipalities: [
      { id: "matadi", name: "Matadi" },
      { id: "boma", name: "Boma" },
      { id: "muanda", name: "Muanda" }
    ]
  },
  {
    id: "katanga", name: "Haut-Katanga",
    municipalities: [
      { id: "lubumbashi", name: "Lubumbashi" },
      { id: "likasi", name: "Likasi" },
      { id: "kolwezi", name: "Kolwezi" }
    ]
  },
  {
    id: "nord-kivu", name: "Nord-Kivu",
    municipalities: [
      { id: "goma", name: "Goma" },
      { id: "butembo", name: "Butembo" },
      { id: "beni", name: "Beni" }
    ]
  },
  {
    id: "sud-kivu", name: "Sud-Kivu",
    municipalities: [
      { id: "bukavu", name: "Bukavu" },
      { id: "uvira", name: "Uvira" }
    ]
  },
  {
    id: "kasai", name: "Kasaï",
    municipalities: [
      { id: "tshikapa", name: "Tshikapa" },
      { id: "kananga", name: "Kananga" }
    ]
  },
  {
    id: "equateur", name: "Équateur",
    municipalities: [
      { id: "mbandaka", name: "Mbandaka" },
      { id: "gemena", name: "Gemena" }
    ]
  }
];

// South Africa provinces
const southAfricaProvinces: Province[] = [
  {
    id: "gauteng", name: "Gauteng",
    municipalities: [
      { id: "johannesburg", name: "Johannesburg" },
      { id: "pretoria", name: "Pretoria" },
      { id: "soweto", name: "Soweto" },
      { id: "sandton", name: "Sandton" }
    ]
  },
  {
    id: "western-cape", name: "Western Cape",
    municipalities: [
      { id: "cape-town", name: "Cape Town" },
      { id: "stellenbosch", name: "Stellenbosch" },
      { id: "paarl", name: "Paarl" }
    ]
  },
  {
    id: "kwazulu-natal", name: "KwaZulu-Natal",
    municipalities: [
      { id: "durban", name: "Durban" },
      { id: "pietermaritzburg", name: "Pietermaritzburg" },
      { id: "richards-bay", name: "Richards Bay" }
    ]
  },
  {
    id: "eastern-cape", name: "Eastern Cape",
    municipalities: [
      { id: "port-elizabeth", name: "Port Elizabeth" },
      { id: "east-london", name: "East London" }
    ]
  },
  {
    id: "limpopo", name: "Limpopo",
    municipalities: [
      { id: "polokwane", name: "Polokwane" },
      { id: "tzaneen", name: "Tzaneen" }
    ]
  },
  {
    id: "mpumalanga", name: "Mpumalanga",
    municipalities: [
      { id: "nelspruit", name: "Nelspruit" },
      { id: "witbank", name: "Witbank" }
    ]
  },
  {
    id: "free-state", name: "Free State",
    municipalities: [
      { id: "bloemfontein", name: "Bloemfontein" },
      { id: "welkom", name: "Welkom" }
    ]
  },
  {
    id: "north-west", name: "North West",
    municipalities: [
      { id: "rustenburg", name: "Rustenburg" },
      { id: "klerksdorp", name: "Klerksdorp" }
    ]
  },
  {
    id: "northern-cape", name: "Northern Cape",
    municipalities: [
      { id: "kimberley", name: "Kimberley" },
      { id: "upington", name: "Upington" }
    ]
  }
];

// UK regions/counties
const ukProvinces: Province[] = [
  {
    id: "london", name: "London",
    municipalities: [
      { id: "central-london", name: "Central London" },
      { id: "westminster", name: "Westminster" },
      { id: "camden", name: "Camden" },
      { id: "greenwich", name: "Greenwich" }
    ]
  },
  {
    id: "south-east", name: "South East",
    municipalities: [
      { id: "brighton", name: "Brighton" },
      { id: "oxford", name: "Oxford" },
      { id: "reading", name: "Reading" }
    ]
  },
  {
    id: "north-west", name: "North West",
    municipalities: [
      { id: "manchester", name: "Manchester" },
      { id: "liverpool", name: "Liverpool" },
      { id: "preston", name: "Preston" }
    ]
  },
  {
    id: "west-midlands", name: "West Midlands",
    municipalities: [
      { id: "birmingham", name: "Birmingham" },
      { id: "coventry", name: "Coventry" }
    ]
  },
  {
    id: "yorkshire", name: "Yorkshire",
    municipalities: [
      { id: "leeds", name: "Leeds" },
      { id: "sheffield", name: "Sheffield" },
      { id: "york", name: "York" }
    ]
  },
  {
    id: "scotland", name: "Scotland",
    municipalities: [
      { id: "edinburgh", name: "Edinburgh" },
      { id: "glasgow", name: "Glasgow" },
      { id: "aberdeen", name: "Aberdeen" }
    ]
  },
  {
    id: "wales", name: "Wales",
    municipalities: [
      { id: "cardiff", name: "Cardiff" },
      { id: "swansea", name: "Swansea" }
    ]
  },
  {
    id: "northern-ireland", name: "Northern Ireland",
    municipalities: [
      { id: "belfast", name: "Belfast" },
      { id: "derry", name: "Derry" }
    ]
  }
];

// Angola deve permanecer com as 21 províncias da divisão político-administrativa vigente.
export const ANGOLA_PROVINCE_COUNT = 21;
export const ANGOLA_PROVINCE_IDS = [
  "cabinda", "zaire", "uige", "bengo", "luanda", "icolo-e-bengo",
  "cuanza-norte", "cuanza-sul", "malanje", "lunda-norte", "lunda-sul",
  "moxico", "moxico-leste", "bie", "huambo", "benguela", "namibe",
  "huila", "cunene", "cubango", "cuando"
] as const;

if (angolaProvinces.length !== ANGOLA_PROVINCE_COUNT ||
    ANGOLA_PROVINCE_IDS.some((id) => !angolaProvinces.some((province) => province.id === id))) {
  throw new Error("A base de localização de Angola deve conter exatamente as 21 províncias atuais.");
}

export const countryLocations: CountryLocations = {
  AO: angolaProvinces,
  CD: congoProvinces,
  ZA: southAfricaProvinces,
  GB: ukProvinces
};

export const getProvincesForCountry = (countryCode: string): Province[] => {
  return countryLocations[countryCode] || [];
};

export const getProvinceLabel = (countryCode: string): string => {
  const labels: { [key: string]: string } = {
    AO: 'Província',
    CD: 'Province',
    ZA: 'Province',
    GB: 'Region'
  };
  return labels[countryCode] || 'Province';
};

export const getMunicipalityLabel = (countryCode: string): string => {
  const labels: { [key: string]: string } = {
    AO: 'Município',
    CD: 'Commune',
    ZA: 'City',
    GB: 'City'
  };
  return labels[countryCode] || 'City';
};
