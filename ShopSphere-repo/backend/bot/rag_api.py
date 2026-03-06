# ===================================
# FASTAPI RAG SERVER
# Retrieval + Filtering + LLM
# ===================================
 
import os
import redis
import json
import re
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi import HTTPException, BackgroundTasks

from time import perf_counter, time
from huggingface_hub import InferenceClient

import requests
from groq import Groq
from dotenv import load_dotenv
load_dotenv ()  # Load environment variables from .env file



from langchain_chroma import Chroma
#from langchain_huggingface import HuggingFaceEmbeddings
#from langchain_ollama import OllamaLLM
from datetime import datetime

import mysql.connector
from fastapi import HTTPException



BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "product_db")

HF_API_KEY = os.getenv("HF_API_KEY")

REDIS_URL = os.getenv("REDIS_URL")

redis_client = redis.Redis.from_url(
    REDIS_URL,
    decode_responses=True
)

hf_client = InferenceClient(
    api_key=HF_API_KEY
)






# -------------------------
# 1. Init FastAPI
# -------------------------
app = FastAPI(title="RAG Product Assistant")



# new wdition

emb = None
db = None
groq_client = None

@app.on_event("startup")
async def startup_event():
    global emb, db, groq_client

    print("Initializing HF API embeddings...")

    # No local model loading — API only
    emb = "hf_api"

    print("Loading Chroma DB...")

    db = Chroma(
        persist_directory=DB_PATH,
        embedding_function=None,  # handled manually
        collection_name="products"
    )

    print("Initializing Groq client...")

    groq_client = Groq(
        api_key=os.getenv("GROQ_API_KEY")
    )

    print("RAG server ready 🚀")




# -------------------------
# 2. Absolute DB path (VERY IMPORTANT)
# -------------------------


# -------------------------
# 3. Load models ONCE
# -------------------------
# print("Loading embeddings...")

# emb = HuggingFaceEmbeddings(
#     model_name="sentence-transformers/all-MiniLM-L6-v2"
# )


# print("Loading vector DB...")

# db = Chroma(
#     persist_directory=DB_PATH,
#     embedding_function=emb,
#     collection_name="products"
# )


# print("Loading Llama model...")

# llm = OllamaLLM(
#     model="gemma3:4b",
#     temperature=0.2,
#     num_predict=180,
#     num_ctx=2048,
#     keep_alive="10m"
# )


RAG_TOP_K = 6
MAX_DOC_CHARS = 320
MAX_CONTEXT_CHARS = 1800

print(" RAG server ready")

ACTION_WEIGHTS = {
    "view": 1,
    "cart": 3,
    "purchase": 5
}


# -------------------------
# 4. Schemas
# -------------------------
class ChatRequest(BaseModel):
    message: str
    user_id: int
    session_id: str


class Product(BaseModel):
    id: int
    name: str
    category: str
    brand: str
    price: float
    description: str
    features: str
    tags: str
    attributes_json: str
    availability: int 


class DeleteProduct(BaseModel):
    id: int


# -------------------------
# 5. Prompt builder
# -------------------------
def build_prompt(context: str, query: str):

    return f"""
You are an intelligent shopping assistant for an e-commerce store.

INSTRUCTIONS:
- Use ONLY the provided product data.
- Do NOT invent products.
- Recommend only available products.
IMPORTANT RULES:
- Recommend ONLY products matching user's requested category.
- If user asks for a particular product, DO NOT recommend different product or other categories.
- Do NOT include generic marketing statements.
- Only use exact facts from provided data.

PRODUCT DATA:
{context}

USER QUESTION:
{query}

RESPONSE:
"""



# new

def get_embedding(text: str):

    embedding = hf_client.feature_extraction(
        text,
        model="sentence-transformers/all-MiniLM-L6-v2"
    )

    # Handle both formats safely
    if isinstance(embedding[0], list):
        return embedding[0]

    return embedding


def save_message(session_id, role, content):

    key = f"chat:{session_id}"

    message = {
        "role": role,
        "content": content
    }

    redis_client.rpush(key, json.dumps(message))

    redis_client.ltrim(key, -20, -1)

    redis_client.expire(key, 3600)

def get_history(session_id):

    key = f"chat:{session_id}"

    messages = redis_client.lrange(key, 0, -1)

    return [json.loads(msg) for msg in messages]

def add_session_products(session_id: str, new_ids: list[int]):

    key = f"session_products:{session_id}"

    existing = redis_client.get(key)

    if existing:
        existing_ids = set(json.loads(existing))
    else:
        existing_ids = set()

    existing_ids.update(new_ids)

    redis_client.set(
        key,
        json.dumps(list(existing_ids)),
        ex=3600
    )


def get_session_products(session_id: str):

    key = f"session_products:{session_id}"

    stored = redis_client.get(key)

    if not stored:
        return []

    ids = json.loads(stored)

    raw = db.get(ids=[str(pid) for pid in ids])

    docs = []

    for i in range(len(raw["ids"])):
        doc = type("Doc", (), {})()
        doc.page_content = raw["documents"][i]
        doc.metadata = raw["metadatas"][i]
        docs.append(doc)

    return docs


# Conversational memeory

# ===================================
# CONVERSATION STATE MANAGEMENT
# ===================================

def get_conversation_state(session_id: str):
    key = f"conv_state:{session_id}"
    raw = redis_client.get(key)

    if not raw:
        return {
            "active_products": [],
            "last_shown_products": []
        }

    return json.loads(raw)


def save_conversation_state(session_id: str, state: dict):
    key = f"conv_state:{session_id}"
    redis_client.set(key, json.dumps(state), ex=3600)



#new one 

def filter_mentioned_docs(reply: str, docs: list) -> list:
    """Filters retrieved documents to only include those actually mentioned by the LLM."""
    if not docs:
        return []
        
    mentioned_docs = []
    reply_lower = reply.lower()
    
    # 1. Safely get exact names from DB to avoid text parsing issues
    product_ids = [d.metadata.get("product_id") for d in docs if d.metadata.get("product_id") is not None]
    if not product_ids:
        return docs
        
    conn = get_mysql_connection()
    cursor = conn.cursor(dictionary=True)
    format_strings = ','.join(['%s'] * len(product_ids))
    cursor.execute(f"SELECT id, name FROM products WHERE id IN ({format_strings})", tuple(product_ids))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    
    id_to_name = {row['id']: row['name'].lower() for row in rows}
    
    # 2. Match names against the LLM's reply
    for d in docs:
        pid = d.metadata.get("product_id")
        name = id_to_name.get(pid, "")
        
        if not name:
            continue
            
        # Direct full name match
        if name in reply_lower:
            mentioned_docs.append(d)
            continue
            
        # Bigram match (Fallback for slight name variations)
        words = name.split()
        if len(words) == 1:
            if words[0] in reply_lower:
                mentioned_docs.append(d)
        else:
            for i in range(len(words)-1):
                bigram = f"{words[i]} {words[i+1]}"
                if bigram in reply_lower:
                    mentioned_docs.append(d)
                    break
                    
    # 3. CRITICAL FALLBACK: If the filter accidentally wiped everything, 
    # return the original docs so we don't break the conversational memory.
    if not mentioned_docs:
        return docs
        
    return mentioned_docs


# -------------------------
# 6. Core RAG logic
# -------------------------
# def ask_rag(query: str,session_id: str, k: int = RAG_TOP_K):

#     history = get_history(session_id)
#     recent_history = ""

#     for msg in history[-1:]:
#         recent_history += f"{msg['role']}: {msg['content'][:200]}\n"


#     # query_with_history = f"""Conversation_History:{recent_history} user: {query}"""
    
#     current_vec = get_embedding(query)

#     weighted_vec = [float(v) * 3.0 for v in current_vec]  # highest weight

#     # Last 2 messages medium weight
#     for msg in history[-2:]:
#         vec = get_embedding(msg["content"])
#         vec = [float(v) for v in vec]
#         weighted_vec = [w + (v * 1.5) for w, v in zip(weighted_vec, vec)]

#     # Older messages lower weight
#     for msg in history[-6:-2]:
#         vec = get_embedding(msg["content"])
#         vec = [float(v) for v in vec]
#         weighted_vec = [w + (v * 0.5) for w, v in zip(weighted_vec, vec)]

#     query_vector = weighted_vec 

#     session_docs = get_session_products(session_id)

#     # query_vector = get_embedding(query_with_history)
#     query_vector_plain = get_embedding(query)

#     vector_docs = db.similarity_search_by_vector(
#            query_vector,k=k)
#     vector_docs_plain = db.similarity_search_by_vector(
#            query_vector_plain,k=max(k, 8))

#     expanded_query = build_semantic_query(query)
#     vector_docs_expanded = []
#     if expanded_query != query:
#         expanded_vector = get_embedding(expanded_query)
#         vector_docs_expanded = db.similarity_search_by_vector(
#             expanded_vector, k=max(k, 8)
#         )

#     doc_map = {}

#     for d in session_docs + vector_docs + vector_docs_plain + vector_docs_expanded:
#         pid = d.metadata.get("product_id")
#         if pid:
#             doc_map[pid] = d

#     docs = list(doc_map.values())
#     docs = rerank_docs_by_query(docs, query)
#     docs = docs[:max(k, 8)]


#     print("Retrieved docs:", len(docs))

#     # -------------------------
#     # Truly not present
#     # -------------------------
#     if not docs:
#         return "Sorry, this product is not present in our catalogue."

#     context_parts = []

#     # -------------------------
#     # Build context WITH stock info
#     # -------------------------
#     for d in docs:

#         availability = d.metadata.get("availability", 0)

#         stock_msg = (
#             "IN STOCK"
#             if availability > 0
#             else "OUT OF STOCK"
#         )

#         context_parts.append(
#             f"{d.page_content}\nStock status: {stock_msg}"
#         )

#     context = "\n\n".join(context_parts)

# #     product_ids = []

# #     for d in docs:
# #         pid = d.metadata.get("product_id")
# #         if pid is not None:
# #             product_ids.append(pid)

# #     add_session_products(session_id, product_ids)

# #     # -------------------------
# # # Update conversation state
# # # -------------------------

# #     state = get_conversation_state(session_id)

# #     if product_ids:
# #         state["last_shown_products"] = product_ids

# #         # Set most relevant as active product
# #         state["active_products"] = [
# #             {
# #                 "product_id": d.metadata.get("product_id"),
# #                 "content": d.page_content
# #             } for d in docs # Store up to 3 products
# #         ]

# #     save_conversation_state(session_id, state)

#     prompt = f"""
# Respond like a helpful ecommerce shopping assistant.

# You MUST answer using ONLY the DATABASE CONTENT below.

# CONVERSATION HISTORY:
# ---------------------
# {recent_history}

# DATABASE CONTENT START
# ---------------------
# {context}
# ---------------------
# DATABASE CONTENT END

# Do NOT dump raw database text.

# Format responses clearly and naturally.

# Include:
# - product name
# - price
# - key features
# - stock status

# Keep response concise and conversational.

# STRICT RULES:
# - Only use information from DATABASE CONTENT.
# - Do NOT use prior knowledge.
# - Do NOT invent products.
# - Do NOT suggest products not present in DATABASE CONTENT.
# - If no matching product exists, reply EXACTLY:
#   No matching product found in our catalogue.
# - if product is not present do not recommend other products.

# USER QUERY:
# {query}

# DATABASE ANSWER:
# """



#     response = groq_client.chat.completions.create(
#         model="llama-3.1-8b-instant",
#         messages=[
#             {"role": "user", "content": prompt}
#         ],
#         temperature=0.2
#     )

#     response = response.choices[0].message.content

#     final_docs = filter_mentioned_docs(response, docs)

#     product_ids = []
#     for d in final_docs:
#         pid = d.metadata.get("product_id")
#         if pid is not None:
#             product_ids.append(pid)

#     if product_ids:
#         add_session_products(session_id, product_ids)
        
#         state = get_conversation_state(session_id)
#         state["last_shown_products"] = product_ids
#         state["active_products"] = [
#             {
#                 "product_id": d.metadata.get("product_id"),
#                 "content": d.page_content
#             } for d in final_docs
#         ]
#         save_conversation_state(session_id, state)


#     save_message(session_id, "user", query)
#     save_message(session_id, "assistant", response)

#     return response 


def get_product_insights_batch(product_ids):
    if not product_ids:
        return []
        
    conn = get_mysql_connection()
    cursor = conn.cursor(dictionary=True)

    format_strings = ",".join(["%s"] * len(product_ids))

    # Join products with the new review_summary table
    cursor.execute(f"""
        SELECT 
            p.id, p.rating_avg, p.rating_count,
            COALESCE(rs.summarized_review, 'No customer reviews available yet.') as review_summary,
            COALESCE(rs.avg_sentiment_score, 0) as sentiment_score
        FROM products p
        LEFT JOIN review_summary rs ON p.id = rs.product_id
        WHERE p.id IN ({format_strings})
    """, tuple(product_ids))

    insights = cursor.fetchall()

    cursor.close()
    conn.close()

    return insights


def summarize_reviews(reviews: list) -> str:
    """Condenses multiple reviews into a single high-density sentiment string."""
    if not reviews or reviews == ["No reviews yet."]:
        return "No customer reviews available yet."
    
    # If there are only 1 or 2 reviews, just join them to save an API call
    if len(reviews) <= 2:
        return " | ".join(reviews)
        
    text_to_summarize = " | ".join(reviews[:10]) # Take up to 10 recent reviews
    prompt = f"Summarize the overall sentiment of these customer reviews in ONE concise sentence: {text_to_summarize}"
    
    try:
        response = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=50
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"[Summarizer Error]: {e}")
        return "Customers have left mixed to positive feedback."


# -------------------------
# 6. Core RAG logic (OPTIMIZED FOR PURE INTENT)
# -------------------------
def ask_rag(query: str, session_id: str, search_query: str = None,active_context_string:str=None, k: int = RAG_TOP_K):

    target_query = search_query if search_query else query
    
    # 1. NO MORE HISTORY BLENDING. We use the pure, isolated query for retrieval.
    query_vector = get_embedding(target_query)

    # 2. Get expanded semantic terms (your existing logic)
    expanded_query = build_semantic_query(query)

    doc_map = {}

    # 3. Retrieve based ONLY on the user's current specific intention
    vector_docs_plain = db.similarity_search_by_vector(query_vector, k=max(k*3, 8))
    for d in vector_docs_plain:
        pid = d.metadata.get("product_id")
        if pid:
            doc_map[pid] = d

    if expanded_query != query:
        expanded_vector = get_embedding(expanded_query)
        vector_docs_expanded = db.similarity_search_by_vector(expanded_vector, k=max(k*3, 8))
        for d in vector_docs_expanded:
            pid = d.metadata.get("product_id")
            if pid:
                doc_map[pid] = d

    # 4. Rerank and strictly limit to top K matches
    docs = list(doc_map.values())
    docs = rerank_docs_by_query(docs, target_query, query_vector)
    docs = docs[:k]

    print("Retrieved purely semantic docs:", len(docs))

    if not docs:
        return "Sorry, I couldn't find products matching your request."
     
    # 5. Build context WITH stock info
    # 5. Build context WITH stock and sentiment info
    context_parts = []
    
    product_ids = [d.metadata["product_id"] for d in docs]
    insights_list = get_product_insights_batch(product_ids)
    
    # Create a map for easy lookup
    insights_map = {r['id']: r for r in insights_list}

    for d in docs:
        availability = d.metadata.get("availability", 0)
        stock_msg = "IN STOCK" if availability > 0 else "OUT OF STOCK"
        pid = d.metadata["product_id"]
        
        # Get the pre-calculated insights (fallback if no reviews exist)
        insights = insights_map.get(pid, {
            "rating_avg": 0, "rating_count": 0, 
            "review_summary": "No reviews yet.", "sentiment_score": 0
        })
        
        # Format a "Pro Recommendation Profile" for the LLM to read
        context_parts.append(f"""
PRODUCT DATA:
{d.page_content}
Stock status: {stock_msg}

COMMUNITY INSIGHTS:
- Star Rating: {insights['rating_avg']}/5 ({insights['rating_count']} total ratings)
- Sentiment Score: {insights['sentiment_score']:.1f}/10 (Higher is better)
- Community Consensus: "{insights['review_summary']}"
        """)

    context = "\n\n".join(context_parts)

    # 6. Fetch minimal history just for conversational flow in the prompt
    history = get_history(session_id)
    recent_history = ""
    # Only pull the last 2 messages so the LLM remembers the immediate context, 
    # rather than the last 6 which confuses it.
    for msg in history[-1:]: 
        recent_history += f"{msg['role']}: {msg['content'][:200]}\n"

    active_block = f"CURRENTLY ACTIVE PRODUCT ON SCREEN:\n{active_context_string}\n" if active_context_string else ""

    prompt = f"""
Respond like a helpful ecommerce shopping assistant.

You MUST answer using ONLY the DATABASE CONTENT below.

CONVERSATION HISTORY (For conversational tone only):
---------------------
{recent_history}

{active_block}

DATABASE CONTENT START
---------------------
{context}
---------------------
DATABASE CONTENT END

Do NOT dump raw database text.
Format responses clearly and naturally.
Include:
- product name
- price
- key features
- stock status

Keep response concise and conversational.

STRICT RULES:
- Only use information from DATABASE CONTENT.
- Do NOT use prior knowledge.
- Do NOT invent products.
- Do NOT suggest products not present in DATABASE CONTENT.
- If no matching product exists, reply EXACTLY:
  No matching product found in our catalogue.
- If there are CURRENTLY ACTIVE PRODUCTS on the screen, you are strictly forbidden from suggesting ANY of those exact products again unless its a comparison.
- if product is not present do not recommend other products.
- if the user is asking to recommend a product, perform a detailed analysis of the products review and suggest them using your intelligence and provide the summary of the reviews.
- WHEN RECOMMENDING OR COMPARING PRODUCTS: You MUST justify your suggestions using the "COMMUNITY INSIGHTS" provided in the database content. Explicitly mention the Star Rating, Sentiment Score, and quote the Community Consensus to explain exactly WHY a product is a good choice based on user feedback.
- ALWAYS use "rupees" or "₹" for prices. NEVER use the "$" sign.
USER QUERY:
{query}

### RESPONSE FORMAT:
## 🎁 Recommended for You
[Brief friendly intro]

### [Product Name]
- **Price:** ₹[Price]
- **Key Features:** [Feature 1], [Feature 2]
- **Status:** [Stock Status]
- **Why the Community Loves It:** > "[Quote Consensus]"
  - **Rating:** [Star Rating] ⭐
  - **Sentiment:** [Score]/10

---

DATABASE ANSWER:
"""

    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2
    )

    reply = response.choices[0].message.content

    # 7. Safely update conversational memory
    final_docs = filter_mentioned_docs(reply, docs)
    
    product_ids = []
    for d in final_docs:
        pid = d.metadata.get("product_id")
        if pid is not None:
            product_ids.append(pid)

    if product_ids:
        # Overwrite active products so follow-ups target these new recommendations
        state = get_conversation_state(session_id)
        state["last_shown_products"] = product_ids + state.get("last_shown_products", [])[:10]
        state["active_products"] = [
            {
                "product_id": d.metadata.get("product_id"),
                "content": d.page_content
            } for d in final_docs
        ]
        save_conversation_state(session_id, state)

    clean_history_query = query.split(" (Secret Note:")[0].strip()

    save_message(session_id, "user", clean_history_query)
    save_message(session_id, "assistant", reply)

    # Return without saving to redis here, because your @app.post("/chat") route 
    # already saves the messages at the very bottom! 
    return reply

# -------------------------
# 8. Routes
# -------------------------
@app.get("/")
def home():
    return {"status": "RAG server running"}


# @app.post("/chat")
# def chat(req: ChatRequest):
#     # return {"reply": ask_rag(req.message)}
#     started_at = perf_counter()
#     query_type = route_query(req.message)

#     if query_type == QUERY_TYPE_SQL:
#         reply = handle_structured_query(req.message)
#     else:
#         reply = ask_rag(req.message, req.session_id)

#     elapsed_ms = int((perf_counter() - started_at) * 1000)
#     print(f"[chat] latency_ms={elapsed_ms}")
#     return {"reply": reply}

# --- ADD THIS NEW ENDPOINT ---
# --- ADD THIS NEW ENDPOINT ---
@app.get("/chat/session/{session_id}")
def get_session(session_id: str):
    """Exposes the active conversational memory to the frontend"""
    return get_conversation_state(session_id)
# -----------------------------
# -----------------------------

@app.get("/chat/history/{session_id}")
def get_chat_history(session_id: str):
    history = get_history(session_id)
    return {"history": history}

import mysql.connector
from fastapi import HTTPException



from typing import Optional


class ProductCreate(BaseModel):
    product_id: int
    name: Optional[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    price: Optional[float] = None
    availability: Optional[int] = None
    description: Optional[str] = None
    features: Optional[str] = None
    tags: Optional[str] = None
    attributes_json: Optional[str] = None
    image_url: Optional[str] = None
    images: Optional[list[str]] = None  # JSON column


# ==============================
# TEXT BUILDER FOR EMBEDDING
# ==============================
def product_to_text(product: dict) -> str:
    return f"""
    Product Name: {product.get('name', '')}
    Category: {product.get('category', '')}
    Brand: {product.get('brand', '')}
    Price: {product.get('price', '')}
    Description: {product.get('description', '')}
    Features: {product.get('features', '')}
    Tags: {product.get('tags', '')}
    Attributes: {product.get('attributes_json', '')}
    Availability: {product.get('availability', '')}
    """



@app.post("/add-product")
def add_product(product: Product):

    try:

        product_payload = product.dict()
        text = product_to_text(product_payload)

        # delete old entry
        db._collection.delete(ids=[str(product.id)])

        # generate embedding
        vector = get_embedding(text)

        # insert into Chroma (CORRECT METHOD)
        db._collection.add(
            ids=[str(product.id)],
            embeddings=[vector],
            metadatas=[{
                "product_id": product.id,
                "availability": product.availability
            }],
            documents=[text]
        )

        return {
            "status": "success",
            "message": "Product indexed in vector DB",
            "product_id": product.id
        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )






# ---------- DELETE ----------
@app.post("/delete-product")
def delete_product(product: DeleteProduct):

    db._collection.delete(where={"product_id": product.id})

    return {"status": "deleted"}


# ===================================
# POPULARITY RECOMMENDATION SECTION
# ===================================

def get_mysql_connection():

    return mysql.connector.connect(
        host="yamabiko.proxy.rlwy.net",
        port=47187,
        user="root",
        password="sxdqGkBtLlELfMjdZtDoeMlYMtvMSKeM",
        database="railway"
    )


def fetch_popular_products(limit: int = 10):

    conn = get_mysql_connection()

    cursor = conn.cursor(dictionary=True)

    query = """
    SELECT
        id,
        name,
        category,
        brand,
        price,
        description,
        features,
        tags,
        attributes_json,
        availability,
        views,
        purchases,
        rating_avg,
        rating_count,

        (
            0.5 * purchases +
            0.3 * views +
            0.2 * rating_avg* rating_count
        ) AS popularity_score

    FROM products

    ORDER BY popularity_score DESC

    LIMIT %s
    """

    cursor.execute(query, (limit,))

    products = cursor.fetchall()

    cursor.close()
    conn.close()

    return products


# ===================================
# POPULAR PRODUCTS ENDPOINT
# ===================================
@app.get("/recommend/popular")
def recommend_popular(limit: int = 10):

    try:

        products = fetch_popular_products(limit)

        return {
            "status": "success",
            "recommendation_type": "popularity",
            "count": len(products),
            "products": products
        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )
    

# PERSONALISED RECOMMENDATION

def get_recency_weight(activity_time):

    now = datetime.now()
    diff = now - activity_time

    hours = diff.total_seconds() / 3600

    if hours <= 1:
        return 3.0      # very recent
    elif hours <= 24:
        return 2.5      # today
    elif hours <= 72:
        return 2.0      # last 3 days
    elif hours <= 168:
        return 1.5      # last week
    else:
        return 1.0      # old

def get_user_activity(user_id: int):

    conn = mysql.connector.connect(
        host="yamabiko.proxy.rlwy.net",
        port=47187,
        user="root",
        password="sxdqGkBtLlELfMjdZtDoeMlYMtvMSKeM",
        database="railway"
    )

    cursor = conn.cursor(dictionary=True)

    query = """
SELECT p.id, p.name, p.category, p.brand,
       p.description, p.features, p.tags,
       p.attributes_json,
       ua.action,
       ua.timestamp
FROM user_activity ua
JOIN products p ON ua.product_id = p.id
WHERE ua.user_id = %s
ORDER BY ua.timestamp DESC
"""

    cursor.execute(query, (user_id,))

    rows = cursor.fetchall()

    cursor.close()
    conn.close()

    return rows

def build_user_profile_text(user_id: int):

    rows = get_user_activity(user_id)

    if not rows:
        return None

    weighted_text = ""

    for row in rows:

        action_weight = ACTION_WEIGHTS.get(row["action"], 1)
        recency_weight = get_recency_weight(row["timestamp"])

        weight = int(action_weight * recency_weight)

        product_text = f"""
        {row['name']}
        Category: {row['category']}
        Brand: {row['brand']}
        Description: {row['description']}
        Features: {row['features']}
        Tags: {row['tags']}
        """

        weighted_text += product_text * weight

    return weighted_text


@app.get("/recommend/personal/{user_id}")
def recommend_personal(user_id: int, limit: int = 5):

    profile_text = build_user_profile_text(user_id)

    # -----------------------------------
    # FALLBACK TO POPULAR
    # -----------------------------------
    if not profile_text:

        popular_products = fetch_popular_products(limit)

        return {
            "status": "success",
            "recommendation_type": "popular_fallback",
            "count": len(popular_products),
            "products": popular_products
        }

    # -----------------------------------
    # PERSONALIZED RECOMMENDATION
    # -----------------------------------
    docs = db.similarity_search(profile_text, k=limit)

    products = []

    for d in docs:

        products.append({
            "product_id": d.metadata.get("product_id"),
            "availability": d.metadata.get("availability"),
            "content": d.page_content
        })

    return {
        "status": "success",
        "recommendation_type": "personalized",
        "count": len(products),
        "products": products
    }

@app.get("/debug")
def debug():

    docs = db.similarity_search("Greek Yogurt Natural", k=5)

    result = []

    for d in docs:
        result.append({
            "content": d.page_content,
            "metadata": d.metadata
        })

    return result


@app.put("/update-product-availability")
def update_product_availability(product_id: int, availability: int = None):

    try:
        # Fetch latest product from MySQL
        conn = mysql.connector.connect(
            host="yamabiko.proxy.rlwy.net",
            port=47187,
            user="root",
            password="sxdqGkBtLlELfMjdZtDoeMlYMtvMSKeM",
            database="railway"
        )

        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            "SELECT * FROM products WHERE id = %s",
            (product_id,)
        )

        product = cursor.fetchone()

        cursor.close()
        conn.close()

        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        # Update vector DB
        db._collection.delete(ids=[str(product_id)])

        text = product_to_text(product)

        vector = get_embedding(text)

        db._collection.add(
            ids=[str(product_id)],
            embeddings=[vector],
            documents=[text],
            metadatas=[{
                "product_id": product_id,
                "availability": product["availability"]
            }]
        )


        return {
            "status": "success",
            "product_id": product_id,
            "availability": product["availability"]
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


    
# -----------------------------------
# 8. Query routing (SQL vs Vector)
# -----------------------------------
QUERY_TYPE_SQL = "sql"
QUERY_TYPE_VECTOR = "vector"

PRODUCT_NAME_CACHE = {
    "names": [],
    "loaded_at": 0.0
}
PRODUCT_NAME_CACHE_TTL_SECONDS = 300


def normalize_text(text: str) -> str:
    text = (text or "").lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _load_product_names():
    now = time()

    if (
        PRODUCT_NAME_CACHE["names"]
        and (now - PRODUCT_NAME_CACHE["loaded_at"]) < PRODUCT_NAME_CACHE_TTL_SECONDS
    ):
        return PRODUCT_NAME_CACHE["names"]

    conn = get_mysql_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT name FROM products")
    rows = cursor.fetchall()

    cursor.close()
    conn.close()

    names = []

    for row in rows:
        if not row or not row[0]:
            continue
        names.append(str(row[0]).strip().lower())

    PRODUCT_NAME_CACHE["names"] = names
    PRODUCT_NAME_CACHE["loaded_at"] = now

    return names


def find_best_product_name_match(query: str):
    query_norm = normalize_text(query)
    if not query_norm:
        return None

    query_tokens = set(query_norm.split())
    product_names = _load_product_names()

    # 1) Exact name containment
    for name in sorted(product_names, key=len, reverse=True):
        if name and name in query_norm:
            return name

    # 2) Token overlap for partial product mention
    best_name = None
    best_score = 0

    for name in product_names:
        name_tokens = [tok for tok in normalize_text(name).split() if len(tok) >= 3]
        if not name_tokens:
            continue

        overlap = sum(1 for tok in name_tokens if tok in query_tokens)
        if overlap > best_score:
            best_score = overlap
            best_name = name

    if best_score >= 1:
        return best_name

    return None


def has_explicit_product_name(query: str) -> bool:
    return find_best_product_name_match(query) is not None


def is_recommendation_query(query: str) -> bool:
    query_lower = query.lower().strip()

    recommendation_keywords = [
        "recommend",
        "recommendation",
        "suggest",
        "suggestion",
        "what should i buy",
        "which product",
        "which one",
        "best option",
        "best products",
        "show products",
        "find products",
        "looking for"
    ]

    for keyword in recommendation_keywords:
        if keyword in query_lower:
            return True

    return False


def is_availability_operation_query(query: str) -> bool:
    q = normalize_text(query)

    availability_keywords = [
        "availability",
        "available",
        "availabile",
        "stock",
        "quantity",
        "qty"
    ]

    operation_keywords = [
        "total",
        "sum",
        "count",
        "how many",
        "available quantity",
        "available qty"
    ]

    has_availability = any(word in q for word in availability_keywords)
    has_operation = any(word in q for word in operation_keywords)

    return has_availability and has_operation


def build_semantic_query(query: str) -> str:
    q = normalize_text(query)
    expansions = []

    if "non vegetarian" in q or "non veg" in q or "nonveg" in q:
        expansions.append("non-vegetarian food protein meat snack ready-to-eat")

    elif "veg" in q or "vegetarian" in q:
        expansions.append("vegetarian food healthy snack dairy grocery")

    if "snack" in q or "snacks" in q:
        expansions.append("snack crunchy quick bites")

    if "electronic" in q or "device" in q or "gadget" in q:
        expansions.append("electronic gadgets technology device accessories")

    if "mix" in q:
        expansions.append("breakfast mix health mix oats mix food")

    if not expansions:
        return query

    return f"{query} {' '.join(expansions)}"


# def rerank_docs_by_query(docs, query: str):
#     query_tokens = set(tok for tok in normalize_text(query).split() if len(tok) >= 3)

#     if not query_tokens:
#         return docs

#     def score(doc):
#         content = normalize_text(doc.page_content)
#         content_tokens = set(content.split())
#         overlap = len(query_tokens.intersection(content_tokens))

#         # small boost for available products
#         availability = doc.metadata.get("availability", 0) or 0
#         stock_boost = 1 if availability > 0 else 0

#         return overlap + stock_boost

#     return sorted(docs, key=score, reverse=True)

def get_review_score(product_id):

    conn = get_mysql_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT rating_avg, rating_count
        FROM products
        WHERE id = %s
    """, (product_id,))

    row = cursor.fetchone()
    cursor.close()
    conn.close()

    if not row:
        return 0

    rating = float(row["rating_avg"] / 5)
    volume = float(min(row["rating_count"]/100, 1))

    return 0.7 * rating + 0.3 * volume

# def rerank_docs_by_query(docs, query: str, query_vector):

#     query_tokens = set(tok for tok in normalize_text(query).split() if len(tok) >= 3)

#     if not docs:
#         return docs
    
#     # review_score = get_review_score(doc.metadata["product_id"])
#     product_ids = [d.metadata["product_id"] for d in docs]
#     reviews, ratings = get_reviews_batch(product_ids)

#     rating_map = {r["id"]: r for r in ratings}

#     def score(doc):

#         # keyword overlap
#         content = normalize_text(doc.page_content)
#         content_tokens = set(content.split())
#         overlap = len(query_tokens.intersection(content_tokens))

#         # stock boost
#         availability = doc.metadata.get("availability", 0) or 0
#         stock_boost = 1 if availability > 0 else 0

#         # # semantic similarity
#         # doc_vector = doc.metadata["embedding"]
#         # semantic_score = sum(a*b for a,b in zip(query_vector, doc_vector))

#         row = rating_map.get(doc.metadata["product_id"])

#         rating = float(row["rating_avg"] / 5 if row else 0)
#         volume = float(min(row["rating_count"]/100,1) if row else 0)

#         review_score = 0.7 * rating + 0.3 * volume

#         final_score = (
#             + 0.4 * overlap
#             + 0.2 * stock_boost
#             + 0.4 * review_score
#         )

#         return final_score

#     return sorted(docs, key=score, reverse=True)

def rerank_docs_by_query(docs, query: str, query_vector):
    query_tokens = set(tok for tok in normalize_text(query).split() if len(tok) >= 3)

    if not docs:
        return docs
    
    product_ids = [d.metadata["product_id"] for d in docs]
    
    # 1. Use your super-fast MySQL insight query!
    insights = get_product_insights_batch(product_ids)
    insights_map = {r["id"]: r for r in insights}

    def score(doc):
        # 1. Keyword overlap (Lightning fast)
        content = normalize_text(doc.page_content)
        content_tokens = set(content.split())
        overlap = len(query_tokens.intersection(content_tokens))

        # 2. Stock boost (Lightning fast)
        availability = doc.metadata.get("availability", 0) or 0
        stock_boost = 1 if availability > 0 else 0

        # 3. Community Rating & Sentiment Boost (Lightning fast database math!)
        row = insights_map.get(doc.metadata["product_id"])
        rating = float(row["rating_avg"] / 5 if row else 0)
        volume = float(min(row["rating_count"]/100, 1) if row else 0)
        
        # Convert sentiment (1-10) to a 0.1 - 1.0 scale
        sentiment = float(row["sentiment_score"] / 10 if row else 0)

        # Calculate a combined review score
        review_score = (0.5 * rating) + (0.3 * volume) + (0.2 * sentiment)

        final_score = (
            + 0.4 * overlap
            + 0.2 * stock_boost
            + 0.4 * review_score
        )

        return final_score

    return sorted(docs, key=score, reverse=True)


def build_deterministic_sql(query: str):
    matched_name = find_best_product_name_match(query)
    q = normalize_text(query)

    if not matched_name:
        return None

    safe_name = matched_name.replace("'", "''")

    if is_availability_operation_query(query):
        return (
            "SELECT "
            f"'{safe_name}' AS name, "
            "SUM(availability) AS total_availability "
            "FROM products "
            f"WHERE LOWER(name) LIKE LOWER('%{safe_name}%')"
        )

    if any(word in q for word in ["availability", "available", "availabile", "stock", "quantity", "qty"]):
        return (
            "SELECT name,price, availability "
            "FROM products "
            f"WHERE LOWER(name) LIKE LOWER('%{safe_name}%') "
            "ORDER BY availability DESC "
            # "LIMIT 1"
        )

    return None

def route_query(query: str) -> str:
    query_lower = query.lower().strip()

    if has_explicit_product_name(query):
        return QUERY_TYPE_SQL

    if is_recommendation_query(query):
        return QUERY_TYPE_VECTOR

    # SQL intent keywords (analytical queries)
    sql_keywords = [
        "highest",
        "lowest",
        "most",
        "least",
        "top",
        "best selling",
        "count",
        "how many",
        "maximum",
        "minimum",
        "average",
        "sum",
        "total",
        "highest sold",
        "lowest sold"
    ]

    # Check SQL intent first
    for keyword in sql_keywords:
        if keyword in query_lower:
            return QUERY_TYPE_SQL

    # # Check vector intent
    # for keyword in vector_keywords:
    #     if keyword in query_lower:
    #         return QUERY_TYPE_VECTOR

    # Default fallback
    return QUERY_TYPE_VECTOR


def generate_sql(query: str) -> str:
    deterministic_sql = build_deterministic_sql(query)
    if deterministic_sql:
        print("Generated SQL (deterministic):", deterministic_sql)
        return deterministic_sql

    prompt = f"""
You are an expert MySQL query generator.

Convert the user request into a valid MySQL SELECT query.

DATABASE:railway
Table: products

COLUMN MEANINGS:
- id: unique product ID
- name: exact product name (e.g., 'Whole Wheat Bread', 'Greek Yogurt Natural')
- category: broad category (MUST be one of the existing categories: 'Food', 'Electronic Gadgets', 'Groceries')
- brand: product brand
- price: product price
- availability: quantity currently available in stock
- purchases: total purchase count
- views: total views
- rating_avg: average rating
- rating_count: number of ratings

IMPORTANT RULES:
- If the user mentions a specific product (e.g., "Whole Wheat Bread"),
  use the name column for filtering.
- Use category column only when user clearly asks for a category.
- Only generate SELECT queries.
- No explanation.
- No markdown.
- Output only SQL.
- When filtering by product name, always use:
WHERE LOWER(name) LIKE LOWER('%keyword%')

USER REQUEST:
{query}

SQL:
"""

    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2
    )

    sql = response.choices[0].message.content.strip()

    sql = sql.replace("```sql", "").replace("```", "")
    sql = sql.replace("\n", " ")

    print("Generated SQL:", sql)

    return sql 


# def filter_mentioned_docs(reply: str, docs: list) -> list:
#     """Filters retrieved documents to only include those actually mentioned by the LLM."""
#     mentioned_docs = []
#     reply_lower = reply.lower()
    
#     for d in docs:
#         # Extract product name from page_content
#         name = ""
#         for line in d.page_content.split('\n'):
#             if "Product Name:" in line:
#                 name = line.replace("Product Name:", "").strip().lower()
#                 break
        
#         if not name:
#             continue
            
#         # 1. Direct full name match
#         if name in reply_lower:
#             mentioned_docs.append(d)
#             continue
            
#         # 2. Bigram match (Fallback for when LLM slightly shortens names)
#         # e.g., "Salt Iodized 1kg" -> matches if LLM says "salt iodized"
#         words = name.split()
#         if len(words) == 1:
#             if words[0] in reply_lower:
#                 mentioned_docs.append(d)
#         else:
#             for i in range(len(words)-1):
#                 bigram = f"{words[i]} {words[i+1]}"
#                 if bigram in reply_lower:
#                     mentioned_docs.append(d)
#                     break
                    
#     return mentioned_docs


def handle_structured_query(sql_query: str, original_query: str = ""):
    sql_query = (sql_query or "").strip()
    if not sql_query.lower().startswith("select"):
        fallback_sql = build_deterministic_sql(original_query)
        if fallback_sql:
            sql_query = fallback_sql
        else:
            return "No matching product found in our catalogue."

    conn = get_mysql_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute(sql_query)
        rows = cursor.fetchall()
    except Exception:
        fallback_sql = build_deterministic_sql(original_query)
        if not fallback_sql or fallback_sql == sql_query:
            cursor.close()
            conn.close()
            return "No matching product found in our catalogue.",[]

        cursor.execute(fallback_sql)
        rows = cursor.fetchall()

    cursor.close()
    conn.close()

    if not rows:
        return "No matching product found in our catalogue.",[]

    response_parts = []

    for row in rows:
        formatted = []

        if "name" in row:
            formatted.append(f"Product: {row['name']}")

        if "price" in row:
            formatted.append(f"Price: {row['price']} rupees")

        if "availability" in row:
            stock_status = "IN STOCK" if row["availability"] > 0 else "OUT OF STOCK"
            formatted.append(f"Stock Status: {stock_status}")
            formatted.append(f"Available Quantity: {row['availability']}")

        if "total_availability" in row:
            formatted.append(f"Total Available Quantity: {row['total_availability']}")

        if "count" in row:
            formatted.append(f"Count: {row['count']}")

        if "total" in row:
            formatted.append(f"Total: {row['total']}")

        if "average" in row:
            formatted.append(f"Average: {row['average']}")

        response_parts.append("\n".join(formatted))

    return "\n\n".join(response_parts), rows


def handle_goal_based_query(query: str, session_id: str, limit_per_item: int = 3):

    # 1️⃣ Extract items
    extraction_prompt = f"""
    The user wants to achieve this goal:

    "{query}"

    List ONLY the essential grocery items or tools.
    Respond ONLY as a comma-separated list.
    Example: eggs, oil, frying pan
    """

    response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": extraction_prompt}],
        temperature=0.2
    )

    items = [
        i.strip().lower()
        for i in response.choices[0].message.content.split(",")
        if i.strip()
    ]

    # 2️⃣ Vector retrieval
    matched_docs = {}

    for item in items:
        vector = get_embedding(item)
        docs = db.similarity_search_by_vector(vector, k=limit_per_item)

        for d in docs:
            pid = d.metadata.get("product_id")
            availability = d.metadata.get("availability", 0)

            content = normalize_text(d.page_content)
            if pid and availability > 0 and item in content:
                matched_docs[pid] = d

    if not matched_docs:
        return "No matching product found in our catalogue.",[]

    # 3️⃣ Build RAG-style context
    context_parts = []

    for d in matched_docs.values():
        stock_msg = "IN STOCK" if d.metadata.get("availability", 0) > 0 else "OUT OF STOCK"
        context_parts.append(
            f"{d.page_content}\nStock status: {stock_msg}"
        )

    context = "\n\n".join(context_parts)

    # 4️⃣ LLM formatting (same as ask_rag)
    prompt = f"""
Respond like a helpful ecommerce shopping assistant.

You MUST answer using ONLY the DATABASE CONTENT below.

DATABASE CONTENT START
---------------------
{context}
---------------------
DATABASE CONTENT END

Include:
- product name
- price
- key features
- stock status
- available quantity

DO NOT suggest unrelated side dishes, snacks, or drinks unless the user explicitly asks for them.

USER QUERY:
{query}

DATABASE ANSWER:
"""

    response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2
    )

    reply = response.choices[0].message.content
    final_docs = filter_mentioned_docs(reply, list(matched_docs.values()))
    return reply, final_docs


def is_goal_query(query: str) -> bool:
    goal_keywords = [
        "make",
        "prepare",
        "cook",
        "recipe",
        "bake",
        "fry",
        "i am looking for",
        "i want to",
        "i need ",
    ]

    q = query.lower()

    return any(word in q for word in goal_keywords)

# def handle_active_product_query(product_id: int, query: str):

#     conn = get_mysql_connection()
#     cursor = conn.cursor(dictionary=True)

#     cursor.execute(
#         "SELECT * FROM products WHERE id = %s",
#         (product_id,)
#     )

#     row = cursor.fetchone()
#     cursor.close()
#     conn.close()

#     if not row:
#         return "Product not found."

#     q = normalize_text(query)

#     # Deterministic field mapping
#     if "brand" in q:
#         return f"Brand: {row['brand']}"

#     if "price" in q:
#         return f"Price: {row['price']} rupees"

#     if "availability" in q or "stock" in q or "quantity" in q:
#         stock_status = "IN STOCK" if row["availability"] > 0 else "OUT OF STOCK"
#         return (
#             f"Stock Status: {stock_status}\n"
#             f"Available Quantity: {row['availability']}"
#         )

#     if "category" in q:
#         return f"Category: {row['category']}"

#     # fallback to LLM formatting if needed
#     return format_product_with_llm(row, query)

def handle_active_product_query(product_ids: list[int], query: str):
    if not product_ids:
        return "Product not found."

    # Create dynamic placeholders for the SQL IN clause
    format_strings = ','.join(['%s'] * len(product_ids))
    
    conn = get_mysql_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute(
        f"SELECT * FROM products WHERE id IN ({format_strings})",
        tuple(product_ids)
    )

    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    if not rows:
        return "Products not found."

    # Let the LLM handle formatting for multiple products
    return format_products_with_llm(rows, query)

def format_products_with_llm(product_rows: list[dict], query: str):
    prompt = f"""
You are a helpful ecommerce assistant.

Active products data:
{product_rows}

User question:
{query}


Instructions:
- Answer naturally and concisely. If there are multiple products in the data, specify which one you are referring to based on the user's question.
- ALWAYS use "rupees" or "₹" for prices. NEVER use the "$" sign.
"""

    response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2
    )

    return response.choices[0].message.content

def format_product_with_llm(product_row: dict, query: str):

    prompt = f"""
You are a helpful ecommerce assistant.

Product data:
{product_row}

User question:
{query}

Answer naturally and concisely.
"""

    response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2
    )

    return response.choices[0].message.content


# def _update_active_product_from_query(session_id: str, query: str):
#     matched_name = find_best_product_name_match(query)

#     if not matched_name:
#         return

#     conn = get_mysql_connection()
#     cursor = conn.cursor(dictionary=True)

#     cursor.execute(
#         """
#         SELECT *
#         FROM products
#         WHERE LOWER(name) LIKE LOWER(%s)
#         ORDER BY availability DESC
#         LIMIT 1
#         """,
#         (f"%{matched_name}%",)
#     )
#     row = cursor.fetchone()

#     cursor.close()
#     conn.close()

#     if not row:
#         return

#     state = get_conversation_state(session_id)
#     # state["active_product"] = {
#     #     "product_id": row["id"],
#     #     "content": product_to_text(row)
#     # }

#     new_product = {
#         "product_id": row["id"],
#         "content": product_to_text(row)
#     }

#     existing_products = [p for p in state.get("active_products", []) if p["product_id"] != row["id"]]
#     state["active_products"] = [new_product]

#     last_shown = state.get("last_shown_products", [])
#     if row["id"] not in last_shown:
#         last_shown = [row["id"]] + last_shown[:9]
#     state["last_shown_products"] = last_shown

#     save_conversation_state(session_id, state)

def _update_active_products_from_sql_rows(session_id: str, query: str, rows: list):
    names = []
    
    # 1. Try to get exact names directly from the SQL results (Best case)
    if rows:
        names = [row["name"] for row in rows if "name" in row]

    # 2. FALLBACK: If SQL didn't return a name column (e.g., aggregate queries)
    # or failed entirely, use your fuzzy matcher to catch partial names!
    if not names:
        fuzzy_match = find_best_product_name_match(query)
        if fuzzy_match:
            names = [fuzzy_match]

    if not names:
        return

    # Look up the full product data for all these names
    conn = get_mysql_connection()
    cursor = conn.cursor(dictionary=True)

    # Use LOWER() to ensure case-insensitive matching with your fuzzy cache
    format_strings = ','.join(['%s'] * len(names))
    cursor.execute(
        f"SELECT * FROM products WHERE LOWER(name) IN ({format_strings})",
        tuple([n.lower() for n in names])
    )
    full_products = cursor.fetchall()
    cursor.close()
    conn.close()

    if not full_products:
        return

    state = get_conversation_state(session_id)
    
    new_active = []
    product_ids = []
    
    for p in full_products:
        new_active.append({
            "product_id": p["id"],
            "content": product_to_text(p)
        })
        product_ids.append(p["id"])

    # Overwrite the active products so the frontend has the exact list
    state["active_products"] = new_active

    last_shown = state.get("last_shown_products", [])
    for pid in product_ids:
        if pid not in last_shown:
            last_shown = [pid] + last_shown
    state["last_shown_products"] = last_shown[:10]

    save_conversation_state(session_id, state)

def _update_active_product_from_docs(session_id: str, docs: list):
    # if not docs:
    #     return

    state = get_conversation_state(session_id)

    if not docs:
        # Clear stale memory instead of returning early
        state["active_products"] = []
        save_conversation_state(session_id, state)
        return

    product_ids = [
        d.metadata.get("product_id")
        for d in docs
        if d.metadata.get("product_id") is not None
    ]

    # if not product_ids:
    #     return

    if not product_ids:
        state["active_products"] = []
        save_conversation_state(session_id, state)
        return

    # Set last shown products
    state["last_shown_products"] = product_ids

    # Set most relevant as active
    state["active_products"] = [
        {
            "product_id": d.metadata.get("product_id"),
            "content": d.page_content
        } for d in docs
    ]

    save_conversation_state(session_id, state)

# @app.post("/chat")
# def chat(req: ChatRequest):

#     started_at = perf_counter()
#     query_type = route_query(req.message)

#     state = get_conversation_state(req.session_id)
#     active_product = state.get("active_products",[])    

#     should_persist_here = True

#     if is_goal_query(req.message):
#         reply,docs = handle_goal_based_query(req.message, req.session_id)
#         _update_active_product_from_docs(req.session_id, docs)
#     elif (
#         active_product
#         and not has_explicit_product_name(req.message)
#         and not is_recommendation_query(req.message)
#         and not is_goal_query(req.message)
#     ):
#         product_ids = [p["product_id"] for p in active_product]
#         reply = handle_active_product_query(
#         product_ids,
#         req.message
#     )
#     else:
#         # query_type = route_query(req.message)

#         if query_type == QUERY_TYPE_SQL:
#             sql_query = generate_sql(req.message)
#             reply = handle_structured_query(sql_query, req.message)
#             _update_active_product_from_query(req.session_id, req.message)
#         else:
#             reply = ask_rag(req.message, req.session_id)
#             should_persist_here = False

#     if should_persist_here:
#         save_message(req.session_id, "user", req.message)
#         save_message(req.session_id, "assistant", reply)

#     elapsed_ms = int((perf_counter() - started_at) * 1000)
#     print(f"[chat] latency_ms={elapsed_ms}")

#     return {"reply": reply}


# @app.get("/vector-all")
# def vector_all():
#     data = db._collection.get()
#     return {
#         "ids": data["ids"],
#         "documents": data["documents"],
#         "metadatas": data["metadatas"]
#     }
# (e.g., "highest rated", "how many items", "best selling")

def agentic_route_query(query: str, has_active_context: bool) -> str:
    """
    LLM-based Intent Classifier for routing queries to the correct RAG pipeline.
    Uses Chain-of-Thought reasoning for high-accuracy routing.
    """

    matched_name = find_best_product_name_match(query)
    
    # Give the LLM absolute clarity on what to do with the matched name
    hint = f"\n[SYSTEM HINT]: The user mentioned a known database product: '{matched_name}'. " if matched_name else "\n[SYSTEM HINT]: No specific product name detected."

    prompt = f"""
    You are an elite, highly precise Data Router for an e-commerce assistant.
    Your job is to analyze the user's query and route it to EXACTLY ONE of 6 pipelines.

    INPUT DATA:
    - User Query: "{query}"
    - Has Active Screen Context: {has_active_context} {hint}

    ROUTING DEFINITIONS (Strictly mutually exclusive):

    1. "navigate" -> UI ACTION. The user explicitly wants to OPEN, VIEW, or GO TO a specific product page, OR they are selecting an item from a list (e.g., "open the first one", "click on the bread", "view the greek yogurt"). Do NOT use this for general questions.
    
    2. "sql" -> EXACT DATA & ANALYTICS. The user is asking for specific facts (price, stock, details) about a EXPLICITLY NAMED product (e.g., "what is the price of Whole Wheat Bread?"), OR asking aggregate data questions ("best selling items", "how many items in stock").
    
    3. "planner" -> BUDGETS & MULTI-DAY. The user explicitly mentions a BUDGET limit (e.g., "under 500 rupees") OR asks for a multi-day schedule (e.g., "weekly meal planner", "3-day diet"). 
    
    4. "goal" -> TASKS & RECIPES. The user wants to achieve a single task, prepare for an event, cook a recipe, or needs a list of complementary items (e.g., "I want to bake a cake", "what do I need for pasta", "I am packing a school lunch"). 
    
    5. "follow_up" -> PRONOUNS & REFINEMENT. The user is referring to something already on the screen using pronouns ("how much is it?", "is this in stock?") OR asking for related items ("show me things similar to that"). CRITICAL: You can ONLY output this if 'Has Active Screen Context' is True.
    
    6. "vector" -> BROAD DISCOVERY & CHIT-CHAT. The user is asking for general recommendations, subjective opinions, browsing broad categories, or expressing feelings (e.g., "recommend healthy snacks", "I feel sad what should I eat?", "show me electronics").

    OUTPUT FORMAT:
    You must output a strict JSON object. 
    First, write a 1-sentence "reasoning" explaining WHY you chose the category based on the definitions above.
    Second, output the exact "intent" string.

    Example Output:
    {{
        "reasoning": "The user asked for the price of 'Eggs', which is a specific data request for a named product, fitting the 'sql' intent.",
        "intent": "sql"
    }}
    """
    
    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile", # 🚀 Powered by the 70B Brain
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0, 
            response_format={"type": "json_object"} 
        )
        
        result = json.loads(response.choices[0].message.content)
        intent = result.get("intent", "vector").lower()
        
        # Fallback safeguard
        valid_intents = ["planner", "goal", "follow_up", "navigate", "sql", "vector"]
        if intent not in valid_intents:
            return "vector"
            
        return intent
        
    except Exception as e:
        print(f"[Router Error] Falling back to vector: {e}")
        return "vector"
    

def handle_navigate_query(query: str, session_id: str, active_products: list):
    active_context = []
    for i, p in enumerate(active_products):
        # Extract just the Name from memory to help the LLM
        name_match = re.search(r"Product Name:\s*(.*)", p.get('content', ''))
        p_name = name_match.group(1).strip() if name_match else "Unknown"
        active_context.append(f"Index {i+1}: ID={p['product_id']}, Name: {p_name}")
        
    prompt = f"""
    User wants to open or show a product page.
    Query: "{query}"
    Currently active products in memory (from a previous search):
    {chr(10).join(active_context) if active_context else "None"}
    
    Task:
    1. If the user refers to a position (e.g., "first one", "second product") OR a specific name from the active products list, return action "ID" and the corresponding ID from memory.
    2. If the user asks for a new product, return action "SEARCH" and the core product name to search for (e.g., query "show sausage" -> value "sausage").
    
    Output JSON exactly in this format:
    {{"action": "ID" or "SEARCH", "value": "<product_id_as_string_or_search_string>"}}
    """
    
    try:
        response = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            response_format={"type": "json_object"}
        )
        data = json.loads(response.choices[0].message.content)
    except:
        return "I couldn't process that navigation request.", None
        
    if data.get("action") == "ID":
        pid = int(data.get("value"))
        return "Opening the product on your screen.", pid
        
    elif data.get("action") == "SEARCH":
        search_term = str(data.get("value")).lower()
        
        conn = get_mysql_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM products WHERE LOWER(name) LIKE %s LIMIT 5", (f"%{search_term}%",))
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        
        if len(rows) == 1:
            # Found exactly 1 match -> Save to memory & Navigate
            _update_active_products_from_sql_rows(session_id, query, rows)
            return f"Opening {rows[0]['name']} on your screen.", rows[0]["id"]
            
        elif len(rows) > 1:
            # Found multiple matches -> Save all to memory & ASK user!
            _update_active_products_from_sql_rows(session_id, query, rows)
            names = [f"{r['name']} by {r['brand']}" for r in rows]
            return f"I found multiple products matching that: {', '.join(names)}. Which one would you like me to open?", None
            
        else:
            return f"I couldn't find '{search_term}' in our catalogue.", None
            
    return "I'm not sure which product you want to open.", None


def handle_planner_query(query: str, session_id: str):
    # 1. Brainstorm complementary ingredients
    extraction_prompt = f"""
    The user wants a multi-day meal schedule, diet plan, or budget grocery plan: "{query}"
    List the essential COMPLEMENTARY ingredients needed to create ACTUAL MEALS for this plan.
    Respond ONLY as a comma-separated list of generic item names.
    Example: milk, bread, eggs, oats, chicken, rice, dal, cooking oil, salt, spices, vegetables

    instructions:
    1. Maximize the Budget: Do not unnecessarily penny-pinch. Aim to use a good portion of the budget to provide filling, realistic meals.
    2. Nutritional Variety: DO NOT repeat the exact same meal (like Veg Salad Bowl) multiple times across the plan. Provide diverse options.
    """

    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": extraction_prompt}],
        temperature=0.2
    )

    items = [i.strip().lower() for i in response.choices[0].message.content.replace(".", "").split(",") if i.strip()]

    # 2. Heavy Vector Retrieval
    matched_docs = {}
    for item in items:
        vector = get_embedding(item)
        docs = db.similarity_search_by_vector(vector, k=2) 
        for d in docs:
            pid = d.metadata.get("product_id")
            if pid and d.metadata.get("availability", 0) > 0:
                matched_docs[pid] = d

            if len(matched_docs) >= 20:
                break

        if len(matched_docs) >= 20:
                break

    if not matched_docs:
        return "I couldn't find enough products to build this meal plan.", []

    context_parts = [f"{d.page_content[:300]}\nStock status: IN STOCK" for d in matched_docs.values()]
    context = "\n\n".join(context_parts)

    # 3. Base Prompt for the "Actor"
    actor_prompt = f"""
    You are an expert culinary meal planner and e-commerce financial assistant.
    USER QUERY: "{query}"

    AVAILABLE PRODUCTS:
    ---------------------
    {context}
    ---------------------

    INSTRUCTIONS:
    1. Act as a Strict Cashier: The SUM of the FULL prices of every item listed MUST NOT exceed the user's budget. NEVER calculate "fractional" costs. If a bulk item blows the budget, EXCLUDE IT and find a cheaper alternative.
    2. Format cleanly with bold headings for each day (e.g., **Monday**).
    3. ONLY use products from the AVAILABLE PRODUCTS list.
    4. At the very end, provide a "**Budget Summary**" showing the exact mathematical sum.
    5. Maximize the Budget: Do not unnecessarily penny-pinch. Aim to use a good portion of the budget to provide filling, realistic meals.
    6. Nutritional Variety: DO NOT repeat the exact same meal (like Veg Salad Bowl) multiple times across the plan. Provide diverse options.
    """

    # 🔥 THE SELF-REFLECTION LOOP 🔥
    messages = [{"role": "user", "content": actor_prompt}]
    max_attempts = 3
    final_reply = ""

    for attempt in range(max_attempts):
        # Step A: The Actor generates a draft
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            temperature=0.1
        )
        draft_plan = response.choices[0].message.content

        # Step B: The Critic reviews the math and logic
        # Step B: The Critic reviews the math and logic using Chain of Thought
        critic_prompt = f"""
        You are a strict QA Financial Auditor. 
        The user's original request was: "{query}"
        
        Review this proposed meal plan:
        {draft_plan}

        You MUST do the math out loud to catch errors.
        TASK:
        1. Write down a list of every single item proposed and its exact price.
        2. Calculate the true mathematical sum of those prices step-by-step.
        3. Compare your true sum to the user's stated budget.
        4. Did the planner use fractional math (e.g., "used 1kg of a 5kg bag")?
        
        After doing your math, on the very LAST line of your response, output your final verdict:
        If the plan is under budget and uses no fractional math, write EXACTLY: "RESULT: PASS"
        If it fails, write EXACTLY: "RESULT: FAIL - The true total is [X]. You must remove some items (like the expensive Dal or Ketchup) to get under budget."
        """

        critic_response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": critic_prompt}],
            temperature=0.0 # 0.0 for strict math
        )
        critic_feedback = critic_response.choices[0].message.content.strip()

        # Step C: Decide whether to loop or deliver to user
        if "RESULT: PASS" in critic_feedback:
            print(f"[Planner] Attempt {attempt + 1} PASSED audit.")
            final_reply = draft_plan
            break
        # else:
        #     print(f"[Planner] Attempt {attempt + 1} FAILED audit:\n{critic_feedback}")
        #     # Send the critic's exact step-by-step math back to the Actor so it sees its mistake!
        #     messages.append({"role": "assistant", "content": draft_plan})
        #     messages.append({"role": "user", "content": f"CRITICAL FEEDBACK FROM AUDITOR:\n{critic_feedback}\n\nYou failed the math. Please rewrite the plan and remove items until the true mathematical sum is under budget."})
            
        #     final_reply = draft_plan
        else:
            print(f"[Planner] Attempt {attempt + 1} FAILED audit:\n{critic_feedback}")
            # Reset the messages array instead of appending to it! 
            # We only send the original prompt + the new auditor feedback, dropping the massive draft_plan.
            messages = [
                {"role": "user", "content": actor_prompt},
                {"role": "user", "content": f"Your previous attempt failed the math audit. Remove items until the true mathematical sum is under budget.\n\nCRITICAL FEEDBACK FROM AUDITOR:\n{critic_feedback}"}
            ]
            
            final_reply = draft_plan

    final_docs = filter_mentioned_docs(final_reply, list(matched_docs.values()))
    return final_reply, final_docs


def handle_smart_follow_up(query: str, session_id: str, active_products: list):
    # 1. Grab the raw text of the active products so the LLM has total context
    active_texts = [p.get('content', '') for p in active_products]
    active_str = "\n".join(active_texts) if active_texts else "Unknown Product"

    # 2. The Sub-Router Prompt
    prompt = f"""
    The user is asking a follow-up question about the item(s) currently on their screen.
    
    ITEMS ON SCREEN:
    {active_str}
    
    User Query: "{query}"

    Task:
    1. If the user wants details about the CURRENT item (e.g., "what is the price?", "is it in stock?", "brand?"), output action "DETAILS".
    2. If the user wants OTHER, NEW, or RELATED items (e.g., "what goes well with it?", "similar products", "suggest alternatives"), output action "SEARCH".
       - If "SEARCH", you MUST rewrite their query to replace pronouns ("it", "this") with the actual item names found in the ITEMS ON SCREEN text.
       - CRITICAL: If there are MULTIPLE items on screen, you MUST include ALL of their names in your rewritten query. Do not just pick one.
       - Example: "which related products to it" -> "products related to Chicken Sausage Pack"

    Output ONLY valid JSON:
    {{"action": "DETAILS" or "SEARCH", "search_query": "<clean search phrase if SEARCH, else empty>"}}
    """
    
    try:
        response = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            response_format={"type": "json_object"}
        )
        data = json.loads(response.choices[0].message.content)
    except:
        data = {"action": "DETAILS"}

    # 3. Route dynamically based on the LLM's decision
    if data.get("action") == "SEARCH":
        clean_query = data.get("search_query", query)
        print(f"[Follow-up Sub-Router] Redirecting to Vector Search with: '{clean_query}'")
        
        # 🔥 We attach the secret note to llm_query
        llm_query = f"{query} (Secret Note: Search the database for items matching '{clean_query}'. If there are NO logical matches in the database, DO NOT invent products. Just say you don't have any related items.)"
        
        # 🔥 FIX: We correctly pass llm_query AND active_context_string here!
        return ask_rag(query=llm_query, session_id=session_id, search_query=clean_query, active_context_string=active_str), False
        
    else:
        print("[Follow-up Sub-Router] Fetching Active Product Details")
        product_ids = [p["product_id"] for p in active_products]
        return handle_active_product_query(product_ids, query), True

@app.post("/chat")
def chat(req: ChatRequest):
    started_at = perf_counter()

    state = get_conversation_state(req.session_id)
    active_product = state.get("active_products", [])    
    has_active = len(active_product) > 0

    # 🚀 Step 1: Agentic Intent Classification
    intent = agentic_route_query(req.message, has_active)
    print(f"[chat] Extracted Intent: {intent}")

    should_persist_here = True
    navigate_to = None


    if intent == "navigate":
        # Call our new function
        reply, navigate_to = handle_navigate_query(req.message, req.session_id, active_product)

    # 🚀 Step 2: Route to the existing handlers based on LLM intent
    elif intent == "goal":
        reply, docs = handle_goal_based_query(req.message, req.session_id)
        _update_active_product_from_docs(req.session_id, docs)
        
    elif intent == "follow_up" and has_active:
        # Dynamically handle the follow-up using the LLM sub-router
        reply, should_persist_here = handle_smart_follow_up(req.message, req.session_id, active_product)
        
    elif intent == "sql":
        sql_query = generate_sql(req.message)
        reply, rows = handle_structured_query(sql_query, req.message)
        
        # 🔥 NEW: FALLBACK TO VECTOR SEARCH IF SQL FINDS NOTHING 🔥
        if not rows:
            print("[chat] SQL returned empty. Falling back to semantic vector search.")
            reply = ask_rag(req.message, req.session_id)
            # ask_rag handles its own state persistence in your setup
            should_persist_here = False 
        else:
            # If SQL did find something, update the active products normally
            _update_active_products_from_sql_rows(req.session_id, req.message, rows)

    elif intent == "planner":
        reply, docs = handle_planner_query(req.message, req.session_id)
        _update_active_product_from_docs(req.session_id, docs)
        
    else:
        # intent == "vector" or any fallback
        reply = ask_rag(req.message, req.session_id)
        should_persist_here = False

    # 🚀 Step 3: Persist state if required
    if should_persist_here:
        save_message(req.session_id, "user", req.message)
        save_message(req.session_id, "assistant", reply)

    elapsed_ms = int((perf_counter() - started_at) * 1000)
    print(f"[chat] total latency_ms={elapsed_ms}")

    return {"reply": reply, "navigate_to": navigate_to}

@app.delete("/chat/history/{session_id}")
def clear_chat_history(session_id: str):
    # Delete the chat messages, the active session products, and the conversation state
    redis_client.delete(f"chat:{session_id}")
    redis_client.delete(f"session_products:{session_id}")
    redis_client.delete(f"conv_state:{session_id}")
    
    return {"status": "success", "message": "Chat history cleared"}


class ReviewPayload(BaseModel):
    review_id: int    # IMPORTANT: Pass this from Node.js (result.insertId)
    product_id: int
    review_text: str

@app.post("/process-review-sentiment")
def process_review_sentiment(payload: ReviewPayload):
    try:
        # ---------------------------------------------------------
        # 1. Analyze Individual Sentiment (Forced JSON Output)
        # ---------------------------------------------------------
        sentiment_prompt = f"""
        Analyze this product review and return ONLY valid JSON with two keys:
        - "score": an integer from 1 to 10 (1 is worst, 10 is best)
        - "label": exactly one of "Positive", "Neutral", or "Negative"
        
        Review: "{payload.review_text}"
        """
        
        response = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": sentiment_prompt}],
            temperature=0.0, 
            response_format={"type": "json_object"} 
        )
        
        sentiment_data = json.loads(response.choices[0].message.content)
        score = sentiment_data.get("score", 5)
        label = sentiment_data.get("label", "Neutral")
        
        conn = get_mysql_connection()
        cursor = conn.cursor(dictionary=True)
        
        # ---------------------------------------------------------
        # 2. Update the specific review in the DB
        # ---------------------------------------------------------
        cursor.execute("""
            UPDATE product_reviews 
            SET sentiment_score = %s, sentiment_label = %s 
            WHERE id = %s
        """, (score, label, payload.review_id))
        
        # ---------------------------------------------------------
        # 3. Recalculate Overall Score
        # ---------------------------------------------------------
        cursor.execute("""
            SELECT AVG(sentiment_score) as avg_score 
            FROM product_reviews 
            WHERE product_id = %s AND sentiment_score IS NOT NULL
        """, (payload.product_id,))
        avg_result = cursor.fetchone()
        
        calculated_average_score = float(avg_result['avg_score']) if avg_result['avg_score'] else float(score)
        
        # ---------------------------------------------------------
        # 4. Rolling Window Summary
        # ---------------------------------------------------------
        cursor.execute("""
            SELECT COUNT(*) as total_reviews 
            FROM product_reviews 
            WHERE product_id = %s
        """, (payload.product_id,))
        review_count = cursor.fetchone()['total_reviews']

        if review_count <= 3 or review_count % 5 == 0:
            
            # --- RUN THE LLM SUMMARY ---
            cursor.execute("""
                SELECT review_text, sentiment_label
                FROM product_reviews 
                WHERE product_id = %s 
                ORDER BY created_at DESC 
                LIMIT 20
            """, (payload.product_id,))
            recent_reviews = cursor.fetchall()
            
            combined_text = " | ".join([
                f"[{r.get('sentiment_label', 'Neutral')}] {r['review_text']}" 
                for r in recent_reviews
            ])
            summary_prompt = f"""
            Summarize the overall sentiment of these customer reviews in ONE concise sentence. 
            Use the provided [Positive/Neutral/Negative] tags to understand the exact context of each review.
            
            Reviews: {combined_text}
            """
            
            summary_response = groq_client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": summary_prompt}],
                temperature=0.1,
                max_tokens=60
            )
            new_summary = summary_response.choices[0].message.content.strip()
            
            # UPSERT: Insert if new, Update if exists
            cursor.execute("""
                INSERT INTO review_summary (product_id, avg_sentiment_score,summarized_review) 
                VALUES (%s, %s, %s)
                ON DUPLICATE KEY UPDATE 
                summarized_review = VALUES(summarized_review), 
                avg_sentiment_score = VALUES(avg_sentiment_score)
            """, (payload.product_id,calculated_average_score, new_summary))
            
        else:
            # --- SKIP THE LLM, JUST UPDATE THE MATH ---
            # UPSERT: Only update the math, don't touch the summary text
            cursor.execute("""
                INSERT INTO review_summary (product_id, avg_sentiment_score) 
                VALUES (%s, %s)
                ON DUPLICATE KEY UPDATE 
                avg_sentiment_score = VALUES(avg_sentiment_score)
            """, (payload.product_id, calculated_average_score))
            
            new_summary = "Summary unchanged (waiting for threshold)."

        # 🔥 MISSING PIECE: Commit the changes and close connections!
        conn.commit()
        cursor.close()
        conn.close()

        return {
            "status": "success", 
            "new_summary": new_summary, 
            "avg_score": calculated_average_score
        }

    except Exception as e:
        print(f"[Process Review Error]: {e}")
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()
        raise HTTPException(status_code=500, detail=str(e))
