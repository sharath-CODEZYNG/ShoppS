import { useState, useRef, useEffect } from 'react'
import { PRODUCTS } from '../services/products'

function ProductForm({ initial, onCancel, onSave, formMode = 'add' }){
  const [form, setForm] = useState(() => ({
    name: initial?.name || '',
    description: initial?.description || '',
    category: initial?.category || 'Food',
    brand: initial?.brand || '',
    price: initial?.price !== undefined ? initial.price : '',
    stock: initial?.stock !== undefined ? initial.stock : '',
    images: Array.isArray(initial?.images) ? initial.images.filter(Boolean).map(i=> typeof i === 'string' ? {name:i,url:i} : {name: i?.name || 'image', url: i?.url || ''}) : [],
    tags: Array.isArray(initial?.tags) ? initial.tags.filter(Boolean) : [],
    attributes: Array.isArray(initial?.attributes) ? initial.attributes.filter(Boolean).map(a=> ({ key: a?.key || '', value: a?.value || '' })) : []
  }))
  const [tagInput, setTagInput] = useState('')
  const [attrName, setAttrName] = useState('')
  const [attrValue, setAttrValue] = useState('')
  const fileRef = useRef()
  const createdUrls = useRef([])

  function setField(k,v){ setForm(f => ({...f, [k]: v})) }

  function onFiles(e){
    const files = Array.from(e.target.files || [])
    if(!files.length) return
    const mapped = files.map(f => {
      const url = URL.createObjectURL(f)
      createdUrls.current.push(url)
      return { name: f.name, url }
    })
    setForm(f => ({...f, images: [...f.images, ...mapped]}))
    // clear input so same file can be re-selected later
    if(fileRef.current) fileRef.current.value = ''
  }

  // cleanup created object URLs on unmount
  useEffect(()=>{
    return ()=>{
      createdUrls.current.forEach(u => {
        try{ URL.revokeObjectURL(u) }catch(err){ console.warn('Failed to revoke object URL', err) }
      })
      createdUrls.current = []
    }
  }, [])
  function removeImage(idx){
    const img = form.images[idx]
    if(img?.url && img.url.startsWith('blob:')) URL.revokeObjectURL(img.url)
    setForm(f => ({...f, images: f.images.filter((_,i)=>i!==idx)}))
  }

  // Sync form when `initial` (product to edit) or `formMode` changes.
  // This lets the same form instance be reused for Add <-> Edit and ensures
  // we never mutate the original product object passed from the parent.
  useEffect(()=>{
    try{
      if(initial && formMode === 'edit'){
        setForm({
          name: initial.name || '',
          description: initial.description || '',
          category: initial.category || 'Food',
          brand: initial.brand || '',
          price: initial.price !== undefined ? initial.price : '',
          stock: initial.stock !== undefined ? initial.stock : '',
          images: Array.isArray(initial.images) ? initial.images.filter(Boolean).map(i=> typeof i === 'string' ? {name:i,url:i} : {name: i?.name || 'image', url: i?.url || ''}) : [],
          tags: Array.isArray(initial.tags) ? initial.tags.filter(Boolean) : [],
          attributes: Array.isArray(initial.attributes) ? initial.attributes.filter(Boolean).map(a=>({key: a?.key || '', value: a?.value || ''})) : []
        })
        return
      }

      if(formMode === 'add'){
        // reset to empty add-form
        setForm({
          name: '',
          description: '',
          category: 'Food',
          brand: '',
          price: '',
          stock: '',
          images: [],
          tags: [],
          attributes: []
        })
      }
    }catch(err){
      // swallow unexpected shape errors and log for debugging — prevents app crash
      // keep form in a safe, empty state so the admin can continue working
      // eslint-disable-next-line no-console
      console.error('[ProductForm] failed to hydrate initial product for edit', err, initial)
      setForm({
        name: '', description: '', category: 'Food', brand: '', price: '', stock: '', images: [], tags: [], attributes: []
      })
    }
  }, [initial, formMode])

  function addTag(){
    if(!tagInput.trim()) return
    setForm(f => ({...f, tags: [...f.tags, tagInput.trim()]}))
    setTagInput('')
  }
  function removeTag(idx){ setForm(f => ({...f, tags: f.tags.filter((_,i)=> i!==idx)})) }

  function addAttr(){
    if(!attrName.trim() || !attrValue.trim()) return
    setForm(f=> ({...f, attributes:[...f.attributes,{key: attrName.trim(), value: attrValue.trim()}]}))
    setAttrName('')
    setAttrValue('')
  }
  function removeAttr(i){ setForm(f=> ({...f, attributes: f.attributes.filter((_,idx)=> idx!==i)})) }

  function save(){
    const out = {
      ...form,
      price: form.price === '' ? 0 : Number(form.price),
      stock: form.stock === '' ? undefined : Number(form.stock),
      images: form.images.map(i=> i.name || i)
    }
    onSave(out)
  }

  return (
    <div style={{marginBottom:12}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h4 style={{margin:0}}><span style={{marginRight:8}}>📦</span>{formMode === 'edit' ? 'Edit Product' : 'Add New Product'}</h4>
      </div>

      <div style={{marginTop:8}} className="card">
        <div className="product-form">
          <div className="field full">
            <label style={{fontSize:13,color:'#374151',marginBottom:6}}>Product Title</label>
            <div className="field-with-icon">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 6h18" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round"/><path d="M6 6v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <input placeholder="Product title" value={form.name} onChange={e=>setField('name', e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label style={{fontSize:13,color:'#374151',marginBottom:6}}>Category</label>
            <div className="field-with-icon">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 3h7v7H3V3zM14 3h7v7h-7V3zM3 14h7v7H3v-7zM14 14h7v7h-7v-7z" stroke="#6b7280" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <select value={form.category} onChange={e=>setField('category', e.target.value)}>
                <option value="Food">Food</option>
                <option value="Groceries">Groceries</option>
                <option value="Electronic Gadgets">Electronic Gadgets</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label style={{fontSize:13,color:'#374151',marginBottom:6}}>Brand</label>
            <div className="field-with-icon">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" stroke="#6b7280" strokeWidth="1.2"/></svg>
              <input placeholder="Brand" value={form.brand} onChange={e=>setField('brand', e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label style={{fontSize:13,color:'#374151',marginBottom:6}}>Price</label>
            <div className="field-with-icon">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 1v22" stroke="#6b7280" strokeWidth="1.2" strokeLinecap="round"/><path d="M17 5H9a4 4 0 10-4 4v6a4 4 0 004 4h8" stroke="#6b7280" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <input placeholder="Enter price (₹)" type="text" inputMode="decimal" value={form.price} onChange={e=>{
                const v = e.target.value.replace(/[^0-9.]/g,'')
                // allow only one dot
                const firstDot = v.indexOf('.')
                const sanitized = firstDot === -1 ? v : v.slice(0, firstDot+1) + v.slice(firstDot+1).replace(/\./g,'')
                setField('price', sanitized)
              }} />
            </div>
          </div>

          <div className="field">
            <label style={{fontSize:13,color:'#374151',marginBottom:6}}>Availability (Stock)</label>
            <div className="field-with-icon">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="7" width="18" height="13" rx="2" stroke="#6b7280" strokeWidth="1.2"/><path d="M3 10h18" stroke="#6b7280" strokeWidth="1.2" strokeLinecap="round"/></svg>
              <input placeholder="Enter available quantity" type="text" inputMode="numeric" value={form.stock} onChange={e=>{
                const v = e.target.value.replace(/\D/g,'')
                setField('stock', v)
              }} />
            </div>
          </div>

          <div className="field full">
            <label style={{fontSize:13,color:'#374151',marginBottom:6}}>Description</label>
            <textarea placeholder="Product description" value={form.description} onChange={e=>setField('description', e.target.value)} />
          </div>

          <div className="field full">
            <label style={{fontSize:13,color:'#374151',marginBottom:6}}>Images</label>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <label className="upload-btn" onClick={()=>fileRef.current?.click()}>
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3v12" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round"/><path d="M7 8l5-5 5 5" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Upload Product Images
              </label>
              <input ref={fileRef} className="upload-input" type="file" multiple accept="image/*" onChange={onFiles} />
            </div>

            <div className="preview-list">
              {form.images.map((img,idx)=> (
                <div className="preview-item" key={idx} title={img.name}>
                  <button type="button" className="img-del" onClick={()=>removeImage(idx)} aria-label={`Remove ${img.name}`} tabIndex={0}>
                    <span className="x-mark" aria-hidden="true">✕</span>
                    <svg className="x-svg" viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg" fill="none" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                  {img.url ? <img src={img.url} alt={img.name} /> : <div style={{padding:6,fontSize:12}}>{img.name}</div>}
                </div>
              ))}
            </div>
          </div>

          <div className="field full">
            <label style={{fontSize:13,color:'#374151',marginBottom:6}}>Tags</label>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <input placeholder="e.g. mobile, budget, battery" value={tagInput} onChange={e=>setTagInput(e.target.value)} />
              <button type="button" className="tag-add" onClick={addTag} title="Add Tag">
                <svg viewBox="0 0 24 24" width="14" height="14" xmlns="http://www.w3.org/2000/svg" fill="none"><path d="M12 5v14M5 12h14" stroke="#111827" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Add
              </button>
            </div>

            <div style={{marginTop:8}}>
              {form.tags.map((t,idx)=> (
                <span key={idx} className="chip">{t} <button onClick={()=>removeTag(idx)} aria-label={`Remove tag ${t}`}>✕</button></span>
              ))}
            </div>
          </div>

          <div className="field full">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <label style={{fontSize:13,color:'#374151',marginBottom:6}}>Attributes</label>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <input placeholder="Attribute Name (e.g. Battery, Storage)" value={attrName} onChange={e=>setAttrName(e.target.value)} />
                <input placeholder="Attribute Value (e.g. 6000mAh, 128GB)" value={attrValue} onChange={e=>setAttrValue(e.target.value)} />
                <button type="button" className="attr-add" onClick={addAttr} title="Add Attribute">
                  <svg viewBox="0 0 24 24" width="14" height="14" xmlns="http://www.w3.org/2000/svg" fill="none"><path d="M12 5v14M5 12h14" stroke="#111827" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Add
                </button>
              </div>
            </div>

            <div style={{marginTop:8}}>
              {form.attributes.map((a,idx)=> (
                <div key={idx} className="attribute-row">
                  <div className="attr-body"><span className="attr-key">{a.key}</span> : <span className="attr-val">{a.value}</span><button className="attr-del" onClick={()=>removeAttr(idx)} aria-label={`Remove attribute ${a.key}`}>✕</button></div>
                </div>
              ))}
            </div>
          </div>

        </div>

        <div style={{display:'flex',gap:8,marginTop:12}}>
          <button className="btn-primary" onClick={save}>{formMode === 'edit' ? 'Update Product' : 'Add Product'}</button>
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function AdminProducts(){
  const [items, setItems] = useState(PRODUCTS.map(p=>({...p})))
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [formMode, setFormMode] = useState('add')
  const [filter, setFilter] = useState('All')
  const [searchText, setSearchText] = useState('')

  function onAdd(){ setFormMode('add'); setEditing(null); setShowForm(true) }
  function onEdit(p){
    // debug: log the product being edited to help trace any shape issues that cause runtime crashes
    // eslint-disable-next-line no-console
    console.debug('[AdminProducts] onEdit', p)
    setEditing({...p}); setFormMode('edit'); setShowForm(true); window.scrollTo({top:0,behavior:'smooth'})
  }
  function onDelete(id){ setItems(items.filter(s=>s.id!==id)) }

  function onSave(data){
    if(formMode === 'edit' && editing){
      // update existing product (match by id)
      setItems(items.map(i=> i.id===editing.id ? {...i, ...data} : i))
    }else{
      const nextId = Math.max(...items.map(i=>i.id))+1
      setItems([{...data, id: nextId}, ...items])
    }
    setShowForm(false); setEditing(null); setFormMode('add')
  }

  const filteredByCategory = filter === 'All' ? items : items.filter(i=> i.category === filter)
  const filtered = searchText.trim()
    ? filteredByCategory.filter(i => (i.name || '').toLowerCase().includes(searchText.trim().toLowerCase()))
    : filteredByCategory

  return (
    <div className="admin-content">
      <div className="page-header">
        <h2 style={{margin:0}}>Products</h2>
        <div className="page-sub">Manage your product catalog</div>
      </div>

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
        <div className="filter-row" style={{display:'flex',alignItems:'center',gap:12}}>
          <label>Filter by Category</label>

          <select value={filter} onChange={e=>setFilter(e.target.value)}>
            <option>All</option>
            <option>Food</option>
            <option>Groceries</option>
            <option>Electronic Gadgets</option>
          </select>

          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div className="search-input-wrap">
              <input
                className="search-input"
                placeholder="Search products..."
                value={searchText}
                onChange={e=>setSearchText(e.target.value)}
                onKeyDown={e => { if(e.key === 'Escape') setSearchText('') }}
                aria-label="Search products by name"
              />

              {searchText ? (
                <button
                  type="button"
                  className="search-clear"
                  title="Clear search"
                  aria-label="Clear search"
                  onClick={() => setSearchText('')}
                >
                  ←
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div>
          <button className="btn-primary" onClick={onAdd}>Add Product</button>
        </div>
      </div>

      {showForm && (
        <div style={{marginTop:12}}>
          <ProductForm initial={editing} formMode={formMode} onCancel={()=>{setShowForm(false); setEditing(null); setFormMode('add')}} onSave={onSave} />
        </div>
      )}

      <div style={{marginTop:16}} className="card">
        <table className="table">
          <thead>
            <tr><th>Product Name</th><th>Category</th><th>Brand</th><th>Price</th><th>Availability</th><th style={{textAlign:'right'}}>Actions</th></tr>
          </thead>
          <tbody>
            {filtered.map(it=> (
              <tr key={it.id}>
                <td>{it.name}</td>
                <td>{it.category}</td>
                <td>{it.brand}</td>
                <td>₹{it.price}</td>
                <td>{it.stock !== undefined ? it.stock : (it.availability || 'In stock')}</td>
                <td style={{textAlign:'right'}}>
                  <div className="actions" style={{justifyContent:'flex-end'}}>
                    <button className="btn-edit" onClick={()=>onEdit(it)}>Edit</button>
                    <button className="btn-delete" onClick={()=>onDelete(it.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
