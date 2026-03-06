# Product Image Storage Refactoring - Complete ✅

## Overview
Refactored product image storage from JSON-based (legacy) to proper relational database design using a separate `product_images` table.

## What Changed

### Database Design
- **Old approach**: Images stored as JSON in `products.images` column
- **New approach**: Separate `product_images` table with:
  - `id`: Primary key
  - `product_id`: Foreign key to products
  - `image_path`: Filename only (NOT full path, NOT /uploads prefix)
  - `created_at`: Timestamp
  - `ON DELETE CASCADE`: Auto-cleanup when product deleted

### Key Implementation Rules

#### 1. **Storage Format**
- Database stores ONLY filename: `"1712345-test.png"`
- NOT stored: `/uploads/1712345-test.png`
- NOT stored: Full URLs

#### 2. **Frontend Image URL Construction**
```javascript
const BASE = import.meta.env.VITE_API_URL?.replace('/api','') || "http://localhost:4000"
<img src={`${BASE}/uploads/${filename}`} />
```

#### 3. **API Response Format**
All product endpoints return:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Product Name",
    "category": "...",
    "images": ["filename1.png", "filename2.png"]  // filenames only
  }
}
```

---

## Updated Functions

### ✅ `createProduct()`
**Logic:**
1. Insert product into `products` table
2. Get `insertId` from result
3. For each uploaded file:
   - Insert `(product_id, file.filename)` into `product_images` table
   - Store filename ONLY (e.g., "1712345-test.png")
4. Fetch product with JOIN and return grouped images

**Code Flow:**
```javascript
const [result] = await pool.query(`INSERT INTO products (...)`)
const productId = result.insertId

if (req.files && req.files.length > 0) {
  for (const file of req.files.slice(0, 3)) {
    await pool.query(
      `INSERT INTO product_images (product_id, image_path) VALUES (?, ?)`,
      [productId, file.filename]
    )
  }
}

// Return product with images
const [rows] = await pool.query(`
  SELECT p.*, pi.image_path
  FROM products p
  LEFT JOIN product_images pi ON p.id = pi.product_id
  WHERE p.id = ?
`, [productId])
```

---

### ✅ `updateProduct()` - Option A
**Logic (If new images uploaded):**
1. Delete ALL existing images: `DELETE FROM product_images WHERE product_id = ?`
2. Insert NEW images into product_images table
3. Return updated product with new images

**Logic (If NO new files):**
- Do NOT touch product_images table
- Preserve existing images from database

**Code Flow:**
```javascript
if (req.files && req.files.length > 0) {
  // Option A: Replace all images
  await pool.query('DELETE FROM product_images WHERE product_id = ?', [id])
  
  for (const file of req.files.slice(0, 3)) {
    await pool.query(
      `INSERT INTO product_images (product_id, image_path) VALUES (?, ?)`,
      [id, file.filename]
    )
  }
} else {
  // Preserve existing images - don't modify product_images table
}
```

---

### ✅ `getAllProducts()`
**Query:**
```sql
SELECT p.*, pi.image_path
FROM products p
LEFT JOIN product_images pi ON p.id = pi.product_id
ORDER BY p.id DESC
```

**Backend Grouping:**
```javascript
const map = {}
rows.forEach(row => {
  if (!map[row.id]) {
    map[row.id] = { ...product fields..., images: [] }
  }
  if (row.image_path) {
    map[row.id].images.push(row.image_path)
  }
})
```

---

### ✅ `getProductById()`
**Query:**
```sql
SELECT p.*, pi.image_path
FROM products p
LEFT JOIN product_images pi ON p.id = pi.product_id
WHERE p.id = ?
```

**Backend Grouping:**
Same as getAllProducts - maps multiple rows to single product with image array.

---

### ✅ `getProductsByCategory()`
**Updated to use JOIN** instead of old JSON parsing:
```sql
SELECT p.*, pi.image_path
FROM products p
LEFT JOIN product_images pi ON p.id = pi.product_id
WHERE p.category = ?
```

---

### ✅ `incrementView()`
**Updated to fetch images via JOIN:**
```javascript
const [rows] = await pool.query(`
  SELECT p.*, pi.image_path
  FROM products p
  LEFT JOIN product_images pi ON p.id = pi.product_id
  WHERE p.id = ?
`, [id])
```

---

### ✅ `increaseAvailability()`
**Updated to fetch images via JOIN** for returned product object.

---

## What Was NOT Changed

✅ **Multer configuration** - Unchanged
✅ **File upload logic** - Unchanged
✅ **express.static('/uploads')** - Unchanged
✅ **API response structure** - `{ success: true, data: product }` format maintained
✅ **Frontend integration** - Only URL construction updated to use filename + BASE

⚠️ **products.images column** - Still exists but NOT USED
- Left in place for potential rollback
- Can be deleted in future cleanup

---

## Testing Checklist

### CREATE Product
- [ ] Upload images during product creation
- [ ] Verify images appear in `product_images` table
- [ ] Response includes `images: ["filename1.png", ...]`
- [ ] Frontend constructs URLs correctly: `${BASE}/uploads/filename`

### UPDATE Product
- [ ] Update with new images → old images deleted, new ones inserted
- [ ] Update without new images → existing images preserved
- [ ] Response includes correct image filenames

### RETRIEVE Products
- [ ] `GET /api/products` includes images per product
- [ ] `GET /api/products/:id` includes images
- [ ] `GET /api/products/category/:category` includes images
- [ ] `POST /api/products/:id/view` includes images

---

## Migration Notes

**For existing products with JSON-based images:**
1. The `normalizeProductImages()` helper function still exists for backward compatibility
2. If legacy data exists, a migration script would be needed to:
   - Parse `products.images` JSON
   - Extract filenames
   - Insert into `product_images` table
3. No immediate action required - system works with new table

---

## Database Table Schema

```sql
CREATE TABLE product_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  image_path VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
```

---

## Files Modified
- ✅ `/ShopSphere/backend/controllers/productController.js`
  - `createProduct()` - uses new table
  - `updateProduct()` - uses Option A strategy
  - `getAllProducts()` - uses JOIN
  - `getProductById()` - uses JOIN
  - `getProductsByCategory()` - uses JOIN
  - `incrementView()` - uses JOIN
  - `increaseAvailability()` - uses JOIN

---

## Summary
All product image operations now properly use the relational `product_images` table. The database stores only filenames, the backend groups them per product, and the frontend constructs URLs dynamically. This eliminates JSON parsing issues and provides proper database structure for scalability.
