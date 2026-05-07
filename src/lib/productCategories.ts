import {
  faAppleWhole, faCarrot, faSeedling, faWheatAwn, faLemon,
  faPepperHot, faFish, faDrumstickBite, faEgg, faBreadSlice,
  faCheese, faMugHot, faLayerGroup,
} from '@fortawesome/free-solid-svg-icons'

export const PRODUCT_CATEGORIES = [
  { id: 'frutas',  label: 'Frutas',     icon: faAppleWhole,    color: '#E63946' },
  { id: 'citrus',  label: 'Cítricos',   icon: faLemon,         color: '#F4A100' },
  { id: 'legumes', label: 'Legumes',    icon: faCarrot,        color: '#E07A12' },
  { id: 'verduras',label: 'Verduras',   icon: faSeedling,      color: '#3D9A48' },
  { id: 'cereais', label: 'Cereais',    icon: faWheatAwn,      color: '#B07D0A' },
  { id: 'tempero', label: 'Temperos',   icon: faPepperHot,     color: '#C53030' },
  { id: 'pescado', label: 'Pescado',    icon: faFish,          color: '#2563B0' },
  { id: 'carnes',  label: 'Carnes',     icon: faDrumstickBite, color: '#8B2E2E' },
  { id: 'ovos',    label: 'Ovos',       icon: faEgg,           color: '#D4A24C' },
  { id: 'paes',    label: 'Pães',       icon: faBreadSlice,    color: '#A0522D' },
  { id: 'lacteos', label: 'Lácteos',    icon: faCheese,        color: '#E5A020' },
  { id: 'bebidas', label: 'Bebidas',    icon: faMugHot,        color: '#5C3317' },
] as const

export const ALL_CATEGORY = { id: 'all', label: 'Todos', icon: faLayerGroup, color: '#1A5C24' } as const
