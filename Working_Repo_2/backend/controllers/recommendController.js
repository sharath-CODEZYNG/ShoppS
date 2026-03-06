import axios from "axios";


// =======================================
// GET POPULAR PRODUCTS
// =======================================
export const getPopularProducts = async (req, res) => {

  try {

    const response = await axios.get(
      "https://shopsphere-repo-2.onrender.com/recommend/popular"
    );

    return res.status(200).json(response.data);

  }
  catch (error) {

    console.error("Error fetching popular products:", error.message);

    return res.status(500).json({
      status: "error",
      message: "Failed to fetch popular products"
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
