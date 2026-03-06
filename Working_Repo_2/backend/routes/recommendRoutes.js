import express from "express";
import { getPopularProducts } from "../controllers/recommendController.js";

const router = express.Router();


// ==============================
// POPULAR PRODUCTS ROUTE
// ==============================
router.get("/popular", getPopularProducts);


export default router;