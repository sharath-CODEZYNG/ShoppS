export function getCategoryExtra(category){
  const map = {
    'Food': [
      'This item is suitable for everyday household use and emphasizes freshness and quality ingredients.',
      'It fits well into regular meal planning and daily consumption routines.'
    ],
    'Groceries': [
      'A practical grocery staple intended for routine household use, with packaging designed for safe storage and convenience.',
      'It supports dependable, everyday kitchen needs.'
    ],
    'Electronic Gadgets': [
      'A functional device built for efficient everyday use, focusing on durability and user convenience.',
      'It incorporates modern technology to support common tasks in a digital lifestyle.'
    ]
  }
  return map[category] || []
}
