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
from fastapi import HTTPException

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


RAG_TOP_K = 5
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


# -------------------------
# 6. Core RAG logic (OPTIMIZED FOR PURE INTENT)
# -------------------------
def ask_rag(query: str, session_id: str, k: int = RAG_TOP_K):
    
    # 1. NO MORE HISTORY BLENDING. We use the pure, isolated query for retrieval.
    query_vector = get_embedding(query)

    # 2. Get expanded semantic terms (your existing logic)
    expanded_query = build_semantic_query(query)

    doc_map = {}

    # 3. Retrieve based ONLY on the user's current specific intention
    vector_docs_plain = db.similarity_search_by_vector(query_vector, k=max(k, 8))
    for d in vector_docs_plain:
        pid = d.metadata.get("product_id")
        if pid:
            doc_map[pid] = d

    if expanded_query != query:
        expanded_vector = get_embedding(expanded_query)
        vector_docs_expanded = db.similarity_search_by_vector(expanded_vector, k=max(k, 8))
        for d in vector_docs_expanded:
            pid = d.metadata.get("product_id")
            if pid:
                doc_map[pid] = d

    # 4. Rerank and strictly limit to top K matches
    docs = list(doc_map.values())
    docs = rerank_docs_by_query(docs, query)
    docs = docs[:k]

    print("Retrieved purely semantic docs:", len(docs))

    if not docs:
        return "Sorry, I couldn't find products matching your request."

    # 5. Build context WITH stock info
    context_parts = []
    for d in docs:
        availability = d.metadata.get("availability", 0)
        stock_msg = "IN STOCK" if availability > 0 else "OUT OF STOCK"
        context_parts.append(f"{d.page_content}\nStock status: {stock_msg}")

    context = "\n\n".join(context_parts)

    # 6. Fetch minimal history just for conversational flow in the prompt
    history = get_history(session_id)
    recent_history = ""
    # Only pull the last 2 messages so the LLM remembers the immediate context, 
    # rather than the last 6 which confuses it.
    for msg in history[-1:]: 
        recent_history += f"{msg['role']}: {msg['content'][:200]}\n"

    prompt = f"""
Respond like a helpful ecommerce shopping assistant.

You MUST answer using ONLY the DATABASE CONTENT below.

CONVERSATION HISTORY (For conversational tone only):
---------------------
{recent_history}

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
- if product is not present do not recommend other products.

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

    save_message(session_id, "user", query)
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


def rerank_docs_by_query(docs, query: str):
    query_tokens = set(tok for tok in normalize_text(query).split() if len(tok) >= 3)

    if not query_tokens:
        return docs

    def score(doc):
        content = normalize_text(doc.page_content)
        content_tokens = set(content.split())
        overlap = len(query_tokens.intersection(content_tokens))

        # small boost for available products
        availability = doc.metadata.get("availability", 0) or 0
        stock_boost = 1 if availability > 0 else 0

        return overlap + stock_boost

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
- category: broad category (e.g., 'Bread', 'Dairy', 'Snacks')
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
        model="llama-3.1-8b-instant",
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

Answer naturally and concisely. If there are multiple products in the data, specify which one you are referring to based on the user's question.
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
    Returns one of: 'goal', 'follow_up', 'sql', 'vector','navigate','planner'.
    """

    matched_name = find_best_product_name_match(query)
    # hint = f"\nCRITICAL HINT: The user explicitly mentioned '{matched_name}', which is a known product in the database. You MUST route this to 'sql' so we can fetch its exact details." if matched_name else ""
    # 👇 Update the hint to allow navigation and vector searches
    matched_name = find_best_product_name_match(query)
    hint = f"\nCRITICAL HINT: The text matches a product ('{matched_name}'). If explicitly asking the UI to OPEN/SHOW/VIEW it, route to 'navigate'. If expressing a goal or needing recommendations, route to 'goal' or 'vector'. ONLY route to 'sql' if explicitly asking for raw price/stock data." if matched_name else ""
    prompt = f"""
    You are an expert routing agent for an e-commerce assistant.
    Classify the user's query into EXACTLY ONE of these 6 intents:

    1. "goal": The user wants to achieve a task, prepare for an event, cook a recipe, or needs a list of items (e.g., "I want to bake a cake", "I am sending my brother to school", "what do I need for pasta"). Do NOT use this if they mention days or budgets or plan.
    2. "follow_up": The user is asking about an item currently in context using pronouns ("it", "this", "that") or asking a direct follow-up without specifying the product name (e.g., "what is its price", "is it in stock?"). NOTE: Only select this if has_context is True.
    3. "sql": The user mentions a specific product name (e.g., "Show me Greek Yogurt", "Price of Whole Wheat Bread") OR asks an analytical/aggregate question.
    4. "vector": The user is asking for general recommendations, browsing categories, or fuzzy searches (e.g., "recommend healthy snacks", "show me electronics", "what should I buy").
    5. "navigate": The user explicitly commands the UI to OPEN, SHOW, VIEW, or GO TO a specific product page, OR is selecting an item from a list (e.g., "open the first one", "view greek yogurt"). NEVER use this for general conversational statements or goals like "I am going to school".
    6. "planner": The user explicitly asks for a schedule, a multi-day plan, or mentions a specific BUDGET they want to spread out (e.g., "weekly meal planner", "budget of 500", "plan a 3-day breakfast").
    Output ONLY a valid JSON object with a single key "intent".

    User query: "{query}"
    has_context: {has_active_context}{hint}
    """
    
    try:
        response = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0, # 0 temperature for strict, deterministic routing
            response_format={"type": "json_object"} # Forces valid JSON output
        )
        
        result = json.loads(response.choices[0].message.content)
        intent = result.get("intent", "vector").lower()
        
        # Fallback safeguard if the LLM hallucinates a weird intent
        valid_intents = ["planner", "goal", "follow_up", "navigate", "sql", "vector"]
        if intent not in valid_intents:
            return "vector"
            
        return intent
        
    except Exception as e:
        print(f"[Router Error] Falling back to vector: {e}")
        return "vector" # Safe fallback
    

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
    # 1. Brainstorm complementary ingredients for actual meals
    extraction_prompt = f"""
    The user wants a multi-day meal schedule, diet plan, or budget grocery plan: "{query}"
    List the essential COMPLEMENTARY ingredients needed to create ACTUAL MEALS for this plan.
    Respond ONLY as a comma-separated list of generic item names. Include a mix of proteins, carbs, spices, and drinks/snacks.
    Example: milk, bread, eggs, oats, chicken, rice, dal, cooking oil, salt, spices, vegetables
    """

    response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": extraction_prompt}],
        temperature=0.2
    )

    items = [i.strip().lower() for i in response.choices[0].message.content.replace(".", "").split(",") if i.strip()]

    # 2. Heavy Vector Retrieval (Pull more items for variety)
    matched_docs = {}
    for item in items:
        vector = get_embedding(item)
        # Pull top 5 per category to give the planner plenty of budget options
        docs = db.similarity_search_by_vector(vector, k=5) 
        for d in docs:
            pid = d.metadata.get("product_id")
            if pid and d.metadata.get("availability", 0) > 0:
                matched_docs[pid] = d

    if not matched_docs:
        return "I couldn't find enough products to build this meal plan.", []

    # 3. Build RAG Context
    context_parts = [f"{d.page_content}\nStock status: IN STOCK" for d in matched_docs.values()]
    context = "\n\n".join(context_parts)

    # 4. Strict Meal & Financial Planner Prompt
    # 4. Strict Meal & Financial Planner Prompt
    prompt = f"""
    You are an expert culinary meal planner and e-commerce financial assistant.

    USER QUERY: "{query}"

    AVAILABLE PRODUCTS (from our database):
    ---------------------
    {context}
    ---------------------

    INSTRUCTIONS:
    1. Identify the Duration: Determine EXACTLY how many days the user is asking for. If they say "for my day", "today", or "one day", ONLY plan for ONE single day. Do not generate a whole week unless asked.
    2. Act as a Meal Planner: Group the available products into logical, delicious MEALS for the requested timeframe. 
    3. Act as a Strict Accountant: Respect the user's stated BUDGET. 
       - ALWAYS prioritize cheaper alternatives in the database (e.g., pick a 100 rupee 1kg bag instead of a 649 rupee 5kg bag) to ensure the cart stays affordable.
       - If the plan is ONLY for 1 day, the TOTAL CART COST must NOT exceed the budget. You cannot suggest a bulk item that costs more than the budget itself.
       - If the plan is for MULTIPLE days, you can suggest a bulk item on Day 1, but explicitly explain that it covers the rest of the days.
    4. Format your response cleanly with bold headings for each day (e.g., **Monday**).
    5. For each day, provide:
       - **Meal Idea** (e.g., "Dal & Rice")
       - **Items to Use**: List the specific products from the database needed, including Product Name and Price.
    6. ONLY use products from the AVAILABLE PRODUCTS list. DO NOT invent items, prices, or brands.
    7. At the very end, provide a "**Budget Summary**" showing the Estimated Total Cost.

    Make the response beautiful, appetizing, and highly practical.

    PLANNER RESPONSE:
    """

    response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2 # Low temp for reliable formatting and math
    )

    reply = response.choices[0].message.content
    final_docs = filter_mentioned_docs(reply, list(matched_docs.values()))
    
    return reply, final_docs

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
        # 🔥 FIX: Grab ALL product IDs currently in memory
        product_ids = [p["product_id"] for p in active_product] 
        reply = handle_active_product_query(product_ids, req.message)
        
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
