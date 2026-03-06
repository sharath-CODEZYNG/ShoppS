import pool from '../config/db.js';
import axios from "axios";
import cloudinary from "../config/cloudinary.js";
import { trackUserActivity } from '../utils/userActivity.js';




const BACKEND_BASE =
  (process.env.BACKEND_BASE_URL ||
   "https://shopsphere-repo.onrender.com").replace(/\/+$/, "");



const FASTAPI_BASE_URL = process.env.FASTAPI_BASE_URL || 'https://shopsphere-repo-2.onrender.com';

async function syncProductToFastApi(product) {
const payload = {
id: Number(product.id),
name: product.name || '',
category: product.category || '',
brand: product.brand || '',
price: Number(product.price || 0),
description: product.description || '',
features: product.features || '',
tags: product.tags || '',
attributes_json: product.attributes_json || '{}',
availability: Number(product.availability || 0)
};

await axios.post(`${FASTAPI_BASE_URL}/add-product`, payload, { timeout: 10000 });
}

function resolveImageUrl(imagePath) {
  if (!imagePath || typeof imagePath !== "string") return null;
  const cleanPath = imagePath.trim().replace(/\\/g, "/");
  if (!cleanPath) return null;

  // Cloudinary or external URL
  if (/^https?:\/\//i.test(cleanPath)) {
    return cleanPath;
  }

  // Old local uploads (migration support), tolerant to stored variants:
  // "uploads/file.jpg", "/uploads/file.jpg", "file.jpg"
  const normalized = cleanPath.replace(/^\.\//, "").replace(/^\/+/, "");
  if (normalized.startsWith("uploads/")) {
    return `${BACKEND_BASE}/${normalized}`;
  }

  // Legacy Cloudinary public_id support (historically stored as file.filename)
  const isLikelyCloudinaryPublicId =
    normalized.startsWith("shopsphere_products/") ||
    (!normalized.includes(".") && !normalized.startsWith("uploads/"));
  if (isLikelyCloudinaryPublicId) {
    return cloudinary.url(normalized, { secure: true });
  }

  // Bare filenames with an extension are local uploads; extension-less values are likely Cloudinary public IDs.
  if (!normalized.includes("/")) {
    if (normalized.includes(".")) {
      return `${BACKEND_BASE}/uploads/${normalized}`;
    }
    return cloudinary.url(normalized, { secure: true });
  }

  return `${BACKEND_BASE}/uploads/${normalized}`;
}

function getStoredImagePath(file) {
  if (!file) return null;

  const candidates = [file.path, file.secure_url, file.url];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      const value = candidate.trim();
      if (/^https?:\/\//i.test(value)) return value;

      // If Cloudinary middleware gave us public_id-like values, convert to URL.
      if (value === file.filename || value.startsWith("shopsphere_products/")) {
        return cloudinary.url(value, { secure: true });
      }

      // Fallback for local filename/path variants.
      return resolveImageUrl(value);
    }
  }

  if (typeof file.filename === "string" && file.filename.trim()) {
    return cloudinary.url(file.filename.trim(), { secure: true });
  }

  return null;
}


// Helper to ensure product.images is always an array
function normalizeProductImages(prod) {
  if (!prod) return prod
  try {
    if (prod.images === null || prod.images === undefined) {
      prod.images = []
    } else if (typeof prod.images === 'string') {
      // stored as JSON string
      try { prod.images = JSON.parse(prod.images) } catch (e) { prod.images = [] }
    } else if (!Array.isArray(prod.images)) {
      // handle unexpected types
      prod.images = []
    }
  } catch (e) {
    prod.images = []
  }
  return prod
}

function resolveUserIdFromRequest(req) {
if (req.user?.id) return req.user.id;
if (req.body?.userId) return req.body.userId;
if (req.query?.userId) return req.query.userId;

const authHeader = req.headers?.authorization || req.headers?.Authorization;
if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
return null;
}

const token = authHeader.split(' ')[1];
if (!token) return null;

try {
const decoded = jwt.verify(token, process.env.JWT_SECRET);
return decoded?.id || null;
} catch {
return null;
}
}



// Controller: Get all products
export async function getAllProducts(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT p.*, pi.image_path
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      ORDER BY p.id DESC
    `);

    const map = {};

    rows.forEach(row => {
      if (!map[row.id]) {
        map[row.id] = {
          id: row.id,
          name: row.name,
          category: row.category,
          brand: row.brand,
          price: row.price,
          availability: row.availability,
          description: row.description,
          features: row.features,
          tags: row.tags,
          attributes_json: row.attributes_json,
          rating_avg: row.rating_avg,
          rating_count: row.rating_count,
          views: row.views,
          images: []
        };
      }

      if (row.image_path) {
        map[row.id].images.push(
          resolveImageUrl(row.image_path)
        );
      }
    }); // ✅ LOOP CLOSED

    // Ensure images is always an array for each product
    const products = Object.values(map).map(normalizeProductImages);
    return res.json({
      success: true,
      data: products
    });

  } catch (err) {
    console.error('Error fetching products:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
}

// Controller: Get products by category
export async function getProductsByCategory(req, res) {
  const { category } = req.params;
  try {
    // Query products by category with images from product_images table
    const [rows] = await pool.query(`
      SELECT p.*, pi.image_path
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.category = ?
    `, [category]);

    // Group images per product
    const map = {};
    rows.forEach(row => {
      if (!map[row.id]) {
        map[row.id] = {
          id: row.id,
          name: row.name,
          category: row.category,
          brand: row.brand,
          price: row.price,
          availability: row.availability,
          description: row.description,
          features: row.features,
          tags: row.tags,
          attributes_json: row.attributes_json,
          rating_avg: row.rating_avg,
          rating_count: row.rating_count,
          views: row.views,
          images: []
        };
      }
    //   if (row.image_path) {
    //     map[row.id].images.push(row.image_path);
    //   }
    // });
      //CHANGES_START
      if (row.image_path) {
  map[row.id].images.push(
    resolveImageUrl(row.image_path)
  );
}
    });
//CHANGES_END

    // Ensure images is always an array for each product
    const products = Object.values(map).map(normalizeProductImages);
    return res.json({ success: true, data: products });
  } catch (err) {
    console.error('Error fetching products by category:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// Controller: Get a single product by ID
export async function getProductById(req, res) {
  const { id } = req.params;
  try {
    // Return product without incrementing views (separate endpoint handles view counting)
    const [rows] = await pool.query(`
      SELECT p.*, pi.image_path
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.id = ?
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Group images for the single product
    const prod = {
      id: rows[0].id,
      name: rows[0].name,
      category: rows[0].category,
      brand: rows[0].brand,
      price: rows[0].price,
      availability: rows[0].availability,
      description: rows[0].description,
      features: rows[0].features,
      tags: rows[0].tags,
      attributes_json: rows[0].attributes_json,
      rating_avg: rows[0].rating_avg,
      rating_count: rows[0].rating_count,
      views: rows[0].views,
      images: rows.filter(r => r.image_path).map(r => resolveImageUrl(r.image_path))
    };
    // Ensure images is always an array
    return res.json({ success: true, data: normalizeProductImages(prod) });
  } catch (err) {
    console.error('Error fetching product by id:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// Controller: increment view count and return product (call once per real view)
export async function incrementView(req, res) {
const { id } = req.params;
const userId = resolveUserIdFromRequest(req);
try {
const didTrackView = await trackUserActivity({
userId,
productId: id,
action: 'view',
dedupeWindowSeconds: 20
});

if (didTrackView) {
await pool.query('UPDATE products SET views = views + 1 WHERE id = ?', [id]);
}
// Fetch and return the updated product with images
const [rows] = await pool.query(`
SELECT p.*, pi.image_path
FROM products p
LEFT JOIN product_images pi ON p.id = pi.product_id
WHERE p.id = ?
`, [id]);
if (rows.length === 0) return res.status(404).json({ success: false, message: 'Product not found' });
const prod = {
id: rows[0].id,
name: rows[0].name,
category: rows[0].category,
brand: rows[0].brand,
price: rows[0].price,
availability: rows[0].availability,
description: rows[0].description,
features: rows[0].features,
tags: rows[0].tags,
attributes_json: rows[0].attributes_json,
rating_avg: rows[0].rating_avg,
rating_count: rows[0].rating_count,
views: rows[0].views,
images: rows.filter(r => r.image_path).map(r => resolveImageUrl(r.image_path))
};
// Ensure images is always an array
return res.json({ success: true, data: normalizeProductImages(prod) });
} catch (err) {
console.error('Error incrementing view:', err);
return res.status(500).json({ success: false, message: 'Server error' });
}
}


// Controller: increment view count and return product (call once per real view)
// export async function incrementView(req, res) {
//   const { id } = req.params;
//   try {
//     // Simple atomic increment to avoid dependency on product_views table
//     await pool.query('UPDATE products SET views = views + 1 WHERE id = ?', [id]);
    
//     // Fetch and return the updated product with images
//     const [rows] = await pool.query(`
//       SELECT p.*, pi.image_path
//       FROM products p
//       LEFT JOIN product_images pi ON p.id = pi.product_id
//       WHERE p.id = ?
//     `, [id]);
    
//     if (rows.length === 0) return res.status(404).json({ success: false, message: 'Product not found' });
    
//     const prod = {
//       id: rows[0].id,
//       name: rows[0].name,
//       category: rows[0].category,
//       brand: rows[0].brand,
//       price: rows[0].price,
//       availability: rows[0].availability,
//       description: rows[0].description,
//       features: rows[0].features,
//       tags: rows[0].tags,
//       attributes_json: rows[0].attributes_json,
//       rating_avg: rows[0].rating_avg,
//       rating_count: rows[0].rating_count,
//       views: rows[0].views,
//       images: rows.filter(r => r.image_path).map(r => resolveImageUrl(r.image_path))
//     };
//     // Ensure images is always an array
//     return res.json({ success: true, data: normalizeProductImages(prod) });
//   } catch (err) {
//     console.error('Error incrementing view:', err);
//     return res.status(500).json({ success: false, message: 'Server error' });
//   }
// }

// Controller: Submit rating for product (only users who ordered the product)
export async function submitRating(req, res) {
  const { id } = req.params; // product id
  const { rating, orderId } = req.body;
  const userId = req.user.id;

  if (!rating || !orderId) {
    return res.status(400).json({ success: false, message: 'userId, orderId and rating are required' });
  }

  if (!(Number(rating) >= 1 && Number(rating) <= 5)) {
    return res.status(400).json({ success: false, message: 'rating must be between 1 and 5' });
  }

  // try {
  //   // Verify the order belongs to the user and contains the product
  //   const [orderCheck] = await pool.query(
  //     `SELECT oi.quantity FROM order_items oi
  //      JOIN orders o ON oi.order_id = o.id
  //      WHERE o.user_id = ? AND oi.product_id = ? AND oi.order_id = ?`,
  //     [userId, id, orderId]
  //   );

  //   if (!orderCheck || orderCheck.length === 0) {
  //     return res.status(403).json({ success: false, message: 'Order does not contain this product or does not belong to user' });
  //   }
     try {

        // Verify delivered order belongs to the user and contains the product

        const [orderCheck] = await pool.query(

        `SELECT oi.quantity FROM order_items oi

        JOIN orders o ON oi.order_id = o.id

        WHERE o.user_id = ? AND oi.product_id = ? AND oi.order_id = ? AND o.status = 'delivered'`,

        [userId, id, orderId]

        );

        if (!orderCheck || orderCheck.length === 0) {

        return res.status(403).json({ success: false, message: 'Only delivered orders containing this product can be rated' });

        }

    // Prevent duplicate rating for same user/product/order
    const [existing] = await pool.query(
      'SELECT COUNT(*) as cnt FROM product_ratings WHERE user_id = ? AND product_id = ? AND order_id = ?',
      [userId, id, orderId]
    );
    const alreadyGiven = existing?.[0]?.cnt || 0;
    if (alreadyGiven > 0) {
      return res.status(400).json({ success: false, message: 'Rating already submitted for this order item' });
    }

    // Insert rating with order_id
    await pool.query('INSERT INTO product_ratings (user_id, product_id, order_id, rating) VALUES (?, ?, ?, ?)', [userId, id, orderId, rating]);

    // Recompute aggregate rating and count
    const [agg] = await pool.query('SELECT AVG(rating) as avgRating, COUNT(*) as cnt FROM product_ratings WHERE product_id = ?', [id]);
    const avg = parseFloat(agg[0].avgRating || 0).toFixed(2);
    const cnt = agg[0].cnt || 0;

    await pool.query('UPDATE products SET rating_avg = ?, rating_count = ? WHERE id = ?', [avg, cnt, id]);

    return res.json({ success: true, message: 'Rating submitted', data: { rating_avg: avg, rating_count: cnt } });
  } catch (err) {
    console.error('Error submitting rating:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

//changes_start
// Controller: Submit text review for product (only users who received delivered order)

export async function submitReview(req, res) {

const { id } = req.params; // product id

const { orderId, reviewText } = req.body;

const userId = req.user.id;

if (!orderId || !reviewText || !String(reviewText).trim()) {

return res.status(400).json({ success: false, message: 'orderId and non-empty reviewText are required' });

}

const cleanedReview = String(reviewText).trim();

if (cleanedReview.length > 2000) {

return res.status(400).json({ success: false, message: 'reviewText must be at most 2000 characters' });

}

try {

// Verify delivered order belongs to the user and contains this product

const [orderCheck] = await pool.query(

`SELECT oi.id

FROM order_items oi

JOIN orders o ON oi.order_id = o.id

WHERE o.user_id = ? AND oi.product_id = ? AND oi.order_id = ? AND o.status = 'delivered'`,

[userId, id, orderId]

);

if (!orderCheck || orderCheck.length === 0) {

return res.status(403).json({ success: false, message: 'Only delivered orders containing this product can be reviewed' });

}

// Prevent duplicate review per user/product/order

const [existing] = await pool.query(

'SELECT COUNT(*) as cnt FROM product_reviews WHERE user_id = ? AND product_id = ? AND order_id = ?',

[userId, id, orderId]

);

if ((existing?.[0]?.cnt || 0) > 0) {

return res.status(400).json({ success: false, message: 'Review already submitted for this order item' });

}

const [result] = await pool.query(

'INSERT INTO product_reviews (user_id, product_id, order_id, review_text) VALUES (?, ?, ?, ?)',

[userId, id, orderId, cleanedReview]

);

axios.post(`${FASTAPI_BASE_URL}/process-review-sentiment`, {
    review_id: result.insertId, // <-- Pass the newly generated review ID
    product_id: Number(id),
    review_text: cleanedReview
}).catch(err => console.error("Sentiment sync failed:", err.message));

return res.status(201).json({

success: true,

message: 'Review submitted',

data: {

product_id: Number(id),

order_id: Number(orderId),

review_text: cleanedReview

}

});

} catch (err) {

console.error('Error submitting review:', err);

return res.status(500).json({ success: false, message: 'Server error' });

}

}

// Controller: Get reviews for a product

export async function getProductReviews(req, res) {

const { id } = req.params; // product id

try {

const [rows] = await pool.query(

`SELECT pr.id, pr.user_id, pr.product_id, pr.order_id, pr.review_text, pr.created_at, u.name AS user_name

FROM product_reviews pr

JOIN users u ON pr.user_id = u.id

WHERE pr.product_id = ?

ORDER BY pr.created_at DESC`,

[id]

);

return res.json({ success: true, data: rows });

} catch (err) {

console.error('Error fetching product reviews:', err);

return res.status(500).json({ success: false, message: 'Server error' });

}

}

// Controller: Check if logged-in user can review a given order-item

export async function getOrderReviewStatus(req, res) {

const { id, orderId } = req.params; // product id and order id

const userId = req.user.id;

try {

const [eligibility] = await pool.query(

`SELECT COUNT(*) as cnt

FROM order_items oi

JOIN orders o ON oi.order_id = o.id

WHERE o.user_id = ? AND oi.product_id = ? AND oi.order_id = ? AND o.status = 'delivered'`,

[userId, id, orderId]

);

const canReview = (eligibility?.[0]?.cnt || 0) > 0;

const [reviewRows] = await pool.query(

'SELECT COUNT(*) as cnt FROM product_reviews WHERE user_id = ? AND product_id = ? AND order_id = ?',

[userId, id, orderId]

);

const reviewed = (reviewRows?.[0]?.cnt || 0) > 0;

return res.json({ success: true, data: { canReview, reviewed } });

} catch (err) {

console.error('Error checking review status:', err);

return res.status(500).json({ success: false, message: 'Server error' });
}
}
//changes_end


// Controller: Check if a user has already rated a given order-item
export async function getOrderRatingStatus(req, res) {
  const { id, orderId } = req.params; // product id and order id
  const { userId } = req.query;

  if (!userId) return res.status(400).json({ success: false, message: 'userId query param required' });

  try {
    const [rows] = await pool.query(
      'SELECT COUNT(*) as cnt FROM product_ratings WHERE user_id = ? AND product_id = ? AND order_id = ?',
      [userId, id, orderId]
    );
    const cnt = rows?.[0]?.cnt || 0;
    return res.json({ success: true, data: { rated: cnt > 0 } });
  } catch (err) {
    console.error('Error checking rating status:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// Controller: Create a new product (admin use)
export async function createProduct(req, res) {
  console.log('--- createProduct called ---');
  console.log('REQ CONTENT-TYPE:', req.headers['content-type']);
  console.log('REQ BODY KEYS:', req.body ? Object.keys(req.body) : null);
  console.log('REQ FILES:', Array.isArray(req.files) ? req.files.map(f => ({ originalname: f.originalname, filename: f.filename, path: f.path, secure_url: f.secure_url, url: f.url, size: f.size })) : req.files);

  const {
    name,
    category,
    brand = null,
    price = null,
    availability = 0,
    description = null,
    features = null,
    tags = null,
    attributes_json = null
  } = req.body;

  if (!name || !category || price === null) {
    return res.status(400).json({ success: false, message: 'name, category and price are required' });
  }

  try {
    // Insert product into products table
    const [result] = await pool.query(
      `INSERT INTO products (name, category, brand, price, availability, description, features, tags, attributes_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, category, brand, price, availability, description, features, tags, attributes_json]
    );

    const productId = result.insertId;
    console.log('✅ createProduct - product inserted with id:', productId);

    // Insert images into product_images table if files were uploaded (Cloudinary only)
    let images = [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      console.log('DEBUG: req.files received in createProduct:', req.files);
      for (const file of req.files.slice(0, 3)) {
        // file.secure_url is the Cloudinary URL
        const cloudinaryUrl = file.secure_url || (file.path ? cloudinary.url(file.path, { secure: true }) : null);
        if (!cloudinaryUrl) continue;
        await pool.query(
          `INSERT INTO product_images (product_id, image_path)
           VALUES (?, ?)`,
          [productId, cloudinaryUrl]
        );
        images.push(cloudinaryUrl);
      }
      console.log('✅ createProduct - images inserted (Cloudinary):', images);
    } else {
      console.log('ℹ️  createProduct - no image files in request');
    }

    // Fetch and return the created product with images
    const [rows] = await pool.query(`
      SELECT p.*, pi.image_path
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.id = ?
    `, [productId]);

    const prod = {
      id: rows[0].id,
      name: rows[0].name,
      category: rows[0].category,
      brand: rows[0].brand,
      price: rows[0].price,
      availability: rows[0].availability,
      description: rows[0].description,
      features: rows[0].features,
      tags: rows[0].tags,
      attributes_json: rows[0].attributes_json,
      rating_avg: rows[0].rating_avg,
      rating_count: rows[0].rating_count,
      views: rows[0].views,
      // images: rows.filter(r => r.image_path).map(r => r.image_path)
      //CHANGES_START
      images: rows
  .filter(r => r.image_path)
  .map(r => resolveImageUrl(r.image_path))
//CHANGES_END
    };

    console.log('📤 createProduct - response includes images:', prod.images);


    // 🔥 Sync to FastAPI (non-blocking safe)
    try {
      await syncProductToFastApi(prod);
      console.log('✅ Synced product to FastAPI');
      } catch (err) {
          console.error('⚠️ FastAPI sync failed (create):', err.message);
    }     
    return res.status(201).json({ success: true, data: prod });
  } catch (err) {
    console.error('Error creating product:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// Controller: Increase availability for a product (admin)
export async function increaseAvailability(req, res) {
  const { id } = req.params;
  const { amount } = req.body;

  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({ success: false, message: 'amount must be a positive number' });
  }

  try {
    const [rows] = await pool.query('SELECT availability FROM products WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Product not found' });

    await pool.query('UPDATE products SET availability = availability + ? WHERE id = ?', [Number(amount), id]);
    
    // Fetch and return the updated product with images
    const [updated] = await pool.query(`
      SELECT p.*, pi.image_path
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.id = ?
    `, [id]);

    const prod = {
      id: updated[0].id,
      name: updated[0].name,
      category: updated[0].category,
      brand: updated[0].brand,
      price: updated[0].price,
      availability: updated[0].availability,
      description: updated[0].description,
      features: updated[0].features,
      tags: updated[0].tags,
      attributes_json: updated[0].attributes_json,
      rating_avg: updated[0].rating_avg,
      rating_count: updated[0].rating_count,
      views: updated[0].views,
      // images: updated.filter(r => r.image_path).map(r => r.image_path)
      //CHANGES_START
      images: updated
  .filter(r => r.image_path)
  .map(r => resolveImageUrl(r.image_path))
//CHANGES_END
    };


    // 🔥 Sync availability update to FastAPI
try {
await axios.put(
`${FASTAPI_BASE_URL}/update-product-availability`,
null,
{
params: {
product_id: Number(prod.id),
availability: Number(prod.availability)
},
timeout: 10000
}
);

console.log('✅ Synced availability update to FastAPI');
} catch (err) {
console.error('⚠️ FastAPI sync failed (availability):', err.message);
}

    return res.json({ success: true, message: 'Availability updated', data: prod });
  } catch (err) {
    console.error('Error increasing availability:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

//Controller: Update a product
export async function updateProduct(req, res) {
  const { id } = req.params;
  const {
    name,
    category,
    brand,
    price,
    availability,
    description,
    features,
    tags,
    attributes_json
  } = req.body;

  try {
    // Check if product exists
    const [existing] = await pool.query('SELECT id FROM products WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Build update query dynamically based on provided fields
    const updates = [];
    const values = [];
    const safeUpdate = (field, value) => {
  if (value !== undefined && value !== null && value !== '') {
    updates.push(`${field} = ?`);
    values.push(value);
  }
};
safeUpdate('name', name);
safeUpdate('category', category);
safeUpdate('brand', brand);
safeUpdate('price', price);
safeUpdate('availability', availability !== undefined ? Number(availability) : undefined);
safeUpdate('description', description);
safeUpdate('features', features);
safeUpdate('tags', tags);
safeUpdate('attributes_json', attributes_json);
    // Option A: If new files uploaded, delete old images and insert new ones
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      // Delete all existing images for this product
      await pool.query('DELETE FROM product_images WHERE product_id = ?', [id]);
      console.log('✅ updateProduct - deleted old images for product:', id);

      // Insert new images (Cloudinary only)
      for (const file of req.files.slice(0, 3)) {
        const cloudinaryUrl = file.secure_url || (file.path ? cloudinary.url(file.path, { secure: true }) : null);
        if (!cloudinaryUrl) continue;
        await pool.query(
          `INSERT INTO product_images (product_id, image_path)
           VALUES (?, ?)`,
          [id, cloudinaryUrl]
        );
      }
      console.log('✅ updateProduct - inserted new images (Cloudinary)');
    } else {
      // No new files: do NOT touch product_images table
      console.log('⚠️ updateProduct - no new files, preserving existing images');
    }

    // Update product fields if any were provided
    if (updates.length > 0) {
      values.push(id); // for WHERE clause
      const updateQuery = `UPDATE products SET ${updates.join(', ')} WHERE id = ?`;
      await pool.query(updateQuery, values);
    }

    // Fetch and return the updated product with images
    const [rows] = await pool.query(`
      SELECT p.*, pi.image_path
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.id = ?
    `, [id]);

    const prod = {
      id: rows[0].id,
      name: rows[0].name,
      category: rows[0].category,
      brand: rows[0].brand,
      price: rows[0].price,
      availability: rows[0].availability,
      description: rows[0].description,
      features: rows[0].features,
      tags: rows[0].tags,
      attributes_json: rows[0].attributes_json,
      rating_avg: rows[0].rating_avg,
      rating_count: rows[0].rating_count,
      views: rows[0].views,
      // images: rows.filter(r => r.image_path).map(r => r.image_path)
      //changes_start
      images: rows
  .filter(r => r.image_path)
  .map(r => resolveImageUrl(r.image_path))
//changes_end
    };

    console.log('📤 updateProduct - response includes images:', prod.images);
    

try {
await axios.put(
`${FASTAPI_BASE_URL}/update-product-availability`,
null,
{
params: {
product_id: Number(prod.id),
availability: Number(prod.availability)
},
timeout: 10000
}
);

console.log('✅ Synced availability update to FastAPI (updateProduct)');
} catch (err) {
console.error('⚠️ FastAPI sync failed (updateProduct):', err.response?.data || err.message);
}



    return res.json({ success: true, message: 'Product updated', data: prod });
  } catch (err) {
    console.error('Error updating product:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}



// new update product:

// import axios from "axios";

// export async function addProduct(req, res) {

//   try {
//     const response = await axios.post(
//       "http://127.0.0.1:8000/products",
//       req.body
//     );

//     return res.json({
//       success: true,
//       message: "Product added via AI service",
//       data: response.data
//     });

//   } catch (err) {
//     console.error("Add product error:", err.response?.data || err.message);

//     return res.status(500).json({
//       success: false,
//       message: "FastAPI add failed"
//     });
//   }
// }



// Controller: Delete a product
// export async function deleteProduct(req, res) {
//   const { id } = req.params;

//   try {
//     // Check if product exists
//     const [existing] = await pool.query('SELECT id FROM products WHERE id = ?', [id]);
//     if (existing.length === 0) {
//       return res.status(404).json({ success: false, message: 'Product not found' });
//     }

//     await pool.query('DELETE FROM products WHERE id = ?', [id]);

//     try {
//         await axios.post(
//           `${FASTAPI_BASE_URL}/delete-product`,
//           { id: Number(id) },
//           { timeout: 10000 }
//         );

//     console.log('✅ Synced product deletion to FastAPI');
//     } catch (err) {
//             console.error('⚠️ FastAPI sync failed (delete):', err.message);
//       }
//     return res.json({ success: true, message: 'Product deleted', data: { id } });
//   } catch (err) {
//     console.error('Error deleting product:', err);
//     return res.status(500).json({ success: false, message: 'Server error' });
//   }
// }






export async function deleteProduct(req, res) {
const { id } = req.params;

const connection = await pool.getConnection();

try {
await connection.beginTransaction();

// Check if product exists
const [existing] = await connection.query(
'SELECT id FROM products WHERE id = ?',
[id]
);

if (existing.length === 0) {
await connection.rollback();
return res.status(404).json({ success: false, message: 'Product not found' });
}

// 1️⃣ Delete from product_images
await connection.query(
'DELETE FROM product_images WHERE product_id = ?',
[id]
);

// 2️⃣ Delete from carts
await connection.query(
'DELETE FROM carts WHERE productId = ?',
[id]
);

// 3️⃣ Now delete product
await connection.query(
'DELETE FROM products WHERE id = ?',
[id]
);

await connection.commit();

// 🔥 Sync to FastAPI
try {
await axios.post(
`${FASTAPI_BASE_URL}/delete-product`,
{ id: Number(id) },
{ timeout: 10000 }
);
console.log('✅ Synced product deletion to FastAPI');
} catch (err) {
console.error('⚠️ FastAPI sync failed (delete):', err.message);
}

return res.json({ success: true, message: 'Product deleted', data: { id } });

} catch (err) {
await connection.rollback();
console.error('Error deleting product:', err);
return res.status(500).json({ success: false, message: 'Server error' });
} finally {
connection.release();
}
}