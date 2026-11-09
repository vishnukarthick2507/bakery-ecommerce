export const siteConfig = {
  name: 'Bluebell Bakehouse',
  tagline: 'Artisan bakery & patisserie',
  description:
    'Handcrafted sourdough, viennoiserie, celebration cakes and pastries baked fresh every day. Premium bakery delivery and pickup in Chennai.',
  whatsappNumber: '919840916058',
  phoneDisplay: '+91 98409 16058',
  address: {
    line1: 'X42V+XP4, Radha Nagar, Lakshmi Nagar',
    city: 'Chromepet, Tambaram, Chennai, Tamil Nadu',
    pincode: '600044',
  },
  mapQuery: 'Bluebell Bakehouse, X42V+XP4, Radha Nagar, Lakshmi Nagar, Chromepet, Tambaram, Tamil Nadu 600044',
  openingHours: [
    { days: 'Monday – Friday', hours: '7:00 AM – 9:00 PM' },
    { days: 'Saturday', hours: '7:00 AM – 10:00 PM' },
    { days: 'Sunday', hours: '8:00 AM – 8:00 PM' },
  ],
} as const

export function whatsappLink(message: string) {
  return `https://wa.me/${siteConfig.whatsappNumber}?text=${encodeURIComponent(message)}`
}

export const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/products', label: 'Shop' },
  { href: '/custom-cake', label: 'Custom Cakes' },
  { href: '/track', label: 'Track Order' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
] as const
