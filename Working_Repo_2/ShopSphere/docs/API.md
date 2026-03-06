API Reference — E‑commerce App
===============================

Base URL: http://localhost:3001/api

Overview
--------
This document lists the server API endpoints implemented in the backend.
Each endpoint shows HTTP method, path, required parameters/body, and notes about authorization and behavior.

Users
-----
- POST /api/users/register
  - Body: { name, email, password }
  - Response: 201 { success: true, data: { userId, name, email, role } }
  - Notes: Creates a user (password stored plaintext in current implementation).

- POST /api/users/login
  - Body: { email, password }
  - Response: 200 { success: true, data: { userId, name, email, role } }
  - Notes: Returns basic user info on success.

- GET /api/users/:id
  - Params: id (user id)
  - Response: 200 { success: true, data: { id, name, email, role, created_at } }

- GET /api/users
  - Response: 200 { success: true, data: [ users... ] }
  - Notes: Intended for admin use.

Products
--------
- GET /api/products
  - Response: 200 { success: true, data: [ products... ] }

- GET /api/products/:id
  - Params: id (product id)
  - Response: 200 { success: true, data: product }
  - Notes: Returns product without incrementing views. Use the view endpoint to count views.

- GET /api/products/category/:category
  - Params: category (string)
  - Response: 200 { success: true, data: [ products... ] }

- POST /api/products
  - Body: { name, category, brand, price, availability, description, features, tags, attributes_json }
  - Response: 201 { success: true, data: product }
  - Notes: Admin-only product creation (current implementation does not enforce auth).

- POST /api/products/:id/view
  - Params: id (product id)
  - Response: 200 { success: true, data: product }
  - Notes: Atomically increments `products.views` by 1 and returns the product. Clients should call this once per user view; frontend sets a local marker and does an optimistic update to avoid perceived delay.

- POST /api/products/:id/rate
  - Params: id (product id)
  - Body: { userId, rating, orderId }
  - Response: 200 { success: true, data: { rating_avg, rating_count } }
  - Notes: Requires `orderId`. The backend verifies the order belongs to `userId` and contains the product, and prevents duplicate ratings for the same (user_id, product_id, order_id). After insert it recomputes `rating_avg` and `rating_count` on the `products` row.

- GET /api/products/:id/order/:orderId/rating-status?userId=
  - Params: id (product id), orderId (order id); Query: userId
  - Response: 200 { success: true, data: { rated: boolean } }
  - Notes: Returns whether the given user already rated this order-item.

Cart
----
- POST /api/cart/add
  - Body: { userId, productId, quantity }
  - Response: 201 { success: true, data: { cartId, productId, quantity } } or 200 if updated
  - Notes: Adds or updates an item in the user's cart.

- GET /api/cart/:userId
  - Params: userId
  - Response: 200 { success: true, data: [ cart items joined with product info ] }

- PUT /api/cart/item/:cartId
  - Params: cartId
  - Body: { quantity }
  - Response: 200 { success: true, data: { cartId, quantity } }
  - Notes: Validates product availability before updating.

- DELETE /api/cart/item/:cartId
  - Params: cartId
  - Response: 200 { success: true, data: { cartId } }

- DELETE /api/cart/:userId
  - Params: userId
  - Response: 200 { success: true, message: 'Cart cleared' }

Orders
------
- POST /api/orders
  - Body: { userId, shippingAddress }
  - Response: 201 { success: true, data: { orderId, totalAmount, itemCount } }
  - Notes: Creates order from current cart, validates availability, decrements product availability, increments `products.purchases` and clears the cart.

- GET /api/orders/user/:userId
  - Params: userId
  - Response: 200 { success: true, data: [ orders ] }

- GET /api/orders/:id
  - Params: id
  - Response: 200 { success: true, data: order_with_items }
  - Notes: `data` contains order fields plus `items` array with product details.

- GET /api/orders
  - Response: 200 { success: true, data: [ orders with user info ] }
  - Notes: Admin listing.

- PUT /api/orders/:id/status
  - Params: id
  - Body: { status }
  - Response: 200 { success: true, message }
  - Notes: Admin-only status updates. Allowed statuses: pending, paid, shipped, delivered, cancelled.

Categories
----------
- GET /api/categories
  - Response: 200 { success: true, data: [ categories ] }

- GET /api/categories/:id
  - Params: id
  - Response: 200 { success: true, data: category }

- POST /api/categories
  - Body: { name, description }
  - Response: 201 { success: true, data: { categoryId, name, description } }
  - Notes: Admin-only.

- PUT /api/categories/:id
  - Params: id
  - Body: { name, description }
  - Response: 200 { success: true, message }
  - Notes: Admin-only.

- DELETE /api/categories/:id
  - Params: id
  - Response: 200 { success: true, message }
  - Notes: Admin-only.

Notes and Implementation Details
--------------------------------
- Base URL used by frontend: `http://localhost:3001/api` (see frontend API client at [frontend/src/services/api.js](frontend/src/services/api.js#L1)).
- Authentication: currently the app uses simple login that returns user info; no JWT/session token is implemented. Endpoints expect `userId` in request bodies or query params where needed.
- Ratings: The server-side rating flow now requires `orderId` and prevents duplicate ratings per (user, product, order). The frontend Orders UI calls the rating-status endpoint to persist disable state after submission.
- Views: `POST /api/products/:id/view` increments `products.views`. Frontend optimistically increments the UI and sends the increment request in the background to reduce perceived delay.



File: [docs/API.md](docs/API.md)
