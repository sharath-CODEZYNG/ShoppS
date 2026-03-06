import axios from "axios";
import pool from "../config/db.js";
import cloudinary from "../config/cloudinary.js";

const ACTION_WEIGHTS = {
  view: 1,
  cart: 3,
  add_to_cart: 3,
  addtocart: 3,
  purchase: 5
};

const ACTIVITY_TABLE_CANDIDATES = ["user_activity", "user_Activity"];
const FASTAPI_BASE_URL = process.env.FASTAPI_BASE_URL || "https://shopsphere-repo-2.onrender.com";
const BACKEND_BASE =
  (process.env.BACKEND_BASE_URL || "https://shopsphere-repo.onrender.com").replace(/\/+$/, "");

function toPositiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function pickColumn(columns, candidates) {
  const lowerMap = new Map(columns.map((c) => [String(c).toLowerCase(), c]));
  for (const name of candidates) {
    const hit = lowerMap.get(name.toLowerCase());
    if (hit) return hit;
  }
  return null;
}

function isSafeIdentifier(value) {
  return typeof value === "string" && /^[A-Za-z0-9_]+$/.test(value);
}

function getRecencyWeight(activityTime) {
  if (!activityTime) return 1.0;
  const now = Date.now();
  const ts = new Date(activityTime).getTime();
  if (!Number.isFinite(ts)) return 1.0;

  const hours = Math.max(0, (now - ts) / (1000 * 60 * 60));

  if (hours <= 1) return 3.0;
  if (hours <= 24) return 2.5;
  if (hours <= 72) return 2.0;
  if (hours <= 168) return 1.5;
  return 1.0;
}

function toActionTag(action) {
  const a = String(action || "").toLowerCase();
  if (a === "purchase") return "Based on your recent activity";
  if (a === "cart" || a === "add_to_cart" || a === "addtocart") {
    return "Because you added similar items to cart";
  }
  return "Based on what you viewed recently";
}

const TOKEN_STOPWORDS = new Set([
  "the", "and", "for", "with", "pack", "combo", "set", "piece", "pcs", "of",
  "a", "an", "to", "in", "on", "by", "new", "best", "fresh", "premium"
]);

const NON_VEG_TOKENS = new Set([
  "chicken", "mutton", "fish", "prawn", "prawns", "egg", "eggs", "meat", "sausage", "sausages"
]);

const COMPLEMENT_RULES = [
  { trigger: ["mouse"], boost: ["keyboard", "keypad", "mousepad", "wireless", "gaming"] },
  { trigger: ["keyboard"], boost: ["mouse", "wireless", "gaming"] },
  { trigger: ["laptop"], boost: ["mouse", "keyboard", "stand", "cooling", "bag"] },
  { trigger: ["headphone", "headphones", "earphone", "earphones"], boost: ["speaker", "earbuds", "bluetooth"] }
];

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !TOKEN_STOPWORDS.has(t));
}

function buildIntentProfile(rows) {
  const categoryWeights = new Map();
  const brandWeights = new Map();
  const tokenWeights = new Map();

  for (const row of rows) {
    const action = String(row.action || "").toLowerCase();
    const weight = (ACTION_WEIGHTS[action] || 1) * getRecencyWeight(row.activity_time);

    const category = String(row.category || "").toLowerCase().trim();
    const brand = String(row.brand || "").toLowerCase().trim();
    if (category) categoryWeights.set(category, (categoryWeights.get(category) || 0) + weight);
    if (brand) brandWeights.set(brand, (brandWeights.get(brand) || 0) + weight);

    for (const token of tokenize(row.name)) {
      tokenWeights.set(token, (tokenWeights.get(token) || 0) + weight);
    }
  }

  return { categoryWeights, brandWeights, tokenWeights };
}

function getComplementBoostTokens(top) {
  const topTokens = new Set(tokenize(`${top?.name || ""} ${top?.category || ""}`));
  const boosts = new Set();

  for (const rule of COMPLEMENT_RULES) {
    const matched = rule.trigger.some((t) => topTokens.has(t));
    if (!matched) continue;
    for (const b of rule.boost) boosts.add(b);
  }

  const hasNonVegIntent = Array.from(topTokens).some((t) => NON_VEG_TOKENS.has(t));
  if (hasNonVegIntent) {
    for (const t of NON_VEG_TOKENS) boosts.add(t);
  }

  return boosts;
}

function scoreCandidate(product, index, ctx) {
  const topCategory = String(ctx.top?.category || "").toLowerCase().trim();
  const topBrand = String(ctx.top?.brand || "").toLowerCase().trim();
  const productCategory = String(product?.category || "").toLowerCase().trim();
  const productBrand = String(product?.brand || "").toLowerCase().trim();
  const productTokens = tokenize(product?.name);

  let score = Math.max(0, 100 - index);

  if (topCategory && productCategory === topCategory) score += 80;
  if (topBrand && productBrand === topBrand) score += 40;

  score += (ctx.profile.categoryWeights.get(productCategory) || 0) * 8;
  score += (ctx.profile.brandWeights.get(productBrand) || 0) * 5;

  for (const token of productTokens) {
    score += Math.min(20, (ctx.profile.tokenWeights.get(token) || 0) * 3);
    if (ctx.complementTokens.has(token)) score += 28;
  }

  if (ctx.nonVegFocused && productTokens.some((t) => NON_VEG_TOKENS.has(t))) {
    score += 60;
  }

  return score;
}

function resolveImageUrl(imagePath) {
  if (!imagePath || typeof imagePath !== "string") return null;

  const cleanPath = imagePath.trim().replace(/\\/g, "/");
  if (!cleanPath) return null;

  if (/^https?:\/\//i.test(cleanPath)) {
    return cleanPath;
  }

  const normalized = cleanPath.replace(/^\.\//, "").replace(/^\/+/, "");

  if (normalized.startsWith("uploads/")) {
    return `${BACKEND_BASE}/${normalized}`;
  }

  const isLikelyCloudinaryPublicId =
    normalized.startsWith("shopsphere_products/") ||
    (!normalized.includes(".") && !normalized.startsWith("uploads/"));

  if (isLikelyCloudinaryPublicId) {
    return cloudinary.url(normalized, { secure: true });
  }

  if (!normalized.includes("/")) {
    if (normalized.includes(".")) return `${BACKEND_BASE}/uploads/${normalized}`;
    return cloudinary.url(normalized, { secure: true });
  }

  return `${BACKEND_BASE}/uploads/${normalized}`;
}

function buildBubbleFromProduct(product, tagText = "Recommended for you", action = "view") {
  return {
    text: `${tagText}: Explore ${product.name}${product?.category ? ` in ${product.category}` : ""}.`,
    tag: tagText,
    productId: product.id,
    productName: product.name,
    category: product.category || null,
    action
  };
}

async function fetchProductsByIdsOrdered(ids) {
  if (!ids.length) return [];

  // Preserve ranking order while removing duplicate product IDs.
  const orderedUniqueIds = [];
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    orderedUniqueIds.push(id);
  }

  const [rows] = await pool.query(
    `
    SELECT
      p.id,
      p.name,
      p.category,
      p.brand,
      p.price,
      p.availability,
      p.purchases,
      p.views,
      p.rating_avg,
      p.rating_count,
      pi.image_path
    FROM products p
    LEFT JOIN product_images pi ON p.id = pi.product_id
    WHERE p.id IN (?)
    `,
    [orderedUniqueIds]
  );

  const byId = new Map();
  for (const row of rows) {
    if (!byId.has(row.id)) {
      byId.set(row.id, {
        id: row.id,
        name: row.name,
        category: row.category,
        brand: row.brand,
        price: row.price,
        availability: row.availability,
        purchases: Number(row.purchases || 0),
        views: Number(row.views || 0),
        rating_avg: Number(row.rating_avg || 0),
        rating_count: Number(row.rating_count || 0),
        images: []
      });
    }

    if (row.image_path) {
      const url = resolveImageUrl(row.image_path);
      if (url) byId.get(row.id).images.push(url);
    }
  }

  return orderedUniqueIds.map((id) => byId.get(id)).filter(Boolean);
}

async function fetchPopularProducts(limit = 10) {
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 10));

  try {
    const response = await axios.get(`${FASTAPI_BASE_URL}/recommend/popular`, {
      params: { limit: safeLimit },
      timeout: 10000
    });

    const recommended = response?.data?.products || [];
    const ids = recommended
      .map((p) => Number(p?.id || p?.product_id))
      .filter((id) => Number.isInteger(id) && id > 0);

    if (!ids.length) return [];

    const withImages = await fetchProductsByIdsOrdered(ids);
    return withImages.slice(0, safeLimit);
  } catch (error) {
    console.error("Error fetching popular products from FastAPI, falling back to DB:", error.message);

    const [rows] = await pool.query(
      `
      SELECT
        p.id,
        p.name,
        p.category,
        p.brand,
        p.price,
        p.availability,
        p.purchases,
        p.views,
        p.rating_avg,
        p.rating_count,
        pi.image_path
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      ORDER BY
        (0.5 * COALESCE(p.purchases, 0) +
         0.2 * COALESCE(p.views, 0) +
         0.2 * COALESCE(p.rating_avg, 0) +
         0.1 * COALESCE(p.rating_count, 0)) DESC
      LIMIT ?
      `,
      [safeLimit * 3]
    );

    const map = new Map();
    for (const row of rows) {
      if (!map.has(row.id)) {
        map.set(row.id, {
          id: row.id,
          name: row.name,
          category: row.category,
          brand: row.brand,
          price: row.price,
          availability: row.availability,
          purchases: Number(row.purchases || 0),
          views: Number(row.views || 0),
          rating_avg: Number(row.rating_avg || 0),
          rating_count: Number(row.rating_count || 0),
          images: []
        });
      }

      if (row.image_path) {
        const url = resolveImageUrl(row.image_path);
        if (url) map.get(row.id).images.push(url);
      }
    }

    return Array.from(map.values()).slice(0, safeLimit);
  }
}

async function fetchPersonalizedProducts(userId, limit = 10) {
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 10));
  const safeUserId = toPositiveInt(userId);

  if (!safeUserId) return [];

  try {
    const response = await axios.get(`${FASTAPI_BASE_URL}/recommend/personal/${safeUserId}`, {
      params: { limit: safeLimit },
      timeout: 10000
    });

    const recommended = response?.data?.products || [];
    const ids = recommended
      .map((p) => Number(p?.id || p?.product_id))
      .filter((id) => Number.isInteger(id) && id > 0);

    if (!ids.length) return [];

    const withImages = await fetchProductsByIdsOrdered(ids);
    return withImages.slice(0, safeLimit);
  } catch (error) {
    console.error("Error fetching personalized products from FastAPI, falling back to popular:", error.message);
    return fetchPopularProducts(safeLimit);
  }
}

async function resolveActivityShape(executor) {
  for (const tableName of ACTIVITY_TABLE_CANDIDATES) {
    const [tableRows] = await executor.query(
      `SELECT TABLE_NAME
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
       LIMIT 1`,
      [tableName]
    );

    if (!tableRows.length) continue;

    const [columnRows] = await executor.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
      [tableName]
    );

    const columns = columnRows.map((r) => r.COLUMN_NAME);
    const userCol = pickColumn(columns, ["user_id", "userid", "userId", "user"]);
    const productCol = pickColumn(columns, ["product_id", "productid", "productId", "product"]);
    const actionCol = pickColumn(columns, ["action", "activity", "activity_type", "event_type", "type"]);
    const timeCol = pickColumn(columns, ["timestamp", "created_at", "activity_time", "createdAt", "time"]);

    if (!userCol || !productCol || !actionCol) continue;
    if (![tableName, userCol, productCol, actionCol, timeCol || "x"].every(isSafeIdentifier)) continue;

    return { tableName, userCol, productCol, actionCol, timeCol };
  }

  return null;
}


// =======================================
// GET POPULAR PRODUCTS
// =======================================
export const getPopularProducts = async (req, res) => {

  try {
    const limit = Number(req.query.limit) || 10;
    const products = await fetchPopularProducts(limit);
    return res.status(200).json({
      status: "success",
      recommendation_type: "popularity",
      count: products.length,
      products
    });

  }
  catch (error) {

    console.error("Error fetching popular products:", error.message);

    return res.status(500).json({
      status: "error",
      message: "Failed to fetch popular products"
    });

  }

};

// =======================================
// GET TRENDING PRODUCTS (POPULAR OR PERSONAL)
// =======================================
export const getTrendingProducts = async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;
    const userId = toPositiveInt(req.query.userId || req.params.userId);

    if (!userId) {
      const products = await fetchPopularProducts(limit);
      return res.status(200).json({
        status: "success",
        recommendation_type: "popularity",
        count: products.length,
        products
      });
    }

    const products = await fetchPersonalizedProducts(userId, limit);
    return res.status(200).json({
      status: "success",
      recommendation_type: "personalized",
      count: products.length,
      products
    });
  } catch (error) {
    console.error("Error fetching trending products:", error.message);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch trending products"
    });
  }
};

// =======================================
// GET CHAT BUBBLE RECOMMENDATION
// =======================================
export const getChatBubbleRecommendation = async (req, res) => {
  try {
    const userId = toPositiveInt(req.params.userId || req.query.userId);
    if (!userId) {
      return res.status(400).json({
        status: "error",
        message: "Valid userId is required"
      });
    }
    const limit = Math.max(3, Number(req.query.limit) || 3);
    const response = await axios.get(`${FASTAPI_BASE_URL}/recommend/personal/${userId}`, {
      params: { limit },
      timeout: 10000
    });

    const recommendationType = response?.data?.recommendation_type || "personalized";
    const rawProducts = Array.isArray(response?.data?.products) ? response.data.products : [];
    const ids = rawProducts
      .map((p) => Number(p?.id || p?.product_id))
      .filter((id) => Number.isInteger(id) && id > 0);

    const normalizedProducts = ids.length
      ? await fetchProductsByIdsOrdered(ids)
      : rawProducts
          .map((p) => ({
            id: Number(p?.id || p?.product_id) || null,
            name: p?.name || null,
            category: p?.category || null
          }))
          .filter((p) => p.id || p.name);

    const tagText =
      recommendationType === "popular_fallback" ? "Trending now" : "Based on your recent activity";

    let bubbles = normalizedProducts.slice(0, 3).map((product) =>
      buildBubbleFromProduct(product, tagText, "personal")
    );

    if (!bubbles.length) {
      bubbles = rawProducts
        .map((p) => ({
          text: String(p?.content || "").trim(),
          tag: tagText,
          productId: Number(p?.id || p?.product_id) || null,
          productName: null,
          category: null,
          action: "personal"
        }))
        .filter((b) => b.text)
        .slice(0, 3);
    }

    return res.status(200).json({
      status: "success",
      hasRecommendation: bubbles.length > 0,
      recommendationType,
      bubbles
    });
  } catch (error) {
    console.error("Error creating chat bubble recommendation:", error.message);
    return res.status(500).json({
      status: "error",
      message: "Failed to generate chat bubble recommendation"
    });
  }
};

// //changes
// import axios from "axios";
// import pool from "../config/db.js";
// import cloudinary from "../config/cloudinary.js";

// const BACKEND_BASE =
//   (process.env.BACKEND_BASE_URL ||
//    "https://shopsphere-repo.onrender.com").replace(/\/+$/, "");

// const FASTAPI_BASE_URL =
//   process.env.FASTAPI_BASE_URL ||
//   "https://shopsphere-repo-2.onrender.com";


// // =======================================
// // Resolve Image URL (Same logic as productController)
// // =======================================
// function resolveImageUrl(imagePath) {
//   if (!imagePath || typeof imagePath !== "string") return null;

//   const cleanPath = imagePath.trim().replace(/\\/g, "/");
//   if (!cleanPath) return null;

//   // Already full URL (Cloudinary / external)
//   if (/^https?:\/\//i.test(cleanPath)) {
//     return cleanPath;
//   }

//   const normalized = cleanPath.replace(/^\.\//, "").replace(/^\/+/, "");

//   if (normalized.startsWith("uploads/")) {
//     return `${BACKEND_BASE}/${normalized}`;
//   }

//   if (
//     normalized.startsWith("shopsphere_products/") ||
//     (!normalized.includes(".") && !normalized.startsWith("uploads/"))
//   ) {
//     return cloudinary.url(normalized, { secure: true });
//   }

//   if (!normalized.includes("/")) {
//     if (normalized.includes(".")) {
//       return `${BACKEND_BASE}/uploads/${normalized}`;
//     }
//     return cloudinary.url(normalized, { secure: true });
//   }

//   return `${BACKEND_BASE}/uploads/${normalized}`;
// }


// // =======================================
// // GET POPULAR PRODUCTS
// // =======================================
// export const getPopularProducts = async (req, res) => {
//   try {

//     // 🔥 1️⃣ Get recommended products from FastAPI
//     const response = await axios.get(
//       `${FASTAPI_BASE_URL}/recommend/popular`
//     );

//     const recommended = response.data || [];

//     if (!recommended.length) {
//       return res.status(200).json([]);
//     }

//     // 🔥 2️⃣ Extract product IDs
//     const ids = recommended.map(p => p.id);

//     // 🔥 3️⃣ Fetch images from MySQL
//     const [rows] = await pool.query(
//       `
//       SELECT p.*, pi.image_path
//       FROM products p
//       LEFT JOIN product_images pi
//       ON p.id = pi.product_id
//       WHERE p.id IN (?)
//       `,
//       [ids]
//     );

//     // 🔥 4️⃣ Group images per product
//     const map = {};

//     rows.forEach(row => {

//       if (!map[row.id]) {
//         map[row.id] = {
//           id: row.id,
//           name: row.name,
//           category: row.category,
//           brand: row.brand,
//           price: row.price,
//           availability: row.availability,
//           description: row.description,
//           images: []
//         };
//       }

//       if (row.image_path) {
//         map[row.id].images.push(
//           resolveImageUrl(row.image_path)
//         );
//       }

//     });

//     // 🔥 5️⃣ Preserve FastAPI ranking order
//     const finalProducts = ids
//       .map(id => map[id])
//       .filter(Boolean);

//     return res.status(200).json(finalProducts);

//   } catch (error) {

//     console.error(
//       "Error fetching popular products:",
//       error.message
//     );

//     return res.status(500).json({
//       status: "error",
//       message: "Failed to fetch popular products"
//     });
//   }
// };
