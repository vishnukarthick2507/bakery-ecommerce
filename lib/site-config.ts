export const siteConfig = {
  name: 'Bluebell Bakehouse',
  tagline: 'Freshly Baked Happiness',
  description:
    'Cakes, breads, pastries and custom celebration cakes baked fresh every morning. Order online for pickup or delivery.',
  whatsappNumber: '919876543210',
  phoneDisplay: '+91 98765 43210',
  email: 'hello@bluebellbakehouse.in',
  address: {
    line1: '24, 12th Main Road, Indiranagar',
    city: 'Bengaluru',
    pincode: '560038',
  },
  mapQuery: 'Indiranagar 12th Main Road Bengaluru',
  openingHours: [
    { days: 'Monday – Friday', hours: '7:00 AM – 9:00 PM' },
    { days: 'Saturday', hours: '7:00 AM – 10:00 PM' },
    { days: 'Sunday', hours: '8:00 AM – 8:00 PM' },
  ],
  deliveryFee: 49,
  freeDeliveryAbove: 999,
  timeSlots: [
    '9:00 AM – 11:00 AM',
    '11:00 AM – 1:00 PM',
    '1:00 PM – 3:00 PM',
    '3:00 PM – 5:00 PM',
    '5:00 PM – 7:00 PM',
    '7:00 PM – 9:00 PM',
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
