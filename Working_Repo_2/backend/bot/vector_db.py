# ===================================
# VECTOR DB BUILDER (RUN THIS ONCE)
# MySQL → Chroma
# ===================================

import os
import shutil
from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from DATA import load_docs


# -------------------------
# 1. Absolute path (VERY IMPORTANT)
# avoids relative path bugs
# -------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "product_db")


# -------------------------
# 2. Load docs from MySQL
# -------------------------
print("Loading products from MySQL...")
docs = load_docs()

# docs format:
# [
#   {
#     "text": "...",
#     "metadata": {"product_id": 1, "availability": 10}
#   }
# ]


# -------------------------
# 3. Split into texts + metadata
# -------------------------
texts = [d["text"] for d in docs]
metadatas = [d["metadata"] for d in docs]

print(f"Total products loaded: {len(texts)}")


# -------------------------
# 4. Load embedding model
# -------------------------
print("Loading embeddings...")

emb = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)


# -------------------------
# 5. Rebuild DB cleanly
# (delete old to avoid duplicates)
# -------------------------
# if os.path.exists(DB_PATH):
#     shutil.rmtree(DB_PATH)


print("Building Chroma vector DB...")

db = Chroma.from_texts(
    texts=texts,
    metadatas=metadatas,     
    embedding=emb,
    persist_directory=DB_PATH,
    collection_name="products"
)


print(" Vector DB built successfully")
# print(f"Saved at: {DB_PATH}")