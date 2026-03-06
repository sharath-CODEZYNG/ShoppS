import pool from '../config/db.js';


// Ensure `carts` table exists. This runs at controller import time.
// If the `products` table is not yet present (schema not imported),
// create the carts table without a foreign key to avoid a startup error.
// If `products` exists, create the carts table with the foreign key.
//changes_start
const BACKEND_BASE =
  process.env.BACKEND_BASE_URL ||
  "https://shopsphere-repo.onrender.com";

// function resolveImageUrl(imagePath) {
//   if (!imagePath) return null;

//   if (imagePath.startsWith("http")) return imagePath;

//   return `${BACKEND_BASE}/uploads/${imagePath}`;
// }
//changes_start
function resolveImageUrl(imagePath) {
  if (!imagePath || typeof imagePath !== "string") return null;

  const cleanPath = imagePath.trim();

  if (cleanPath.startsWith("http")) return cleanPath;

  return `${BACKEND_BASE}/uploads/${cleanPath}`;
}
//chnages_end
//changes_end
(async function initCarts() {
  try {
    // Check whether the products table exists in the connected database
    const [rows] = await pool.query("SHOW TABLES LIKE 'products'");
    if (rows.length > 0) {
      // products exists — create carts with FK referencing products(id)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS carts (
          id INT AUTO_INCREMENT PRIMARY KEY,
          userId VARCHAR(255) NOT NULL,
          productId INT NOT NULL,
          quantity INT NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY user_product (userId, productId),
          FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE
        )
      `);
    } else {
      // products does not exist — create carts without FK to avoid failure
      await pool.query(`
        CREATE TABLE IF NOT EXISTS carts (
          id INT AUTO_INCREMENT PRIMARY KEY,
          userId VARCHAR(255) NOT NULL,
          productId INT NOT NULL,
          quantity INT NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY user_product (userId, productId)
        )
      `);
    }
  } catch (err) {
    // Log but don't throw — controller modules should not crash the app on import
    console.error('Error creating carts table:', err);
  }
})();

// Controller: Add item to cart
export async function addToCart(req, res) {
  const { userId, productId, quantity = 1 } = req.body;
  if (!userId || !productId) {
    return res.status(400).json({ success: false, message: 'userId and productId are required' });
  }

  try {
    // Check product exists
    const [productRows] = await pool.query('SELECT id FROM products WHERE id = ?', [productId]);
    if (productRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // If item exists in cart for this user, update quantity, else insert
    const [existing] = await pool.query('SELECT id, quantity FROM carts WHERE userId = ? AND productId = ?', [userId, productId]);
    if (existing.length > 0) {
      const newQty = existing[0].quantity + Number(quantity);
      await pool.query('UPDATE carts SET quantity = ? WHERE id = ?', [newQty, existing[0].id]);
      return res.json({ success: true, message: 'Cart updated', data: { productId, quantity: newQty } });
    }

    const [result] = await pool.query('INSERT INTO carts (userId, productId, quantity) VALUES (?, ?, ?)', [userId, productId, quantity]);
    return res.status(201).json({ success: true, message: 'Added to cart', data: { cartId: result.insertId, productId, quantity } });
  } catch (err) {
    console.error('Error adding to cart:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// Controller: Get cart for a user
export async function getCartByUser(req, res) {
  const { userId } = req.params;
  try {
    // Join carts with products to return product info with quantity
    const [rows] = await pool.query(
   `
  SELECT 
    c.id as cartId,
    c.userId,
    c.productId,
    c.quantity,
    p.*,
    GROUP_CONCAT(pi.image_path) AS images
  FROM carts c
  JOIN products p ON c.productId = p.id
  LEFT JOIN product_images pi ON p.id = pi.product_id
  WHERE c.userId = ?
  GROUP BY c.id
`,
      [userId]
    );
//     const formatted = rows.map(row => ({
//   ...row,
//   images: row.images ? row.images.split(',') : []
// }));
    //changes_start
    const formatted = rows.map(row => ({
  ...row,
  images: row.images
    ? row.images.split(',').map(img => resolveImageUrl(img))
    : []
}));
//changes_end

return res.json({ success: true, data: formatted });

  } catch (err) {
    console.error('Error fetching cart for user:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// Controller: Update cart item quantity
export async function updateCartItem(req, res) {
  const { cartId } = req.params;
  const { quantity } = req.body;

  if (!quantity || quantity < 1) {
    return res.status(400).json({ success: false, message: 'Quantity must be at least 1' });
  }

  try {
    // Check if cart item exists
    const [cartItem] = await pool.query('SELECT * FROM carts WHERE id = ?', [cartId]);
    if (cartItem.length === 0) {
      return res.status(404).json({ success: false, message: 'Cart item not found' });
    }

    // Check product availability
    const [product] = await pool.query('SELECT availability FROM products WHERE id = ?', [cartItem[0].productId]);
    if (product[0].availability < quantity) {
      return res.status(400).json({ 
        success: false, 
        message: `Only ${product[0].availability} item(s) available in stock` 
      });
    }

    // Update quantity
    await pool.query('UPDATE carts SET quantity = ? WHERE id = ?', [quantity, cartId]);
    return res.json({ success: true, message: 'Cart item updated', data: { cartId, quantity } });
  } catch (err) {
    console.error('Error updating cart item:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// Controller: Remove item from cart
export async function removeCartItem(req, res) {
  const { cartId } = req.params;

  try {
    // Check if cart item exists
    const [cartItem] = await pool.query('SELECT id FROM carts WHERE id = ?', [cartId]);
    if (cartItem.length === 0) {
      return res.status(404).json({ success: false, message: 'Cart item not found' });
    }

    // Delete the cart item
    await pool.query('DELETE FROM carts WHERE id = ?', [cartId]);
    return res.json({ success: true, message: 'Item removed from cart', data: { cartId } });
  } catch (err) {
    console.error('Error removing cart item:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// Controller: Clear entire cart
export async function clearCart(req, res) {
  const { userId } = req.params;

  try {
    await pool.query('DELETE FROM carts WHERE userId = ?', [userId]);
    return res.json({ success: true, message: 'Cart cleared' });
  } catch (err) {
    console.error('Error clearing cart:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}
