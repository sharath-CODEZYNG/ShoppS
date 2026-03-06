import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import serveIndex from 'serve-index';
import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import userRoutes from './routes/userRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import pool from './config/db.js';
import { migrate as migrateImageUrl } from './migrations/001_add_image_url.js';
import { migrate as migrateImagesJson } from './migrations/002_add_images_json.js';
import axios from 'axios';

import recommendRoutes from "./routes/recommendRoutes.js";

// Load .env
dotenv.config();
const app = express();
const PORT = process.env.PORT || 4000 ||  10000;

// app.use(cors());
app.use(express.json());

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:4000",
  "https://shop-sphere-repo.vercel.app",
];

// app.use(cors({
//   origin: function (origin, callback) {
//     if (!origin || allowedOrigins.includes(origin)) {
//       callback(null, true);
//     } else {
//       callback(new Error("Not allowed by CORS"));
//     }
//   },
//   credentials: true
// }));


app.use("/api/recommend", recommendRoutes);


// Middleware - CORS FIRST - Allow multiple frontend ports
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true
};
app.use(cors(corsOptions));

// Handle preflight
app.options('*', cors(corsOptions));

app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies




// Serve uploaded images as static files with directory listing
app.use('/uploads', express.static('uploads'), serveIndex('uploads', { icons: true }));

// Health check
app.get('/health', async (req, res) => {
  try {
    // Simple DB check
    await pool.query('SELECT 1');
    return res.json({ success: true, message: 'OK' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'DB connection error' });
  }
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/admin', adminRoutes);
app.post("/chat", async (req, res) => {

  try {

    const userId = Number(req.body.user_id) || 0;

    const response = await axios.post(
      // "https://shopsphere-repo-2.onrender.com/chat",
      "http://localhost:8000/chat",
      {
        message: req.body.message,user_id:userId, session_id: req.body.session_id,
      }
    );

    res.json(response.data);

  } catch (err) {

    console.error("Chat error:", err.message);

    res.status(500).json({
      error: "RAG service not reachable"
    });

  }

});

// --- ADD THIS NEW GET ROUTE FOR SESSION MEMORY ---
app.get("/chat/session/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Forward the GET request to FastAPI (port 8000)
    const response = await axios.get(
      `http://localhost:8000/chat/session/${sessionId}`
    );
    
    // Send FastAPI's response back to React
    res.json(response.data);
    
  } catch (err) {
    console.error("Session fetch error:", err.message);
    res.status(err.response?.status || 500).json({
      error: "RAG session service not reachable"
    });
  }
});


app.delete("/chat/history/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;

    const response = await axios.delete(
      `http://localhost:8000/chat/history/${sessionId}`
    );

    res.json(response.data);
  } catch (err) {
    console.error("History delete error:", err.message);
    res.status(500).json({
      error: "RAG history service not reachable"
    });
  }
});
// --------------------------------------------------

// Start server with graceful fallback if primary port is unavailable
const tryListen = (port, isRetry = false) => {
  const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      if (!isRetry) {
        console.log(`Port ${port} is in use, trying port 4000...`);
        tryListen(4000, true);
      } else {
        console.error(`Ports ${PORT} and 4000 are both in use. Exiting.`);
        process.exit(1);
      }
    } else {
      throw err;
    }
  });
};


app.get("/chat/history/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;

    const response = await axios.get(
      `http://localhost:8000/chat/history/${sessionId}`
    );

    res.json(response.data);

  } catch (err) {
    console.error("History fetch error:", err.message);
    res.status(500).json({
      error: "RAG history service not reachable"
    });
  }
});

// Run lightweight migrations to ensure new columns/tables exist
(async function runMigrations() {
  try {
    // Check and add columns individually (safer SQL across MySQL versions)
    const cols = {
      views: 'INT DEFAULT 0',
      purchases: 'INT DEFAULT 0',
      rating_avg: 'DECIMAL(3,2) DEFAULT 0',
      rating_count: 'INT DEFAULT 0'
    };

    for (const [col, def] of Object.entries(cols)) {
      const [rows] = await pool.query(
        `SELECT COUNT(*) as cnt FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = ?`,
        [col]
      );
      if (rows[0].cnt === 0) {
        await pool.query(`ALTER TABLE products ADD COLUMN ${col} ${def}`);
        console.log(`Added column ${col}`);
      }
    }

    // Create product_ratings table if missing
    await pool.query(`CREATE TABLE IF NOT EXISTS product_ratings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      product_id INT NOT NULL,
      order_id INT DEFAULT NULL,
      rating TINYINT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )`);

    // Ensure order_id column exists and add unique index to prevent duplicate rating per order
    const [colCheck] = await pool.query(`SELECT COUNT(*) as cnt FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'product_ratings' AND column_name = 'order_id'`);
    if (colCheck[0].cnt === 0) {
      await pool.query(`ALTER TABLE product_ratings ADD COLUMN order_id INT DEFAULT NULL`);
    }
    // Add unique index if not exists
    try {
      await pool.query('CREATE UNIQUE INDEX ux_product_rating_order ON product_ratings(user_id, product_id, order_id)');
    } catch (e) {
      // ignore if index exists or DB doesn't support duplicate creation
    }

    console.log('Migrations checked/applied');
    // Run optional image migrations
    try { await migrateImageUrl() } catch(e) { /* ignore */ }
    try { await migrateImagesJson() } catch(e) { /* ignore */ }
  } catch (err) {
    console.error('Error running migrations:', err);
  } finally {
    tryListen(PORT);
  }
})();
