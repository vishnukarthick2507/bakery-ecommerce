import type { Category, CategorySlug } from '@/lib/types'

export const categoryOptions: Array<{ value: CategorySlug; label: string }> = [
  { value: 'cakes', label: 'Cakes' },
  { value: 'brownies', label: 'Brownies' },
  { value: 'cheesecakes', label: 'Cheesecakes' },
  { value: 'pastries', label: 'Pastries' },
  { value: 'breads', label: 'Breads' },
  { value: 'cookies', label: 'Cookies' },
  { value: 'cupcakes', label: 'Cupcakes' },
  { value: 'savouries', label: 'Savouries' },
]

export const categoryLabels = categoryOptions.map(
  (option) => option.label,
)

export const categoryTiles: Category[] = [
  {
    slug: 'cakes',
    name: 'Cakes',
    description: 'Layered, frosted and celebration-ready',
    image: '/images/products/chocolate-truffle-cake.png',
  },
  {
    slug: 'brownies',
    name: 'Brownies',
    description: 'Fudgy, rich and baked fresh',
    image: '/images/products/chocolate-truffle-cake.png',
  },
  {
    slug: 'cheesecakes',
    name: 'Cheesecakes',
    description: 'Creamy bakes with a buttery base',
    image: '/images/products/blueberry-cheesecake.png',
  },
  {
    slug: 'pastries',
    name: 'Pastries',
    description: 'Laminated, flaky and buttery',
    image: '/images/products/butter-croissant.png',
  },
  {
    slug: 'breads',
    name: 'Breads',
    description: 'Slow-fermented loaves baked daily',
    image: '/images/products/sourdough-loaf.png',
  },
  {
    slug: 'cookies',
    name: 'Cookies',
    description: 'Crisp edges, soft centres',
    image: '/images/products/choco-chip-cookies.png',
  },
  {
    slug: 'cupcakes',
    name: 'Cupcakes',
    description: 'Single-serve treats for any day',
    image: '/images/products/vanilla-cupcakes.png',
  },
  {
    slug: 'savouries',
    name: 'Savouries',
    description: 'Puffs and bakes for tea time',
    image: '/images/products/veg-puff.png',
  },
]
