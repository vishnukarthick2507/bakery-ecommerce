import type { Offer, Testimonial } from './types'

/*
|--------------------------------------------------------------------------
| Static marketing content only.
|
| Products and orders must NEVER live here — the shopping flow is backed
| exclusively by MongoDB through the Express API.
|--------------------------------------------------------------------------
*/

export const offers: Offer[] = [
  {
    code: 'FRESH10',
    title: '10% off your order',
    description: 'On orders above ₹499. Valid on all products.',
    discountType: 'percent',
    value: 10,
    minOrder: 499,
  },
  {
    code: 'CAKE150',
    title: '₹150 off on cakes',
    description: 'Flat discount on orders above ₹1,200.',
    discountType: 'flat',
    value: 150,
    minOrder: 1200,
  },
  {
    code: 'FREEDEL',
    title: 'Free delivery',
    description: 'No delivery charge on any order — free within our delivery area.',
    discountType: 'free-delivery',
    value: 0,
    minOrder: 0,
  },
]

export const testimonials: Testimonial[] = [
  {
    id: 't1',
    name: 'Priya Venkatesh',
    location: 'Chromepet',
    rating: 5,
    comment:
      'They made our daughter’s unicorn cake exactly as we described. It tasted as good as it looked, and the team kept us updated on WhatsApp.',
  },
  {
    id: 't2',
    name: 'Rahul Iyer',
    location: 'Pallavaram',
    rating: 5,
    comment:
      'Their sourdough is the real deal. I order every Friday and pick it up warm on Saturday morning.',
  },
  {
    id: 't3',
    name: 'Fatima Sheikh',
    location: 'Tambaram',
    rating: 4,
    comment:
      'Lovely eggless options that do not compromise on taste. Delivery slots are convenient for office orders.',
  },
]
