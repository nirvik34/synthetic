# 🏛️ RAG-QA Bot: Mandatory Dataset Submission

An advanced Retrieval-Augmented Generation (RAG) system built from scratch to handle the **Wikipedia (2020/2023)** and **CUAD Contract** datasets with high precision and cross-encoder re-ranking.

---

## 🚀 Quick Start (Local)

### **1. Setup Environment**
```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### **2. Import Mandatory Datasets**
Use the provided streaming script to pull specifically required data:
```bash
# Get 5 legal contracts from CUAD
python scripts/import_dataset.py --source cuad --limit 5

# Get 2 AI articles from Wikipedia 2020
python scripts/import_dataset.py --source wiki_2020 --topic "Deep Learning" --limit 2
```

### **3. Launch API & Ingest**
```bash
# Start the server
uvicorn app.main:app --port 8000

# In another terminal, ingest current docs/ folder
curl -X POST http://localhost:8000/ingest
```

### **4. Run Accuracy Benchmarks**
Verify precision against ground-truth CUAD data:
```bash
python scripts/evaluate_local.py
```

---

## 🛠️ Architecture Highlights

- **Two-Stage Retrieval**: `all-MiniLM` Bi-Encoder for search + `ms-marco` Cross-Encoder for precision re-ranking.
- **Section-Level Legal Chunking**: Specialized regex splitting for ARTICLE/SECTION headers in contracts.
- **Hallucination Guard**: Confidence thresholds and strict grounding on locally hosted `flan-t5-base`.
- **HuggingFace Streaming**: Handles GB-scale Wikipedia dumps with zero memory overhead.

---

## 🐳 Docker Deployment

The Docker image is pre-optimized with "baked-in" weights to ensure instant startup:

```bash
docker build -t rag-qa-bot .
docker run -p 8000:8000 rag-qa-bot
```

Refer to `ARCHITECTURE.md` for full system flow and design decisions.
