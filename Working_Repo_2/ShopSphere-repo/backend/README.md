# Codezyng Internship — E-commerce Backend

This is a simple Node.js + Express backend for the Codezyng internship project.

Tech stack:
- Node.js
- Express.js
- MySQL (mysql2)
- dotenv
- cors

Quick setup

1. Ensure MySQL is running and you have the credentials.
2. Import the provided `schema.sql` into your MySQL server to create `ecommerce_db` and populate products:

```bash
mysql -u root -p < schema.sql
```

3. Copy `.env` and fill in values:

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_db_password
DB_NAME=ecommerce_db
PORT=5000
```

4. Install dependencies

```bash
npm install
```

5. Run the server

```bash
npm start
```

API Endpoints
- GET /api/products — list all products
- GET /api/products/category/:category — products by category
- GET /api/products/:id — product details
- POST /api/cart/add — add item to cart (body: `{ userId, productId, quantity }`)
- GET /api/cart/:userId — get cart items for a user

Notes
- The `schema.sql` file must not be modified per project instructions. It is expected to contain the `ecommerce_db` database and 60 products.
- This backend creates a `carts` table at runtime if it does not exist. It does not alter `schema.sql`.
- Keep code simple and easy to extend for internship review.
