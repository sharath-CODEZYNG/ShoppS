# Image Upload - Complete Code Flow Reference

## 1. Frontend Image Selection

### AdminProducts.jsx - ProductForm Component

```javascript
// User clicks "Upload Product Images"
function onFiles(e){
  const files = Array.from(e.target.files || [])
  if(!files.length) return
  
  // Convert each file to a blob: URL for preview
  const mapped = files.map(f => {
    const url = URL.createObjectURL(f)  // blob:http://...
    return { name: f.name, url }
  })
  
  setForm(f => ({...f, images: [...f.images, ...mapped]}))
}

// In JSX:
<input type="file" multiple accept="image/*" onChange={onFiles} />
```

## 2. Form Submission - Add Product

### AdminProducts.jsx - onSave() for CREATE

```javascript
// Check if user selected new files (blob URLs = new selection)
const newFiles = (data.images || []).filter(i => 
  i && i.url && i.url.startsWith && i.url.startsWith('blob:')
)

if (newFiles.length > 0) {
  // Build FormData with all fields
  const formData = new FormData()
  formData.append('name', data.name)
  formData.append('category', data.category)
  // ... append all fields ...
  
  // Attach files by fetching blobs
  for (let i = 0; i < Math.min(3, newFiles.length); i++) {
    const f = newFiles[i]
    const response = await fetch(f.url)    // Fetch blob object
    const blob = await response.blob()
    formData.append('images', blob, f.name) // Append as File
  }
  
  // Send FormData - DO NOT SET Content-Type header
  // Browser will auto-set: multipart/form-data; boundary=...
  const axios = (await import('axios')).default
  const apiRes = await axios.post(`${API_URL}/products`, formData)
  res = apiRes.data
} else {
  // No images: send JSON instead
  res = await createProduct({ name, category, ... })
}
```

## 3. Form Submission - Edit Product

### AdminProducts.jsx - onSave() for UPDATE

```javascript
// Detect newly selected files (blob URLs)
const newFilesForEdit = (data.images || []).filter(i => 
  i && i.url && i.url.startsWith && i.url.startsWith('blob:')
)

if (newFilesForEdit.length > 0) {
  // User selected new images: send FormData to REPLACE images
  const formData = new FormData()
  formData.append('name', data.name)
  // ... append all fields ...
  
  for (let i = 0; i < Math.min(3, newFilesForEdit.length); i++) {
    const f = newFilesForEdit[i]
    const response = await fetch(f.url)
    const blob = await response.blob()
    formData.append('images', blob, f.name)
  }
  
  // Send FormData - browser auto-sets boundary
  const axios = (await import('axios')).default
  const apiRes = await axios.put(`${API_URL}/products/${editing.id}`, formData)
  res = apiRes.data
} else {
  // No new images: send JSON fields only
  // Backend will preserve existing images
  res = await updateProduct(editing.id, {
    name, category, brand, price, availability, description, ...
  })
}
```

## 4. Backend Route Handler

### backend/routes/productRoutes.js

```javascript
import upload from '../config/multer.js'

// POST - Create product with optional image files
router.post('/', upload.array('images', 3), createProduct)

// PUT - Update product with optional image files
router.put('/:id', upload.array('images', 3), updateProduct)

// multer.array('images', 3) → extracts up to 3 files from field name 'images'
// Populates req.files = [{ filename, originalname, mimetype, ... }, ...]
// If no files: req.files = [] (empty array, NOT undefined)
```

## 5. Multer Configuration

### backend/config/multer.js

```javascript
import multer from 'multer'
import path from 'path'

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/')  // Save to /uploads/ folder
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now()
    const ext = path.extname(file.originalname)
    const name = path.basename(file.originalname, ext)
    // Example: 1707469200000-photo.jpg
    cb(null, `${timestamp}-${name}${ext}`)
  }
})

const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Only image files are allowed'), false)
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB max
})

export default upload
```

## 6. Backend Controller - Create

### backend/controllers/productController.js - createProduct()

```javascript
export async function createProduct(req, res) {
  const { name, category, brand, price, availability, description } = req.body

  // Multer processed files and saved to uploads/
  let imagePaths = []
  if (req.files && Array.isArray(req.files) && req.files.length > 0) {
    // Map filenames to relative public paths
    imagePaths = req.files.map(f => `/uploads/${f.filename}`).slice(0, 3)
    // Example: ["/uploads/1707469200000-photo.jpg"]
    console.log('✅ createProduct - image files received:', imagePaths);
  }

  // Compute next product ID (custom, not auto-increment)
  const [maxRows] = await pool.query('SELECT MAX(id) as maxId FROM products')
  const nextId = (maxRows?.[0]?.maxId || 0) + 1

  // Store as JSON string in database
  try {
    const imagesToSave = JSON.stringify(imagePaths)
    // imagesToSave = '[]' or '["/uploads/1707...photo.jpg"]'
    
    await pool.query(
      `INSERT INTO products (id, name, category, ..., images)
       VALUES (?, ?, ?, ?, ..., ?)`,
      [nextId, name, category, ..., imagesToSave]
    )
  } catch (insertErr) {
    if (insertErr.code === 'ER_BAD_FIELD_ERROR' && insertErr.message.includes('images')) {
      // Fallback if images column doesn't exist in old schema
      await pool.query(
        `INSERT INTO products (id, name, category, ..., image_url)
         VALUES (?, ?, ?, ?, ..., ?)`,
        [nextId, name, category, ..., imagePaths[0] || null]
      )
    } else {
      throw insertErr
    }
  }

  // Return product with normalized images array
  const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [nextId])
  const prod = normalizeProductImages(rows[0])
  return res.status(201).json({ success: true, data: prod })
}
```

## 7. Backend Controller - Update

### backend/controllers/productController.js - updateProduct()

```javascript
export async function updateProduct(req, res) {
  const { id } = req.params
  const { name, category, brand, price, availability, description } = req.body

  // Fetch existing product to check current images
  const [existing] = await pool.query(
    'SELECT id, images FROM products WHERE id = ?', 
    [id]
  )

  if (existing.length === 0) {
    return res.status(404).json({ success: false, message: 'Product not found' })
  }

  // Build UPDATE SET dynamically
  const updates = []
  const values = []

  if (name !== undefined) {
    updates.push('name = ?')
    values.push(name)
  }
  // ... similar for other fields ...

  // KEY LOGIC: Only update images if new files were uploaded
  if (req.files && Array.isArray(req.files) && req.files.length > 0) {
    // NEW FILES → Replace images
    const imagePaths = req.files.map(f => `/uploads/${f.filename}`).slice(0, 3)
    updates.push('images = ?')
    values.push(JSON.stringify(imagePaths))
    console.log('✅ updateProduct - new images uploaded:', imagePaths);
  } else {
    // NO NEW FILES → Preserve existing images
    // Notice: We do NOT add 'images = ?' to UPDATE SET
    console.log('⚠️ updateProduct - no new files, preserving existing images from DB');
  }

  if (updates.length === 0) {
    return res.status(400).json({ success: false, message: 'No fields to update' })
  }

  values.push(id) // For WHERE clause
  const updateQuery = `UPDATE products SET ${updates.join(', ')} WHERE id = ?`
  await pool.query(updateQuery, values)

  // Return updated product
  const [updated] = await pool.query('SELECT * FROM products WHERE id = ?', [id])
  const prod = normalizeProductImages(updated[0])
  return res.json({ success: true, message: 'Product updated', data: prod })
}
```

## 8. Data Normalization

### backend/controllers/productController.js - normalizeProductImages()

```javascript
function normalizeProductImages(prod) {
  if (!prod) return prod
  
  try {
    if (prod.images === null || prod.images === undefined) {
      // No images yet
      prod.images = []
    } else if (typeof prod.images === 'string') {
      // Stored as JSON string in DB
      try { 
        prod.images = JSON.parse(prod.images) 
      } catch (e) { 
        prod.images = [] 
      }
    } else if (!Array.isArray(prod.images)) {
      // Unexpected type
      prod.images = []
    }
  } catch (e) {
    prod.images = []
  }
  
  return prod
}

// After normalizeProductImages(product):
// product.images = ["/uploads/1707469200000-photo.jpg"]
```

## 9. Static Serving

### backend/server.js

```javascript
import express from 'express'
import serveIndex from 'serve-index'

const app = express()

// Serve uploaded images as static files
app.use('/uploads', express.static('uploads'), serveIndex('uploads', { icons: true }))

// Maps:
// Filesystem: /uploads/1707469200000-photo.jpg
// Public URL: http://localhost:4000/uploads/1707469200000-photo.jpg
```

## 10. Frontend Display

### frontend/src/admin/AdminProducts.jsx - Image Display

```javascript
// In table row:
<td>
  <img 
    src={(it.images && it.images.length > 0) 
      ? `http://localhost:4000${it.images[0]}` 
      : '/placeholder.png'}
    alt={it.name}
    style={{width: 50, height: 50, objectFit: 'cover', borderRadius: 4}}
  />
</td>

// Resulting URL:
// http://localhost:4000/uploads/1707469200000-photo.jpg
//                      └── auto-served by express.static('uploads')
```

## Summary Table

| Step | Code | Input | Output |
|------|------|-------|--------|
| 1. Select | `input[type=file]` | Real files from disk | `blob:http://localhost:5173/...` |
| 2. Detect | `newFiles.filter(i => i.url.startsWith('blob:'))` | `[{name, url: blob:...}]` | Array length > 0 |
| 3. Fetch | `fetch(blob:url).then(r => r.blob())` | blob: URL | Binary Blob object |
| 4. Append | `formData.append('images', blob)` | FormData + Blob | FormData with files |
| 5. Send | `axios.post(formData)` | FormData | HTTP request (auto boundary) |
| 6. Receive | `multer.array('images', 3)` | HTTP request | `req.files = [{filename, ...}]` |
| 7. Save | `req.files.map(f => \`/uploads/${f.filename}\`)` | File objects | Array of paths |
| 8. Store | `JSON.stringify(paths)` | `["/uploads/..."]` | `"[\"/uploads/...\"]"` |
| 9. Query | `SELECT images FROM products` | DB query | JSON string from DB |
| 10. Parse | `normalizeProductImages()` | JSON string | `["/uploads/..."]` array |
| 11. Display | `` `http://localhost:4000${images[0]}` `` | Path from DB | Public URL |
| 12. Serve | `express.static('uploads')` | HTTP GET | Binary image file |

## Key Points

✅ **No manual Content-Type header** - Browser sets multipart/form-data with boundary  
✅ **Blob URL detection** - Reliable way to detect newly selected files  
✅ **Explicit preservation** - UPDATE only touches images if new files exist  
✅ **Relative public paths** - Store `/uploads/file.jpg`, not absolute paths  
✅ **JSON storage** - Future-proof for multiple images per product  
✅ **Graceful fallback** - Works even if images column missing (old schema)  
✅ **MIME validation** - Only images allowed (jpeg, png, gif, webp)  
✅ **File size limit** - Max 5MB per file via multer config  
✅ **Filename safety** - Timestamp + original name prevents collisions
