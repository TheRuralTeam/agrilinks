export interface Municipality {
  id: string;
  name: string;
}

export interface Province {
  id: string;
  name: string;
  municipalities: Municipality[];
}

export const angolaProvinces: Province[] = [
  {
    id: "bengo",
    name: "Bengo",
    municipalities: [
      { id: "ambriz", name: "Ambriz" },
      { id: "barra-dande", name: "Barra do Dande" },
      { id: "bula-atumba", name: "Bula-Atumba" },
      { id: "dande", name: "Dande" },
      { id: "muxaluando", name: "Muxaluando" },
      { id: "nambuangongo", name: "Nambuangongo" },
      { id: "panguila", name: "Panguila" },
      { id: "pango-aluquem", name: "Pango Aluquém" },
      { id: "piri", name: "Piri" },
      { id: "quibaxe", name: "Quibaxe" },
      { id: "quicunzo", name: "Quicunzo" },
      { id: "ucua", name: "Úcua" }
    ]
  },
  {
    id: "benguela",
    name: "Benguela",
    municipalities: [
      { id: "balombo", name: "Balombo" },
      { id: "baia-farta", name: "Baía Farta" },
      { id: "benguela-city", name: "Benguela" },
      { id: "bocoio", name: "Bocoio" },
      { id: "caimbambo", name: "Caimbambo" },
      { id: "catumbela", name: "Catumbela" },
      { id: "chongoroi", name: "Chongorói" },
      { id: "cubal", name: "Cubal" },
      { id: "ganda", name: "Ganda" },
      { id: "lobito", name: "Lobito" }
    ]
  },
  {
    id: "bie",
    name: "Bié",
    municipalities: [
      { id: "andulo", name: "Andulo" },
      { id: "camacupa", name: "Camacupa" },
      { id: "catabola", name: "Catabola" },
      { id: "chinguar", name: "Chinguar" },
      { id: "chitembo", name: "Chitembo" },
      { id: "cuemba", name: "Cuemba" },
      { id: "cuito", name: "Cuíto" },
      { id: "cunhinga", name: "Cunhinga" },
      { id: "nharea", name: "Nharea" }
    ]
  },
  {
    id: "cabinda",
    name: "Cabinda",
    municipalities: [
      { id: "cabinda-city", name: "Cabinda" },
      { id: "belize", name: "Belize" },
      { id: "buco-zau", name: "Buco-Zau" },
      { id: "cacongo", name: "Cacongo" }
    ]
  },
  {
    id: "cubango",
    name: "Cubango",
    municipalities: [
      { id: "menongue", name: "Menongue" },
      { id: "calai", name: "Calai" },
      { id: "cuangar", name: "Cuangar" },
      { id: "cuchi", name: "Cuchi" },
      { id: "cuito-cuanavale", name: "Cuito Cuanavale" },
      { id: "dirico", name: "Dirico" },
      { id: "mavinga", name: "Mavinga" },
      { id: "nancova", name: "Nancova" },
      { id: "rivungo", name: "Rivungo" }
    ]
  },
  {
    id: "cuanza-norte",
    name: "Cuanza Norte",
    municipalities: [
      { id: "ndalatando", name: "Ndalatando" },
      { id: "ambaca", name: "Ambaca" },
      { id: "banga", name: "Banga" },
      { id: "bolongongo", name: "Bolongongo" },
      { id: "cambambe", name: "Cambambe" },
      { id: "cazengo", name: "Cazengo" },
      { id: "golungo-alto", name: "Golungo Alto" },
      { id: "gonguembo", name: "Gonguembo" },
      { id: "lucala", name: "Lucala" },
      { id: "quiculungo", name: "Quiculungo" },
      { id: "samba-caju", name: "Samba Caju" }
    ]
  },
  {
    id: "cuanza-sul",
    name: "Cuanza Sul",
    municipalities: [
      { id: "sumbe", name: "Sumbe" },
      { id: "amboim", name: "Amboim" },
      { id: "cassongue", name: "Cassongue" },
      { id: "cela", name: "Cela" },
      { id: "conda", name: "Conda" },
      { id: "ebo", name: "Ebo" },
      { id: "libolo", name: "Libolo" },
      { id: "mussende", name: "Mussende" },
      { id: "porto-amboim", name: "Porto Amboim" },
      { id: "quibala", name: "Quibala" },
      { id: "quilenda", name: "Quilenda" },
      { id: "seles", name: "Seles" }
    ]
  },
  {
    id: "cunene",
    name: "Cunene",
    municipalities: [
      { id: "ondijiva", name: "Ondijiva" },
      { id: "cahama", name: "Cahama" },
      { id: "cuanhama", name: "Cuanhama" },
      { id: "curoca", name: "Curoca" },
      { id: "cuvelai", name: "Cuvelai" },
      { id: "namacunde", name: "Namacunde" },
      { id: "ombadja", name: "Ombadja" }
    ]
  },
  {
    id: "huambo",
    name: "Huambo",
    municipalities: [
      { id: "huambo-city", name: "Huambo" },
      { id: "bailundo", name: "Bailundo" },
      { id: "caala", name: "Caála" },
      { id: "cachiungo", name: "Cachiungo" },
      { id: "chicala-choloanga", name: "Chicala-Choloanga" },
      { id: "ecunha", name: "Ecunha" },
      { id: "londuimbali", name: "Londuimbali" },
      { id: "longonjo", name: "Longonjo" },
      { id: "mungo", name: "Mungo" },
      { id: "chinjenje", name: "Chinjenje" },
      { id: "ucuma", name: "Ucuma" }
    ]
  },
  {
    id: "huila",
    name: "Huíla",
    municipalities: [
      { id: "lubango", name: "Lubango" },
      { id: "caconda", name: "Caconda" },
      { id: "caluquembe", name: "Caluquembe" },
      { id: "chiange", name: "Chiange" },
      { id: "chibia", name: "Chibia" },
      { id: "chicomba", name: "Chicomba" },
      { id: "chipindo", name: "Chipindo" },
      { id: "cuvango", name: "Cuvango" },
      { id: "humpata", name: "Humpata" },
      { id: "jamba", name: "Jamba" },
      { id: "matala", name: "Matala" },
      { id: "quilengues", name: "Quilengues" },
      { id: "quipungo", name: "Quipungo" }
    ]
  },
  {
    id: "icolo-bengo",
    name: "Ícolo e Bengo",
    municipalities: [
      { id: "bom-jesus", name: "Bom Jesus" },
      { id: "cabiri", name: "Cabiri" },
      { id: "cabo-ledo", name: "Cabo Ledo" },
      { id: "calumbo", name: "Calumbo" },
      { id: "catete", name: "Catete" },
      { id: "quissama", name: "Quissama" },
      { id: "sequele", name: "Sequele" }
    ]
  },
  {
    id: "luanda",
    name: "Luanda",
    municipalities: [
      { id: "luanda-city", name: "Luanda" },
      { id: "belas", name: "Belas" },
      { id: "cacuaco", name: "Cacuaco" },
      { id: "cazenga", name: "Cazenga" },
      { id: "quilamba-quiaxi", name: "Quilamba-Quiaxi" },
      { id: "talatona", name: "Talatona" },
      { id: "viana", name: "Viana" }
    ]
  },
  {
    id: "lunda-norte",
    name: "Lunda Norte",
    municipalities: [
      { id: "dundo", name: "Dundo" },
      { id: "cambulo", name: "Cambulo" },
      { id: "capenda-camulemba", name: "Capenda-Camulemba" },
      { id: "caungula", name: "Caungula" },
      { id: "chitato", name: "Chitato" },
      { id: "cuango", name: "Cuango" },
      { id: "cuilo", name: "Cuílo" },
      { id: "lovua", name: "Lóvua" },
      { id: "lubalo", name: "Lubalo" },
      { id: "lucapa", name: "Lucapa" },
      { id: "xa-muteba", name: "Xá-Muteba" }
    ]
  },
  {
    id: "lunda-sul",
    name: "Lunda Sul",
    municipalities: [
      { id: "saurimo", name: "Saurimo" },
      { id: "cacolo", name: "Cacolo" },
      { id: "dala", name: "Dala" },
      { id: "muconda", name: "Muconda" }
    ]
  },
  {
    id: "malanje",
    name: "Malanje",
    municipalities: [
      { id: "malanje-city", name: "Malanje" },
      { id: "cacuso", name: "Cacuso" },
      { id: "calandula", name: "Calandula" },
      { id: "cambundi-catembo", name: "Cambundi-Catembo" },
      { id: "cangandala", name: "Cangandala" },
      { id: "caombo", name: "Caombo" },
      { id: "cuaba-nzoji", name: "Cuaba-Nzoji" },
      { id: "cunda-dia-baze", name: "Cunda-Dia-Baze" },
      { id: "luquembo", name: "Luquembo" },
      { id: "marimba", name: "Marimba" },
      { id: "massango", name: "Massango" },
      { id: "mucari", name: "Mucari" },
      { id: "quela", name: "Quela" },
      { id: "quirima", name: "Quirima" }
    ]
  },
  {
    id: "moxico",
    name: "Moxico",
    municipalities: [
      { id: "luena", name: "Luena" },
      { id: "alto-zambeze", name: "Alto Zambeze" },
      { id: "bundas", name: "Bundas" },
      { id: "camanongue", name: "Camanongue" },
      { id: "leua", name: "Léua" },
      { id: "luau", name: "Luau" },
      { id: "luacano", name: "Luacano" },
      { id: "luchazes", name: "Luchazes" },
      { id: "caiunda", name: "Caiunda" }
    ]
  },
  {
    id: "namibe",
    name: "Namibe",
    municipalities: [
      { id: "mocamedes", name: "Moçâmedes" },
      { id: "bibala", name: "Bibala" },
      { id: "camucuio", name: "Camucuio" },
      { id: "tombua", name: "Tômbua" },
      { id: "virei", name: "Virei" }
    ]
  },
  {
    id: "uige",
    name: "Uíge",
    municipalities: [
      { id: "uige-city", name: "Uíge" },
      { id: "ambuila", name: "Ambuíla" },
      { id: "bembe", name: "Bembe" },
      { id: "buengas", name: "Buengas" },
      { id: "bungo", name: "Bungo" },
      { id: "damba", name: "Damba" },
      { id: "milunga", name: "Milunga" },
      { id: "mucaba", name: "Mucaba" },
      { id: "negage", name: "Negage" },
      { id: "puri", name: "Puri" },
      { id: "quimbele", name: "Quimbele" },
      { id: "quitexe", name: "Quitexe" },
      { id: "sanza-pombo", name: "Sanza Pombo" },
      { id: "songo", name: "Songo" }
    ]
  },
  {
    id: "zaire",
    name: "Zaire",
    municipalities: [
      { id: "mbanza-congo", name: "Mbanza Congo" },
      { id: "soio", name: "Soio" },
      { id: "nzeto", name: "Nzeto" },
      { id: "noqui", name: "Nóqui" },
      { id: "tomboco", name: "Tomboco" }
    ]
  }
];