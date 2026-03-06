# Image Upload Fix - Complete Implementation

## Problem Fixed

The image upload system had two critical issues:

1. **Manual Content-Type Header Bug**: `axios.put/post` calls had `headers: { 'Content-Type': 'multipart/form-data' }` which breaks multipart boundary encoding
2. **Images Overwritten on Edit**: When editing products without selecting new images, the backend would overwrite the images column (even though the controller had logic to prevent it, the frontend sometimes didn't send FormData correctly)

## Solution Implemented

### Frontend Changes (AdminProducts.jsx)

#### 1. **Remove Manual Content-Type Headers**
- ❌ REMOVED: `headers: { 'Content-Type': 'multipart/form-data' }`
- ✅ Added: Comment explaining browser auto-sets boundary

#### 2. **Create Product (New)**
```javascript
// Only use FormData if images are selected
if (newFiles.length > 0) {
  // Build FormData with all fields
  const formData = new FormData()
  formData.append('name', data.name)
  // ... append all other fields ...
  
  // Append file blobs
  for (let i = 0; i < Math.min(3, newFiles.length); i++) {
    const f = newFiles[i]
    const response = await fetch(f.url)
    const blob = await response.blob()
    formData.append('images', blob, f.name)
  }
  
  // Send FormData (browser auto-sets multipart/form-data with boundary)
  const axios = (await import('axios')).default
  const apiRes = await axios.post(`${API_URL}/products`, formData)
  res = apiRes.data
} else {
  // No images: send JSON
  res = await createProduct({...})
}
```

#### 3. **Edit Product (Existing)**
- Same logic as create: FormData only if new files detected (blob: URLs)
- When no new files: sends JSON, backend preserves existing images

### Backend Changes (productController.js)

#### 1. **updateProduct Controller - Explicit Image Preservation**

**Before:**
```javascript
if (req.files && Array.isArray(req.files) && req.files.length > 0) {
  // update images
} else {
  // just log, don't update
}
```

**After:**
```javascript
// Explicitly handle images
if (req.files && Array.isArray(req.files) && req.files.length > 0) {
  // New images uploaded: REPLACE
  const imagePaths = req.files.map(f => `/uploads/${f.filename}`).slice(0, 3)
  updates.push('images = ?')
  values.push(JSON.stringify(imagePaths))
  console.log('✅ updateProduct - new images uploaded:', imagePaths);
} else {
  // No new files: DO NOT UPDATE IMAGES FIELD (preserve existing)
  console.log('⚠️ updateProduct - no new files, preserving existing images from DB');
}
```

**Key Difference:**
- The `images` field is only added to the UPDATE SET clause if new files exist
- If `req.files` is undefined/empty, the images field is completely untouched
- This ensures existing images are preserved

#### 2. **createProduct Controller - Improved Logging**

- Clearer console messages about image handling
- Better error messages for schema issues
- Proper JSON stringification of image paths

### Data Flow

```
SCENARIO 1: Add Product with Images
Frontend (AdminProducts)
  ↓ detects newFiles.length > 0
  ↓ builds FormData, appends files
  ↓ axios.post(FormData) [NO Content-Type header]
  ↓
Backend (productController.createProduct)
  ↓ multer extracts req.files
  ↓ maps to `/uploads/timestamp-name.jpg` paths
  ↓ JSON.stringify([...paths...]) → images column
  ↓ returns product with images array

SCENARIO 2: Edit Product with New Images
Frontend (AdminProducts)
  ↓ detects newFilesForEdit with blob: URLs
  ↓ builds FormData, appends files
  ↓ axios.put(FormData) [NO Content-Type header]
  ↓
Backend (productController.updateProduct)
  ↓ multer extracts req.files
  ↓ maps to new image paths
  ↓ adds "images = ?" to UPDATE SET
  ↓ REPLACES old images
  ↓ returns product with new images

SCENARIO 3: Edit Product WITHOUT New Images
Frontend (AdminProducts)
  ↓ detects newFilesForEdit.length === 0
  ↓ calls updateProduct(JSON) with fields only
  ↓ axios.put(JSON) [Content-Type: application/json]
  ↓
Backend (productController.updateProduct)
  ↓ req.files is undefined
  ↓ DOES NOT add "images = ?" to UPDATE SET
  ↓ images column remains untouched in DB
  ↓ returns product with EXISTING images preserved
```

## Database Storage Format

```sql
-- Table: products
-- Column: images (JSON)

-- Example value:
["/uploads/1707469200000-photo.jpg", "/uploads/1707469201000-image.png"]

-- NOT stored as:
-- - Full URL: "http://localhost:4000/uploads/..."
-- - Absolute path: "/Users/.../uploads/..."
```

## Frontend Display

```javascript
// AdminProducts.jsx image display
<img 
  src={`http://localhost:4000${product.images[0]}`}
  alt={product.name}
/>

// Results in public URL:
// http://localhost:4000/uploads/1707469200000-photo.jpg
```

## Static Serving Configuration

```javascript
// backend/server.js
app.use('/uploads', express.static('uploads'), serveIndex('uploads', { icons: true }));

// Maps filesystem: /uploads/ → URL: http://localhost:4000/uploads/
```

## Multer Configuration

```javascript
// backend/config/multer.js
const upload = multer({
  storage: multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
      const timestamp = Date.now()
      const ext = path.extname(file.originalname)
      const name = path.basename(file.originalname, ext)
      cb(null, `${timestamp}-${name}${ext}`)
    }
  }),
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    cb(allowedMimes.includes(file.mimetype) ? null : new Error('Only image files allowed'))
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
})
```

## Testing Checklist

- [ ] **Add Product with 1-3 images**
  - Images upload to `/uploads/` folder
  - `images` column stores JSON array like `["/uploads/file.jpg"]`
  - Admin table displays image thumbnail
  - Product page displays first image

- [ ] **Edit Product - Keep Existing Images**
  - Edit product name/price/description ONLY
  - Do NOT select new images
  - Submit form
  - Images should still display (not become placeholder)
  - Verify images column in DB unchanged

- [ ] **Edit Product - Replace Images**
  - Edit product with existing images
  - Click upload and select new images
  - Submit form
  - Old images removed from `images` column
  - New images stored
  - Admin table and product page show new images

- [ ] **Network Tab Verification (Browser DevTools)**
  - Add/Edit with images → Request Content-Type should be `multipart/form-data; boundary=...`
  - Edit without images → Request Content-Type should be `application/json`
  - Payload should show Form Data (not JSON fields)

## Files Modified

1. **frontend/src/admin/AdminProducts.jsx**
   - Removed manual Content-Type headers from axios.post/put
   - Added clarity comments about browser auto-setting boundary
   - Both create and edit flows now properly detect new files

2. **backend/controllers/productController.js**
   - createProduct: Improved logging
   - updateProduct: Explicit logic to preserve images when no new files

## Why This Fix Works

1. **Removed Manual Header**: Browser/axios now properly sets `multipart/form-data; boundary=...` which multer needs to parse files

2. **Explicit Image Preservation**: The UPDATE query only includes `images = ?` if new files exist, guaranteeing other updates don't accidentally clear the images column

3. **FormData Detection is Reliable**: Checking for blob: URLs is a solid way to detect newly selected files - old images use `http://localhost:4000/...` URLs

4. **JSON Fallback for No-Images**: When no new images, the backend gets undefined req.files and doesn't touch the images column

## Deployment Notes

- No database schema changes needed (images column already exists via migration)
- No environment variable changes
- No package.json changes
- Can deploy frontend and backend independently
- Existing products with images will continue to work
