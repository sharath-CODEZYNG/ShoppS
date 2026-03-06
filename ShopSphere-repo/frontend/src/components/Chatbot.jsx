
//new all features doneeeee......




import { useContext, useEffect, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { CartContext } from "../context/CartContext";
import { addToCart, fetchCart, getChatBubbleRecommendation, getProducts, orderAPI } from "../services/api";
import "./Chatbot.css";
import ReactMarkdown from "react-markdown";

const CHAT_API_URL = import.meta.env.VITE_CHAT_URL || "http://localhost:8000/chat";
const NUMBER_WORDS = {
one: 1,
two: 2,
three: 3,
four: 4,
five: 5,
six: 6,
seven: 7,
eight: 8,
nine: 9,
ten: 10
};



const ORDER_INTENT_RE = /\b(order|buy|purchase|book|checkout|add to cart|place order)\b/i;
const CONFIRM_RE = /\b(confirm|place order|yes order|proceed|checkout now)\b/i;
const CANCEL_RE = /\b(cancel|stop|drop order|never mind)\b/i;
const ADD_TO_CART_RE = /\b(add|put|include)\b[\s\S]*\bcart\b|\bcart\b[\s\S]*\b(add|put|include)\b/i;
const DISPLAY_PRODUCT_RE = /\b(show|display|open|view)\b[\s\S]*\b(product|products|item|items)?\b/i;

function normalizeText(text = "") {
return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(text = "") {
const stopWords = new Set([
"i", "me", "my", "need", "want", "buy", "order", "book", "purchase", "place",
"please", "a", "an", "the", "for", "to", "and", "also", "get", "cart", "of"
]);
return normalizeText(text)
.split(" ")
.map((t) => t.trim())
.filter((t) => t.length > 1 && !stopWords.has(t));
}

function levenshteinDistance(a = "", b = "") {
const m = a.length;
const n = b.length;
if (!m) return n;
if (!n) return m;

const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
for (let i = 0; i <= m; i += 1) dp[i][0] = i;
for (let j = 0; j <= n; j += 1) dp[0][j] = j;

for (let i = 1; i <= m; i += 1) {
for (let j = 1; j <= n; j += 1) {
const cost = a[i - 1] === b[j - 1] ? 0 : 1;
dp[i][j] = Math.min(
dp[i - 1][j] + 1,
dp[i][j - 1] + 1,
dp[i - 1][j - 1] + cost
);
}
}
return dp[m][n];
}

function similarityScore(a = "", b = "") {
const left = normalizeText(a);
const right = normalizeText(b);
if (!left || !right) return 0;
const dist = levenshteinDistance(left, right);
return 1 - dist / Math.max(left.length, right.length);
}

function parseQuantity(segment = "") {
const normalized = normalizeText(segment);

// Only treat numbers as quantity when they appear as explicit quantity hints
// near the beginning, to avoid misreading model numbers (e.g. "iPhone 15").
const explicitPrefix = normalized.match(/^(\d+)\s*(?:x|units?|pieces?)?\s+/);
if (explicitPrefix) return Math.max(1, Number(explicitPrefix[1]));

const explicitWordPrefix = normalized.match(
/^(one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:x|units?|pieces?)?\s+/
);
if (explicitWordPrefix) return NUMBER_WORDS[explicitWordPrefix[1]] || 1;

const qtyTag = normalized.match(/\b(?:qty|quantity)\s*(?:is|:)?\s*(\d+)\b/);
if (qtyTag) return Math.max(1, Number(qtyTag[1]));

const qtyTagWord = normalized.match(
/\b(?:qty|quantity)\s*(?:is|:)?\s*(one|two|three|four|five|six|seven|eight|nine|ten)\b/
);
if (qtyTagWord) return NUMBER_WORDS[qtyTagWord[1]] || 1;

return 1;
}

function parseQuantityBeforeProduct(segment = "", productName = "") {
const segmentNorm = normalizeText(segment);
const productNorm = normalizeText(productName);
if (!segmentNorm || !productNorm) return null;

const idx = segmentNorm.indexOf(productNorm);
if (idx <= 0) return null;

const prefix = segmentNorm.slice(0, idx).trim();
if (!prefix) return null;

const numAtEnd = prefix.match(/(\d+)\s*$/);
if (numAtEnd) {
return Math.max(1, Number(numAtEnd[1]));
}

const wordAtEnd = prefix.match(
/(one|two|three|four|five|six|seven|eight|nine|ten)\s*$/
);
if (wordAtEnd) {
return NUMBER_WORDS[wordAtEnd[1]] || 1;
}

return null;
}

function stripQuantityWords(segment = "") {
let text = normalizeText(segment);
text = text
.replace(/^(\d+)\s*(?:x|units?|pieces?)?\s+/, "")
.replace(/^(one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:x|units?|pieces?)?\s+/, "")
.replace(/\b(?:qty|quantity)\s*(?:is|:)?\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/, "")
.trim();
return text;
}

function isLikelyOrderCommand(text = "") {
const trimmed = text.trim();
if (!trimmed) return false;
if (ORDER_INTENT_RE.test(trimmed)) return true;
return /^(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b/i.test(trimmed);
}

function buildProductSearchText(product) {
return normalizeText(
`${product.name || ""} ${product.brand || ""} ${product.category || ""} ${product.tags || ""}`
);
}

function findBestProductMatch(segment, products) {
const cleanedSegment = stripQuantityWords(segment) || normalizeText(segment);
const segmentTokens = tokenize(cleanedSegment);
if (!segmentTokens.length) return null;

const segmentNorm = normalizeText(cleanedSegment);
let best = null;

for (const product of products) {
const productNameNorm = normalizeText(product.name || "");
if (!productNameNorm) continue;

if (segmentNorm === productNameNorm) {
return product;
}

const searchText = buildProductSearchText(product);
const matchedCount = segmentTokens.filter((token) => searchText.includes(token)).length;
if (!matchedCount) continue;

const tokenScore = matchedCount / segmentTokens.length;
const fullNameHit = segmentNorm.includes(productNameNorm) ? 0.35 : 0;
const reverseNameHit = productNameNorm.includes(segmentNorm) ? 0.2 : 0;
const typoTolerance = similarityScore(segmentNorm, productNameNorm) * 0.35;
const score = tokenScore + fullNameHit + reverseNameHit + typoTolerance;

if (!best || score > best.score) {
best = { product, score };
}
}

if (!best) return null;
if (best.score < 0.3) return null;
return best.product;
}

function buildDraftItems(text, products) {
const normalizedText = normalizeText(text);
const exactOnly = products.find(
(product) => normalizeText(product.name || "") === normalizedText
);
if (exactOnly) {
return [{ product: exactOnly, quantity: 1 }];
}

const parts = text
.split(/\s*(?:,| and | then | also )\s*/i)
.map((p) => p.trim())
.filter(Boolean);

const draft = [];

for (const part of parts) {
const product = findBestProductMatch(part, products);
if (!product) continue;
const quantity =
parseQuantityBeforeProduct(part, product.name) ?? parseQuantity(part);
draft.push({ product, quantity });
}

const merged = new Map();
for (const item of draft) {
const existing = merged.get(item.product.id);
if (existing) {
existing.quantity += item.quantity;
} else {
merged.set(item.product.id, { ...item });
}
}

return Array.from(merged.values());
}

export default function Chatbot() {
const navigate = useNavigate();
const { setCart } = useContext(CartContext);
const [open, setOpen] = useState(false);
const [message, setMessage] = useState("");
const [messages, setMessages] = useState([
{
sender: "bot",
text: "Hi, I can take voice/text orders. Say: 'I want 2 iPhones and 1 charger'."
}
]);
const [isListening, setIsListening] = useState(false);
const [speechSupported, setSpeechSupported] = useState(true);
const [pendingOrder, setPendingOrder] = useState(null);
const [isPlacingOrder, setIsPlacingOrder] = useState(false);
const [suggestionBubbles, setSuggestionBubbles] = useState([]);
const [isLoadingBubble, setIsLoadingBubble] = useState(false);

// const session_id = useRef(crypto.randomUUID());

const session_id = useRef(null);

useEffect(() => {
  const token = localStorage.getItem("token");

  if (token) {
    try {
      // Decode JWT payload
      const payloadBase64 = token.split(".")[1];
      const decodedPayload = JSON.parse(
        atob(payloadBase64.replace(/-/g, "+").replace(/_/g, "/"))
      );

      const userId = decodedPayload?.id || decodedPayload?.userId;

      if (userId) {
        session_id.current = `user_${userId}`;
        return;
      }
    } catch (err) {
      console.error("Invalid JWT token");
    }
  }else{
    appendBotMessage("Please login first.");
  }

  // 🔥 Guest fallback
  // let stored = localStorage.getItem("guest_session_id");

  // if (!stored) {
  //   stored = crypto.randomUUID();
  //   localStorage.setItem("guest_session_id", stored);
  // }

  // session_id.current = `guest_${stored}`;
}, []);

useEffect(() => {
  const loadHistory = async () => {
    if (!session_id.current) return;

    try {
      const response = await axios.get(
        `http://localhost:4000/chat/history/${session_id.current}`
      );

      const history = response.data?.history || [];

      if (history.length) {
        const formatted = history.map((msg) => ({
          sender: msg.role === "assistant" ? "bot" : "user",
          text: msg.content
        }));

        setMessages(formatted);
      }
    } catch (err) {
      console.error("Failed to load history", err);
    }
  };

  loadHistory();
}, []);

const messagesEndRef = useRef(null);
const recognitionRef = useRef(null);
const pendingOrderRef = useRef(null);

useEffect(() => {
messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
}, [messages]);

useEffect(() => {
pendingOrderRef.current = pendingOrder;
}, [pendingOrder]);

useEffect(() => {
  if (!open) return;
  if (messages.some((msg) => msg.sender === "user")) return;

  const user = getCurrentUser();
  const userId = Number(user?.id || 0);

  if (!userId) {
    setSuggestionBubbles([]);
    return;
  }

  let cancelled = false;

  const loadBubble = async () => {
    setIsLoadingBubble(true);
    try {
      const response = await getChatBubbleRecommendation(userId);
      if (cancelled) return;

      if (response?.hasRecommendation && Array.isArray(response?.bubbles)) {
        const cleaned = response.bubbles.filter((b) => b?.text).slice(0, 3);
        setSuggestionBubbles(cleaned);
      } else {
        setSuggestionBubbles([]);
      }
    } catch {
      if (!cancelled) setSuggestionBubbles([]);
    } finally {
      if (!cancelled) setIsLoadingBubble(false);
    }
  };

  loadBubble();

  return () => {
    cancelled = true;
  };
}, [open, messages]);


const voiceAgentModeRef = useRef(false);
const isProcessingRef = useRef(false);
// changes
useEffect(() => {
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SpeechRecognition) {
setSpeechSupported(false);
return;
}

const recognition = new SpeechRecognition();
recognition.lang = "en-US";
recognition.continuous = false;
recognition.interimResults = true;

recognition.onstart = () => {
setIsListening(true);
};

// recognition.onend = () => {
// setIsListening(false);
// };

// Replace the recognition.onend inside your useEffect:
// Replace the recognition.onend inside your useEffect:
recognition.onend = () => {
  // Only auto-restart if voice mode is ON and the bot is NOT processing
  if (voiceAgentModeRef.current && !isProcessingRef.current) {
    try {
      recognition.start(); 
    } catch (e) {
      console.error("Mic restart handled gracefully:", e);
    }
  } else {
    setIsListening(false);
  }
};

recognition.onerror = () => {
setIsListening(false);
setMessages((prev) => [
...prev,
{ sender: "bot", text: "I could not capture voice properly. Please try again." }
]);
};

recognition.onresult = (event) => {
let finalTranscript = "";
for (let i = event.resultIndex; i < event.results.length; i += 1) {
const result = event.results[i];
if (result.isFinal) {
finalTranscript += result[0].transcript;
}
}

const transcript = finalTranscript.trim();
if (transcript) {
setMessage(transcript);
sendMessage(transcript);
}
};

recognitionRef.current = recognition;
}, []);

const getCurrentUser = () => {
try {
const userJson = localStorage.getItem("user");
return userJson ? JSON.parse(userJson) : null;
} catch {
return null;
}
};

const appendBotMessage = (text) => {
setMessages((prev) => [...prev, { sender: "bot", text }]);
};

const placePendingOrder = async () => {
const activePendingOrder = pendingOrderRef.current;
if (!activePendingOrder?.items?.length) {
appendBotMessage("No pending order found.");
return;
}

const user = getCurrentUser();
if (!user?.id) {
appendBotMessage("Please login first to place an order.");
return;
}

setIsPlacingOrder(true);
  appendBotMessage("Processing your order. Please wait...");
try {
const payload = {
userId: user.id,
shippingAddress: null,
items: activePendingOrder.items.map((item) => ({
productId: item.product.id,
quantity: item.quantity
}))
};

const response = await orderAPI.createVoiceOrder(payload);
if (response?.success) {
const total = Number(response.data?.totalAmount || 0).toFixed(2);
appendBotMessage(
`Order placed successfully. Order ID: ${response.data?.orderId}. Total: ₹${total}`
);
pendingOrderRef.current = null;
setPendingOrder(null);
} else {
appendBotMessage(response?.message || "Order placement failed.");
}
} catch {
appendBotMessage("Something went wrong while placing your order.");
} finally {
setIsPlacingOrder(false);
}
};

const tryBuildOrderDraft = async (text) => {
  return false; // Disable the order draft feature for now to focus on the add-to-cart and navigation features. We can re-enable and refine this later.
const user = getCurrentUser();

const productsResponse = await getProducts();
const products = Array.isArray(productsResponse) ? productsResponse : [];

const normalizedText = normalizeText(text);
const exactMentioned = products.some(
(product) => normalizeText(product.name || "") === normalizedText
);
const shouldTreatAsOrder = isLikelyOrderCommand(text) || exactMentioned;
if (!shouldTreatAsOrder) return false;

if (!user?.id) {
appendBotMessage("Please login first. Then I can create and place orders for you.");
return true;
}

if (!products.length) {
appendBotMessage("I could not load products right now. Please try again.");
return true;
}

const draftItems = buildDraftItems(text, products);
if (!draftItems.length) {
appendBotMessage("I could not identify products from that command. Please include product names clearly.");
return true;
}

const stockIssues = draftItems.filter((item) => Number(item.product.availability || 0) < item.quantity);
if (stockIssues.length) {
const stockMsg = stockIssues
.map((item) => `${item.product.name} (requested ${item.quantity}, available ${item.product.availability || 0})`)
.join(", ");
appendBotMessage(`Some items are not available in requested quantity: ${stockMsg}.`);
return true;
}

const estimatedTotal = draftItems.reduce(
(sum, item) => sum + Number(item.product.price || 0) * Number(item.quantity || 0),
0
);

const summary = draftItems
.map((item) => `${item.quantity} x ${item.product.name}`)
.join(", ");

const draftPayload = { items: draftItems };
pendingOrderRef.current = draftPayload;
setPendingOrder(draftPayload);
appendBotMessage(
`Order draft ready: ${summary}. Estimated total: ₹${estimatedTotal.toFixed(2)}. Reply "confirm order" to place it, or "cancel order".`
);
return true;
};

const tryHandleAddToCart = async (text) => {
if (!ADD_TO_CART_RE.test(text)) return false;

const user = getCurrentUser();
if (!user?.id) {
appendBotMessage("Please login first. Then I can add products to your cart.");
return true;
}

const productsResponse = await getProducts();
const products = Array.isArray(productsResponse) ? productsResponse : [];
if (!products.length) {
appendBotMessage("I could not load products right now. Please try again.");
return true;
}

//order all
let draftItems = [];


// --- NEW LOGIC: Check for contextual pronouns ---
    // --- NEW LOGIC: Check for contextual pronouns ---
    const CONTEXT_PRONOUNS_RE = /\b(these|them|all|above|this|those|it)\b/i;
    
    if (CONTEXT_PRONOUNS_RE.test(text)) {
      try {
        // We append directly to the CHAT_API_URL to bypass Proxy/CORS traps
        const cleanBaseUrl = CHAT_API_URL.replace(/\/$/, ""); 
        const sessionRes = await axios.get(`${cleanBaseUrl}/session/${session_id.current}`);
        const activeProducts = sessionRes.data?.active_products || [];

        if (activeProducts.length > 0) {
          const explicitQty = parseQuantity(text); 
          
          // Map the memory IDs safely by forcing both sides to be Strings
          draftItems = activeProducts.map((ap) => {
            const p = products.find((prod) => String(prod.id) === String(ap.product_id));
            return p ? { product: p, quantity: explicitQty } : null;
          }).filter(Boolean);
        }
      } catch (error) {
        console.error("Failed to fetch session state from RAG backend", error);
      }
    }

    // --- FALLBACK: If no contextual items were found, use standard text extraction ---
    if (!draftItems.length) {
      draftItems = buildDraftItems(text, products);
    }
if (!draftItems.length) {
appendBotMessage("I could not identify the product to add. Please mention the exact product name.");
return true;
}

const stockIssues = draftItems.filter((item) => Number(item.product.availability || 0) < item.quantity);
if (stockIssues.length) {
const stockMsg = stockIssues
.map((item) => `${item.product.name} (requested ${item.quantity}, available ${item.product.availability || 0})`)
.join(", ");
appendBotMessage(`Some items are not available in requested quantity: ${stockMsg}.`);
return true;
}

let addedCount = 0;
for (const item of draftItems) {
const addRes = await addToCart(user.id, item.product.id, item.quantity);
if (addRes?.success) {
addedCount += 1;
}
}

const cartRes = await fetchCart(user.id);
if (cartRes?.success && Array.isArray(cartRes.data)) {
setCart(cartRes.data);
}

if (!addedCount) {
appendBotMessage("I could not add items to cart right now. Please try again.");
return true;
}

const summary = draftItems.map((item) => `${item.quantity} x ${item.product.name}`).join(", ");
appendBotMessage(`Added to cart: ${summary}. Open Cart to review your items.`);
return true;
};

// const tryHandleProductDisplay = async (text) => {
// if (!DISPLAY_PRODUCT_RE.test(text)) return false;

// const productsResponse = await getProducts();
// const products = Array.isArray(productsResponse) ? productsResponse : [];
// if (!products.length) {
// appendBotMessage("I could not load products right now. Please try again.");
// return true;
// }

// const matched = findBestProductMatch(text, products);
// if (!matched?.id) {
// if (/\b(product|products|item|items)\b/i.test(text)) {
// appendBotMessage("I could not find that product. Please try with a clearer product name.");
// return true;
// }
// return false;
// }

// navigate(`/product/${matched.id}`);
// appendBotMessage(`Showing ${matched.name} on screen.`);
// return true;
// };

const tryHandleProductDisplay = async (text) => {
  const productsResponse = await getProducts();
  const products = Array.isArray(productsResponse) ? productsResponse : [];
  if (!products.length) return false;

  const normalizedText = normalizeText(text);
  
  // 1. Exact Match: User simply said "Greek Yogurt Natural"
  let matched = products.find(
    (product) => normalizeText(product.name || "") === normalizedText
  );

  // 2. Intent Match: User said "Open/Show Greek Yogurt"
  if (!matched && DISPLAY_PRODUCT_RE.test(text)) {
    matched = findBestProductMatch(text, products);
  }

  if (matched?.id) {
    navigate(`/product/${matched.id}`);
    
    // 🔥 We deliberately return FALSE here instead of true!
    // This allows the text to continue to your RAG backend, which updates
    // the "active_products" memory in Redis so follow-up commands work perfectly.
    return false; 
  }

  return false;
};

// const sendMessage = async (externalText = null) => {
// const text = (externalText ?? message).trim();
// if (!text) return;

// setMessages((prev) => [...prev, { sender: "user", text }]);
// setMessage("");

// const hasPendingOrder = Boolean(pendingOrderRef.current?.items?.length);

// if (CONFIRM_RE.test(text)) {
// if (!hasPendingOrder) {
// appendBotMessage("There is no active order draft. Tell me what you want to order first.");
// return;
// }
// await placePendingOrder();
// return;
// }

// if (CANCEL_RE.test(text)) {
// if (!hasPendingOrder) {
// appendBotMessage("There is no active order draft to cancel.");
// return;
// }
// pendingOrderRef.current = null;
// setPendingOrder(null);
// appendBotMessage("Pending order cancelled.");
// return;
// }

// try {
// const handledAsAddToCart = await tryHandleAddToCart(text);
// if (handledAsAddToCart) return;

// const handledAsProductDisplay = await tryHandleProductDisplay(text);
// if (handledAsProductDisplay) return;

// const handledAsOrder = await tryBuildOrderDraft(text);
// if (handledAsOrder) return;

// const user = getCurrentUser();
// const response = await axios.post(CHAT_API_URL, {
// message: text,
// user_id: Number(user?.id) || 0,
// session_id: session_id.current
// });

// appendBotMessage(response?.data?.reply || "I did not get that. Please try again.");
// } catch {
// appendBotMessage("Server error");
// }
// };

const CLEAR_CHAT_RE = /\b(clear|delete|erase|reset)\b[\s\S]*\b(chat|history|messages)\b/i;

const sendMessage = async (externalText = null) => {
    const text = (externalText ?? message).trim();
    if (!text) return;

    setMessages((prev) => [...prev, { sender: "user", text }]);
    setMessage("");

    // 🔥 NEW: PAUSE MIC WHILE PROCESSING
    const wasVoiceMode = voiceAgentModeRef.current;
    if (wasVoiceMode) {
      isProcessingRef.current = true;
      try {
        recognitionRef.current?.stop();
      } catch (e) {}
    }

    const normalized = normalizeText(text);
    if (/\bopen\s+cart\b/.test(normalized) || /\bgo\s+to\s+cart\b/.test(normalized)) {
      navigate("/cart");
      appendBotMessage("Opening your cart.");
      return;
    }
    if (/\bopen\s+orders\b/.test(normalized) || /\bshow\s+orders\b/.test(normalized) || /\bgo\s+to\s+orders\b/.test(normalized)) {
      navigate("/orders");
      appendBotMessage("Opening your orders.");
      return;
    }

    if (/\bgo\s+to\s+home\b/.test(normalized) || /\bopen\s+home\b/.test(normalized)) {
      navigate("/home");
      appendBotMessage("Opening home page.");
      return;
    }


    try {

      if (CLEAR_CHAT_RE.test(text)) {
        // 1. Wipe the screen immediately
        setMessages([{
          sender: "bot",
          text: "Chat history and context cleared. How can I help you?"
        }]);
        
        // 2. Wipe the backend Redis memory
        if (session_id.current) {
          try {
            await axios.delete(`http://localhost:4000/chat/history/${session_id.current}`);
          } catch (e) {
            console.error("Failed to clear backend history", e);
          }
        }
        return; // Stop processing so it doesn't go to the RAG LLM
      }

      const hasPendingOrder = Boolean(pendingOrderRef.current?.items?.length);

      if (CONFIRM_RE.test(text)) {
        if (!hasPendingOrder) {
          appendBotMessage("There is no active order draft. Tell me what you want to order first.");
          return;
        }
        await placePendingOrder();
        return;
      }

      if (CANCEL_RE.test(text)) {
        if (!hasPendingOrder) {
          appendBotMessage("There is no active order draft to cancel.");
          return;
        }
        pendingOrderRef.current = null;
        setPendingOrder(null);
        appendBotMessage("Pending order cancelled.");
        return;
      }

      const handledAsAddToCart = await tryHandleAddToCart(text);
      if (handledAsAddToCart) return;

      // const handledAsProductDisplay = await tryHandleProductDisplay(text);
      // if (handledAsProductDisplay) return;

      const handledAsOrder = await tryBuildOrderDraft(text);
      if (handledAsOrder) return;

      const user = getCurrentUser();
      const response = await axios.post(CHAT_API_URL, {
        message: text,
        user_id: Number(user?.id) || 0,
        session_id: session_id.current
      });

      if (response.data?.navigate_to) {
        navigate(`/product/${response.data.navigate_to}`);
      }

      appendBotMessage(response?.data?.reply || "I did not get that. Please try again.");
    } catch {
      appendBotMessage("Server error");
    } finally {
      // 🔥 NEW: RESUME MIC AFTER PROCESSING
      if (wasVoiceMode) {
        isProcessingRef.current = false;
        // A tiny delay ensures the browser has fully resolved the stop event first
        setTimeout(() => {
          if (voiceAgentModeRef.current) {
            try {
              recognitionRef.current?.start();
            } catch (e) {}
          }
        }, 100); 
      }
    }
  };

// Replace your toggleListening function:
const toggleListening = () => {
  if (!speechSupported || !recognitionRef.current) {
    appendBotMessage("Voice input is not supported in this browser.");
    return;
  }

  if (isListening) {
    voiceAgentModeRef.current = false; // stop loop
    recognitionRef.current.stop();
    return;
  }

  voiceAgentModeRef.current = true; // enable loop
  try {
    recognitionRef.current.start();
  } catch (e) {
    console.error("Mic start handled gracefully:", e);
  }
};

const handleSuggestionBubbleClick = async (bubble) => {
  const text = bubble?.text?.trim();
  if (!text) return;
  setMessage(text);
  setSuggestionBubbles([]);
  await sendMessage(text);
};

return (
<>
<div className="chatbot-fab-wrapper">
{!open && <div className="chatbot-label">Need help?</div>}

<button className="chatbot-button" onClick={() => setOpen(!open)}>
💬
{!open && <span className="chatbot-ping"></span>}
</button>
</div>

{open && (
<div className="chatbot-container">
<div className="chatbot-header">
Shopping Assistant
<span className="chatbot-close" onClick={() => setOpen(false)}>
✖
</span>
</div>

<div className="chatbot-messages">
{!messages.some((msg) => msg.sender === "user") && suggestionBubbles.length > 0 && (
  suggestionBubbles.map((bubble, index) => (
    <button
      key={`${bubble.productId || bubble.text}-${index}`}
      className="chatbot-suggestion-bubble"
      onClick={() => handleSuggestionBubbleClick(bubble)}
    >
      <span className="chatbot-suggestion-tag">{bubble.tag || "Recommended"}</span>
      <span className="chatbot-suggestion-text">{bubble.text}</span>
    </button>
  ))
)}
{!messages.some((msg) => msg.sender === "user") && isLoadingBubble && (
<div className="chatbot-suggestion-loading">Loading a recommendation...</div>
)}
{messages.map((msg, i) => (
<div
key={i}
className={msg.sender === "user" ? "chatbot-user" : "chatbot-bot"}>
<ReactMarkdown>{msg.text}</ReactMarkdown>
</div>
))}

<div ref={messagesEndRef}></div>
</div>

<div className="chatbot-input-area">
<input
className="chatbot-input"
value={message}
onChange={(e) => setMessage(e.target.value)}
onKeyDown={(e) => e.key === "Enter" && sendMessage()}
placeholder={isListening ? "Listening..." : "Ask or place order..."}
disabled={isPlacingOrder}
/>

<button
className={`chatbot-mic ${isListening ? "listening" : ""}`}
onClick={toggleListening}
disabled={isPlacingOrder}
title={speechSupported ? "Voice input" : "Voice not supported"}
>
🎤
</button>

<button className="chatbot-send" onClick={() => sendMessage()} disabled={isPlacingOrder}>
{isPlacingOrder ? "..." : "Send"}
</button>
</div>
</div>
)}
</>
);
}
