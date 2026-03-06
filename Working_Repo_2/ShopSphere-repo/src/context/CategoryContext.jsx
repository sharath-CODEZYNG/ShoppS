import { createContext, useContext, useState } from 'react'

const CategoryContext = createContext(null)

export function CategoryProvider({ children }){
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  return (
    <CategoryContext.Provider value={{ selectedCategory, setSelectedCategory, searchQuery, setSearchQuery }}>
      {children}
    </CategoryContext.Provider>
  )
}

export function useCategory(){
  return useContext(CategoryContext)
}

export default CategoryContext
