import express from "express";
import {
  getPopularProducts,
  getTrendingProducts,
  getChatBubbleRecommendation
} from "../controllers/recommendController.js";

const router = express.Router();


// ==============================
// POPULAR PRODUCTS ROUTE
// ==============================
router.get("/popular", getPopularProducts);
router.get("/trending", getTrendingProducts);
router.get("/chat-bubble/:userId", getChatBubbleRecommendation);


export default router;
