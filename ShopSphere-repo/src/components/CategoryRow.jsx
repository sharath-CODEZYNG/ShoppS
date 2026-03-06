import { useCategory } from '../context/CategoryContext'

const CATS = [
  { id: 'food', name: 'Food' },
  { id: 'groceries', name: 'Groceries' },
  { id: 'electronics', name: 'Electronic Gadgets' },
  { id: 'all', name: 'All Categories' },
]

export default function CategoryRow(){
  const { selectedCategory, setSelectedCategory } = useCategory()

  return (
    <section className="categories card">
      <div className="categories-inner">
        {CATS.map(c => {
          const val = c.id === 'all' ? 'All' : c.name
          const active = selectedCategory === val
          return (
            <div key={c.id} className={`category ${active ? 'active' : ''}`} onClick={() => setSelectedCategory(val)}>
              <div className="cat-icon">{c.name.charAt(0)}</div>
              <div className="cat-name">{c.name}</div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
