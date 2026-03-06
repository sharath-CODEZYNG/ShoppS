// import pool from '../config/db.js';
 

// import axios from "axios";
// //chnages_start
// const BACKEND_BASE =
//   process.env.BACKEND_BASE_URL ||
//   "https://shopsphere-repo.onrender.com";

// // function resolveImageUrl(imagePath) {
// //   if (!imagePath) return null;
// //   if (imagePath.startsWith("http")) return imagePath;
// //   return `${BACKEND_BASE}/uploads/${imagePath}`;
// // }
// //changes_start
// function resolveImageUrl(imagePath) {
//   if (!imagePath || typeof imagePath !== "string") return null;

//   const clean = imagePath.trim();

//   if (clean.startsWith("http")) return clean;

//   return `${BACKEND_BASE}/uploads/${clean}`;
// }
// //chnages_end
// //changes_end
// const FASTAPI_BASE_URL =
//   process.env.FASTAPI_BASE_URL || "https://shopsphere-repo-2.onrender.com";


// // Controller: Create order from cart (ATOMIC TRANSACTION)
// export async function createOrder(req, res) {
//   const { userId, shippingAddress } = req.body;

//   // Validation: userId is required
//   if (!userId) {
//     return res.status(400).json({ success: false, message: 'userId is required' });
//   }

//   // Validation: userId must be a valid number
//   if (!Number.isInteger(userId) || userId < 1) {
//     return res.status(400).json({ success: false, message: 'userId must be a positive integer' });
//   }

//   let connection;
//   try {
//     // Get a connection for transaction
//     connection = await pool.getConnection();
    
//     console.log('\n=== TRANSACTION START: ORDER CREATION ===');
//     console.log('User:', userId);
    
//     // BEGIN TRANSACTION
//     await connection.beginTransaction();
//     console.log('✅ Transaction started');

//     // STEP 0: Verify user exists (foreign key validation)
//     console.log('Step 0: Verifying user exists...');
//     const [userRows] = await connection.query(
//       'SELECT id FROM users WHERE id = ?',
//       [userId]
//     );
    
//     if (userRows.length === 0) {
//       await connection.rollback();
//       console.log(`❌ User ${userId} not found, rolling back`);
//       return res.status(400).json({ 
//         success: false, 
//         message: `User ID ${userId} does not exist. Please ensure user is registered.` 
//       });
//     }
//     console.log(`✅ User ${userId} verified in database`);

//     // STEP 1: Get and lock cart items (SELECT FOR UPDATE)
//     console.log('Step 1: Fetching cart items...');
//     const [cartItems] = await connection.query(
//       `SELECT c.id as cartId, c.productId, c.quantity, p.price, p.availability 
//        FROM carts c 
//        JOIN products p ON c.productId = p.id 
//        WHERE c.userId = ? 
//        FOR UPDATE`,
//       [userId]
//     );
//     console.log(`✅ Found ${cartItems.length} items in cart`);

//     if (cartItems.length === 0) {
//       await connection.rollback();
//       console.log('❌ Cart is empty, rolling back transaction');
//       return res.status(400).json({ success: false, message: 'Cart is empty' });
//     }

//     // STEP 2: Validate availability
//     console.log('Step 2: Validating product availability...');
//     for (const item of cartItems) {
//       if (item.quantity > item.availability) {
//         await connection.rollback();
//         console.log(`❌ Insufficient stock for product ${item.productId}, rolling back`);
//         return res.status(400).json({ 
//           success: false, 
//           message: `Insufficient stock for product ID ${item.productId}` 
//         });
//       }
//     }
//     console.log('✅ All items have sufficient stock');

//     // STEP 3: Calculate order total
//     const totalAmount = cartItems.reduce(
//       (sum, item) => sum + (item.price * item.quantity), 
//       0
//     );
//     console.log(`Step 3: Total amount calculated: $${totalAmount}`);

//     // STEP 4: INSERT order
//     console.log('Step 4: Creating order record...');
//     const [orderResult] = await connection.query(
//       `INSERT INTO orders (user_id, total_amount, shipping_address, status, created_at) 
//        VALUES (?, ?, ?, 'pending', NOW())`,
//       [userId, totalAmount, shippingAddress || null]
//     );
//     const orderId = orderResult.insertId;
//     console.log(`✅ Order created with ID: ${orderId}`);

//     // STEP 5: INSERT order_items and UPDATE product availability
//     console.log('Step 5: Inserting order items and updating availability...');
//     for (const item of cartItems) {
//       await connection.query(
//         `INSERT INTO order_items (order_id, product_id, quantity, price) 
//          VALUES (?, ?, ?, ?)`,
//         [orderId, item.productId, item.quantity, item.price]
//       );

//       await connection.query(
//         `UPDATE products 
//          SET availability = availability - ?, purchases = purchases + ? 
//          WHERE id = ?`,
//         [item.quantity, item.quantity, item.productId]
//       );
//     }
//     console.log(`✅ Order items inserted for ${cartItems.length} products`);

//     // STEP 6: DELETE cart items (ATOMIC with order creation)
//     console.log('Step 6: Clearing cart...');
//     const [deleteResult] = await connection.query(
//       'DELETE FROM carts WHERE userId = ?',
//       [userId]
//     );
//     console.log(`✅ Cart cleared: ${deleteResult.affectedRows} rows deleted`);

//     // COMMIT TRANSACTION (all operations succeed or all rollback)
//     await connection.commit();
//     console.log('✅ Transaction committed successfully');
//     console.log('=== TRANSACTION END: SUCCESS ===\n');


//     // 🔥 Sync updated products to FastAPI (vector DB update)
//   for (const item of cartItems) {
//   try {
//     await axios.put(
//       `${FASTAPI_BASE_URL}/update-product-availability`,
//       null,
//       {
//         params: {
//           product_id: Number(item.productId)
//         },
//         timeout: 10000
//       }
//     );

//     console.log(`✅ Synced product ${item.productId} to FastAPI`);
//   } catch (err) {
//     console.error(`⚠️ FastAPI sync failed for product ${item.productId}:`,
//       err.response?.data || err.message
//     );
//   }
// }

//     return res.status(201).json({
//       success: true,
//       message: 'Order created successfully',
//       data: { orderId, totalAmount: Number(totalAmount.toFixed(2)), itemCount: cartItems.length }
//     });

//   } catch (err) {
//     if (connection) {
//       try {
//         await connection.rollback();
//         console.log('❌ Transaction rolled back due to error');
//       } catch (rollbackErr) {
//         console.error('Rollback error:', rollbackErr);
//       }
//     }
//     console.error('❌ Error creating order:', err);
//     console.log('=== TRANSACTION END: FAILED ===\n');
//     return res.status(500).json({ success: false, message: 'Server error' });
//   } finally {
//     if (connection) {
//       await connection.release();
//     }
//   }
// }




// // new voice 
// export async function createOrderFromItems(req, res) {
// const { userId, shippingAddress, items } = req.body;

// if (!userId) {
// return res.status(400).json({ success: false, message: 'userId is required' });
// }

// if (!Number.isInteger(userId) || userId < 1) {
// return res.status(400).json({ success: false, message: 'userId must be a positive integer' });
// }

// if (!Array.isArray(items) || items.length === 0) {
// return res.status(400).json({ success: false, message: 'items is required and must be a non-empty array' });
// }

// const normalizedItems = items
// .map((item) => ({
// productId: Number(item?.productId),
// quantity: Number(item?.quantity)
// }))
// .filter((item) => Number.isInteger(item.productId) && item.productId > 0 && Number.isInteger(item.quantity) && item.quantity > 0);

// if (normalizedItems.length === 0) {
// return res.status(400).json({ success: false, message: 'No valid items provided' });
// }

// let connection;
// try {
// connection = await pool.getConnection();
// await connection.beginTransaction();

// // Validate user existence
// const [userRows] = await connection.query(
// 'SELECT id FROM users WHERE id = ?',
// [userId]
// );

// if (userRows.length === 0) {
// await connection.rollback();
// return res.status(400).json({
// success: false,
// message: `User ID ${userId} does not exist. Please ensure user is registered.`
// });
// }

// // Merge duplicate products in request to avoid duplicate order_items rows
// const mergedMap = new Map();
// for (const item of normalizedItems) {
// const prev = mergedMap.get(item.productId) || 0;
// mergedMap.set(item.productId, prev + item.quantity);
// }
// const mergedItems = Array.from(mergedMap.entries()).map(([productId, quantity]) => ({ productId, quantity }));

// const productIds = mergedItems.map((item) => item.productId);
// const placeholders = productIds.map(() => '?').join(', ');

// // Lock products that are part of this order
// const [productRows] = await connection.query(
// `SELECT id, price, availability FROM products WHERE id IN (${placeholders}) FOR UPDATE`,
// productIds
// );

// const productMap = new Map(productRows.map((p) => [p.id, p]));

// // Validate product existence and stock
// for (const item of mergedItems) {
// const product = productMap.get(item.productId);
// if (!product) {
// await connection.rollback();
// return res.status(404).json({
// success: false,
// message: `Product ID ${item.productId} not found`
// });
// }

// if (item.quantity > Number(product.availability)) {
// await connection.rollback();
// return res.status(400).json({
// success: false,
// message: `Insufficient stock for product ID ${item.productId}`
// });
// }
// }

// const totalAmount = mergedItems.reduce((sum, item) => {
// const product = productMap.get(item.productId);
// return sum + (Number(product.price) * item.quantity);
// }, 0);

// const [orderResult] = await connection.query(
// `INSERT INTO orders (user_id, total_amount, shipping_address, status, created_at)
// VALUES (?, ?, ?, 'pending', NOW())`,
// [userId, totalAmount, shippingAddress || null]
// );
// const orderId = orderResult.insertId;

// for (const item of mergedItems) {
// const product = productMap.get(item.productId);

// await connection.query(
// `INSERT INTO order_items (order_id, product_id, quantity, price)
// VALUES (?, ?, ?, ?)`,
// [orderId, item.productId, item.quantity, product.price]
// );

// await connection.query(
// `UPDATE products
// SET availability = availability - ?, purchases = purchases + ?
// WHERE id = ?`,
// [item.quantity, item.quantity, item.productId]
// );
// }

// await connection.commit();

// for (const item of mergedItems) {
// try {
// await axios.put(
// `${FASTAPI_BASE_URL}/update-product-availability`,
// null,
// {
// params: {
// product_id: Number(item.productId)
// },
// timeout: 10000
// }
// );
// } catch (err) {
// console.error(`⚠️ FastAPI sync failed for product ${item.productId}:`,
// err.response?.data || err.message
// );
// }
// }

// return res.status(201).json({
// success: true,
// message: 'Order created successfully',
// data: {
// orderId,
// totalAmount: Number(totalAmount.toFixed(2)),
// itemCount: mergedItems.length
// }
// });
// } catch (err) {
// if (connection) {
// try {
// await connection.rollback();
// } catch (rollbackErr) {
// console.error('Rollback error:', rollbackErr);
// }
// }
// console.error('❌ Error creating voice order:', err);
// return res.status(500).json({ success: false, message: 'Server error' });
// } finally {
// if (connection) {
// await connection.release();
// }
// }
// }

// // Controller: Get order by ID
// export async function getOrderById(req, res) {
//   const { id } = req.params;

//   try {
//     // Get order details
//     const [orders] = await pool.query('SELECT * FROM orders WHERE id = ?', [id]);
    
//     if (orders.length === 0) {
//       return res.status(404).json({ success: false, message: 'Order not found' });
//     }

//     const order = orders[0];

//     // Get order items with product details
//     const [items] = await pool.query(
//       `SELECT 
//   oi.id,
//   oi.product_id,
//   oi.quantity,
//   oi.price,
//   p.name,
//   p.brand,
//   p.category,
//   GROUP_CONCAT(pi.image_path) AS images
// FROM order_items oi
// JOIN products p ON oi.product_id = p.id
// LEFT JOIN product_images pi ON p.id = pi.product_id
// WHERE oi.order_id = ?
// GROUP BY oi.id
// `,
//       [id]
//     );

//     // return res.json({
//     //   success: true,
//     //   data: { ...order, items }
//     // });
//     //changes_start
//     const formattedItems = items.map(item => ({
//   ...item,
//   images: item.images
//     ? item.images.split(',').map(img => resolveImageUrl(img))
//     : []
// }));

// return res.json({
//   success: true,
//   data: { ...order, items: formattedItems }
// });
//     //chages_end
//   } catch (err) {
//     console.error('Error fetching order:', err);
//     return res.status(500).json({ success: false, message: 'Server error' });
//   }
// }

// // Controller: Get orders for a user
// export async function getUserOrders(req, res) {
//   const { userId } = req.params;

//   try {
//     const [rows] = await pool.query(
//       'SELECT id, status, total_amount, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC',
//       [userId]
//     );

//     return res.json({ success: true, data: rows });
//   } catch (err) {
//     console.error('Error fetching user orders:', err);
//     return res.status(500).json({ success: false, message: 'Server error' });
//   }
// }

// // Controller: Get all orders (admin only)
// export async function getAllOrders(req, res) {
//   try {
//     const [rows] = await pool.query(
//       `SELECT o.id, o.user_id, o.status, o.total_amount, o.shipping_address, o.created_at, 
//               u.name, u.email 
//        FROM orders o 
//        JOIN users u ON o.user_id = u.id 
//        ORDER BY o.created_at DESC`
//     );

//     return res.json({ success: true, data: rows });
//   } catch (err) {
//     console.error('Error fetching all orders:', err);
//     return res.status(500).json({ success: false, message: 'Server error' });
//   }
// }

// // Controller: Update order status (admin only)
// export async function updateOrderStatus(req, res) {
//   const { id } = req.params;
//   const { status } = req.body;

//   if (!['pending', 'paid', 'shipped', 'delivered', 'cancelled'].includes(status)) {
//     return res.status(400).json({ success: false, message: 'Invalid order status' });
//   }

//   try {
//     const [result] = await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
    
//     if (result.affectedRows === 0) {
//       return res.status(404).json({ success: false, message: 'Order not found' });
//     }

//     return res.json({ success: true, message: 'Order status updated successfully' });
//   } catch (err) {
//     console.error('Error updating order status:', err);
//     return res.status(500).json({ success: false, message: 'Server error' });
//   }
// }



// new def

import pool from '../config/db.js';
 

import axios from "axios";
import nodemailer from "nodemailer";
//chnages_start
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

  const clean = imagePath.trim();

  if (clean.startsWith("http")) return clean;

  return `${BACKEND_BASE}/uploads/${clean}`;
}
//chnages_end
//changes_end
const FASTAPI_BASE_URL =
  process.env.FASTAPI_BASE_URL || "https://shopsphere-repo-2.onrender.com";

const orderEmailTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendOrderConfirmationEmail({
  userId,
  orderId,
  totalAmount,
  itemCount,
  shippingAddress,
  items = []
}) {
  try {
    const [users] = await pool.query(
      "SELECT name, email FROM users WHERE id = ? LIMIT 1",
      [userId]
    );

    if (!users.length || !users[0].email) return;

    const user = users[0];
    const lines = items.length
      ? items.map((item) => `${item.quantity} x ${item.name} @ ₹${Number(item.price || 0).toFixed(2)}`).join("\n")
      : "Items are available in your order details page.";

    const text = [
      `Hi ${user.name || "Customer"},`,
      "",
      `Your order has been confirmed on ShopSphere.`,
      `Order ID: ${orderId}`,
      `Total Amount: ₹${Number(totalAmount || 0).toFixed(2)}`,
      `Items: ${Number(itemCount || 0)}`,
      `Shipping Address: ${shippingAddress || "Not provided"}`,
      "",
      "Ordered Items:",
      lines,
      "",
      "Thank you for shopping with ShopSphere."
    ].join("\n");

    await orderEmailTransporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: user.email,
      subject: `ShopSphere Order Confirmation #${orderId}`,
      text
    });

    console.log(`✅ Order confirmation email sent to ${user.email} for order ${orderId}`);
  } catch (error) {
    console.error("⚠️ Failed to send order confirmation email:", error.message);
  }
}


// Controller: Create order from cart (ATOMIC TRANSACTION)
export async function createOrder(req, res) {
  const { userId, shippingAddress } = req.body;

  // Validation: userId is required
  if (!userId) {
    return res.status(400).json({ success: false, message: 'userId is required' });
  }

  // Validation: userId must be a valid number
  if (!Number.isInteger(userId) || userId < 1) {
    return res.status(400).json({ success: false, message: 'userId must be a positive integer' });
  }

  let connection;
  try {
    // Get a connection for transaction
    connection = await pool.getConnection();
    
    console.log('\n=== TRANSACTION START: ORDER CREATION ===');
    console.log('User:', userId);
    
    // BEGIN TRANSACTION
    await connection.beginTransaction();
    console.log('✅ Transaction started');

    // STEP 0: Verify user exists (foreign key validation)
    console.log('Step 0: Verifying user exists...');
    const [userRows] = await connection.query(
      'SELECT id FROM users WHERE id = ?',
      [userId]
    );
    
    if (userRows.length === 0) {
      await connection.rollback();
      console.log(`❌ User ${userId} not found, rolling back`);
      return res.status(400).json({ 
        success: false, 
        message: `User ID ${userId} does not exist. Please ensure user is registered.` 
      });
    }
    console.log(`✅ User ${userId} verified in database`);

    // STEP 1: Get and lock cart items (SELECT FOR UPDATE)
    console.log('Step 1: Fetching cart items...');
    const [cartItems] = await connection.query(
      `SELECT c.id as cartId, c.productId, c.quantity, p.name, p.price, p.availability 
       FROM carts c 
       JOIN products p ON c.productId = p.id 
       WHERE c.userId = ? 
       FOR UPDATE`,
      [userId]
    );
    console.log(`✅ Found ${cartItems.length} items in cart`);

    if (cartItems.length === 0) {
      await connection.rollback();
      console.log('❌ Cart is empty, rolling back transaction');
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    // STEP 2: Validate availability
    console.log('Step 2: Validating product availability...');
    for (const item of cartItems) {
      if (item.quantity > item.availability) {
        await connection.rollback();
        console.log(`❌ Insufficient stock for product ${item.productId}, rolling back`);
        return res.status(400).json({ 
          success: false, 
          message: `Insufficient stock for product ID ${item.productId}` 
        });
      }
    }
    console.log('✅ All items have sufficient stock');

    // STEP 3: Calculate order total
    const totalAmount = cartItems.reduce(
      (sum, item) => sum + (item.price * item.quantity), 
      0
    );
    console.log(`Step 3: Total amount calculated: $${totalAmount}`);

    // STEP 4: INSERT order
    console.log('Step 4: Creating order record...');
    const [orderResult] = await connection.query(
      `INSERT INTO orders (user_id, total_amount, shipping_address, status, created_at) 
       VALUES (?, ?, ?, 'pending', NOW())`,
      [userId, totalAmount, shippingAddress || null]
    );
    const orderId = orderResult.insertId;
    console.log(`✅ Order created with ID: ${orderId}`);

    // STEP 5: INSERT order_items and UPDATE product availability
    console.log('Step 5: Inserting order items and updating availability...');
    for (const item of cartItems) {
      await connection.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price) 
         VALUES (?, ?, ?, ?)`,
        [orderId, item.productId, item.quantity, item.price]
      );

      await connection.query(
        `UPDATE products 
         SET availability = availability - ?, purchases = purchases + ? 
         WHERE id = ?`,
        [item.quantity, item.quantity, item.productId]
      );
    }
    console.log(`✅ Order items inserted for ${cartItems.length} products`);

    // STEP 6: DELETE cart items (ATOMIC with order creation)
    console.log('Step 6: Clearing cart...');
    const [deleteResult] = await connection.query(
      'DELETE FROM carts WHERE userId = ?',
      [userId]
    );
    console.log(`✅ Cart cleared: ${deleteResult.affectedRows} rows deleted`);

    // COMMIT TRANSACTION (all operations succeed or all rollback)
    await connection.commit();
    console.log('✅ Transaction committed successfully');
    console.log('=== TRANSACTION END: SUCCESS ===\n');


    // 🔥 Sync updated products to FastAPI (vector DB update)
  for (const item of cartItems) {
  try {
    await axios.put(
      `${FASTAPI_BASE_URL}/update-product-availability`,
      null,
      {
        params: {
          product_id: Number(item.productId)
        },
        timeout: 10000
      }
    );

    console.log(`✅ Synced product ${item.productId} to FastAPI`);
  } catch (err) {
    console.error(`⚠️ FastAPI sync failed for product ${item.productId}:`,
      err.response?.data || err.message
    );
  }
}

    await sendOrderConfirmationEmail({
      userId,
      orderId,
      totalAmount,
      itemCount: cartItems.length,
      shippingAddress,
      items: cartItems.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price
      }))
    });

    return res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: { orderId, totalAmount: Number(totalAmount.toFixed(2)), itemCount: cartItems.length }
    });

  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
        console.log('❌ Transaction rolled back due to error');
      } catch (rollbackErr) {
        console.error('Rollback error:', rollbackErr);
      }
    }
    console.error('❌ Error creating order:', err);
    console.log('=== TRANSACTION END: FAILED ===\n');
    return res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    if (connection) {
      await connection.release();
    }
  }
}




// new voice 
export async function createOrderFromItems(req, res) {
const { userId, shippingAddress, items } = req.body;

if (!userId) {
return res.status(400).json({ success: false, message: 'userId is required' });
}

if (!Number.isInteger(userId) || userId < 1) {
return res.status(400).json({ success: false, message: 'userId must be a positive integer' });
}

if (!Array.isArray(items) || items.length === 0) {
return res.status(400).json({ success: false, message: 'items is required and must be a non-empty array' });
}

const normalizedItems = items
.map((item) => ({
productId: Number(item?.productId),
quantity: Number(item?.quantity)
}))
.filter((item) => Number.isInteger(item.productId) && item.productId > 0 && Number.isInteger(item.quantity) && item.quantity > 0);

if (normalizedItems.length === 0) {
return res.status(400).json({ success: false, message: 'No valid items provided' });
}

let connection;
try {
connection = await pool.getConnection();
await connection.beginTransaction();

// Validate user existence
const [userRows] = await connection.query(
'SELECT id FROM users WHERE id = ?',
[userId]
);

if (userRows.length === 0) {
await connection.rollback();
return res.status(400).json({
success: false,
message: `User ID ${userId} does not exist. Please ensure user is registered.`
});
}

// Merge duplicate products in request to avoid duplicate order_items rows
const mergedMap = new Map();
for (const item of normalizedItems) {
const prev = mergedMap.get(item.productId) || 0;
mergedMap.set(item.productId, prev + item.quantity);
}
const mergedItems = Array.from(mergedMap.entries()).map(([productId, quantity]) => ({ productId, quantity }));

const productIds = mergedItems.map((item) => item.productId);
const placeholders = productIds.map(() => '?').join(', ');

// Lock products that are part of this order
const [productRows] = await connection.query(
`SELECT id, name, price, availability FROM products WHERE id IN (${placeholders}) FOR UPDATE`,
productIds
);

const productMap = new Map(productRows.map((p) => [p.id, p]));

// Validate product existence and stock
for (const item of mergedItems) {
const product = productMap.get(item.productId);
if (!product) {
await connection.rollback();
return res.status(404).json({
success: false,
message: `Product ID ${item.productId} not found`
});
}

if (item.quantity > Number(product.availability)) {
await connection.rollback();
return res.status(400).json({
success: false,
message: `Insufficient stock for product ID ${item.productId}`
});
}
}

const totalAmount = mergedItems.reduce((sum, item) => {
const product = productMap.get(item.productId);
return sum + (Number(product.price) * item.quantity);
}, 0);

const [orderResult] = await connection.query(
`INSERT INTO orders (user_id, total_amount, shipping_address, status, created_at)
VALUES (?, ?, ?, 'pending', NOW())`,
[userId, totalAmount, shippingAddress || null]
);
const orderId = orderResult.insertId;

for (const item of mergedItems) {
const product = productMap.get(item.productId);

await connection.query(
`INSERT INTO order_items (order_id, product_id, quantity, price)
VALUES (?, ?, ?, ?)`,
[orderId, item.productId, item.quantity, product.price]
);

await connection.query(
`UPDATE products
SET availability = availability - ?, purchases = purchases + ?
WHERE id = ?`,
[item.quantity, item.quantity, item.productId]
);
}

await connection.commit();

for (const item of mergedItems) {
try {
await axios.put(
`${FASTAPI_BASE_URL}/update-product-availability`,
null,
{
params: {
product_id: Number(item.productId)
},
timeout: 10000
}
);
} catch (err) {
console.error(`⚠️ FastAPI sync failed for product ${item.productId}:`,
err.response?.data || err.message
);
}
}

await sendOrderConfirmationEmail({
userId,
orderId,
totalAmount,
itemCount: mergedItems.length,
shippingAddress,
items: mergedItems.map((item) => {
const product = productMap.get(item.productId);
return {
name: product?.name || `Product ${item.productId}`,
quantity: item.quantity,
price: product?.price
};
})
});

return res.status(201).json({
success: true,
message: 'Order created successfully',
data: {
orderId,
totalAmount: Number(totalAmount.toFixed(2)),
itemCount: mergedItems.length
}
});
} catch (err) {
if (connection) {
try {
await connection.rollback();
} catch (rollbackErr) {
console.error('Rollback error:', rollbackErr);
}
}
console.error('❌ Error creating voice order:', err);
return res.status(500).json({ success: false, message: 'Server error' });
} finally {
if (connection) {
await connection.release();
}
}
}

// Controller: Get order by ID
export async function getOrderById(req, res) {
  const { id } = req.params;

  try {
    // Get order details
    const [orders] = await pool.query('SELECT * FROM orders WHERE id = ?', [id]);
    
    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const order = orders[0];

    // Get order items with product details
    const [items] = await pool.query(
      `SELECT 
  oi.id,
  oi.product_id,
  oi.quantity,
  oi.price,
  p.name,
  p.brand,
  p.category,
  GROUP_CONCAT(pi.image_path) AS images
FROM order_items oi
JOIN products p ON oi.product_id = p.id
LEFT JOIN product_images pi ON p.id = pi.product_id
WHERE oi.order_id = ?
GROUP BY oi.id
`,
      [id]
    );

    // return res.json({
    //   success: true,
    //   data: { ...order, items }
    // });
    //changes_start
    const formattedItems = items.map(item => ({
  ...item,
  images: item.images
    ? item.images.split(',').map(img => resolveImageUrl(img))
    : []
}));

return res.json({
  success: true,
  data: { ...order, items: formattedItems }
});
    //chages_end
  } catch (err) {
    console.error('Error fetching order:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// Controller: Get orders for a user
export async function getUserOrders(req, res) {
  const { userId } = req.params;

  try {
    const [rows] = await pool.query(
      'SELECT id, status, total_amount, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Error fetching user orders:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// Controller: Get all orders (admin only)
export async function getAllOrders(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT o.id, o.user_id, o.status, o.total_amount, o.shipping_address, o.created_at, 
              u.name, u.email 
       FROM orders o 
       JOIN users u ON o.user_id = u.id 
       ORDER BY o.created_at DESC`
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Error fetching all orders:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// Controller: Update order status (admin only)
export async function updateOrderStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  if (!['pending', 'paid', 'shipped', 'delivered', 'cancelled'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid order status' });
  }

  try {
    const [result] = await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    return res.json({ success: true, message: 'Order status updated successfully' });
  } catch (err) {
    console.error('Error updating order status:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}
