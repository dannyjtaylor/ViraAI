import os
import json
import logging
from fastapi import FastAPI, Request, UploadFile, File, Form
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from openai import OpenAI
import chromadb
import pdfplumber
from docx import Document
from pptx import Presentation
from langchain.text_splitter import RecursiveCharacterTextSplitter
import uvicorn

# Load environment variables
load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=api_key)

# Initialize FastAPI app
app = FastAPI()

# Logging setup
logging.basicConfig(level=logging.INFO)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request logging
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger = logging.getLogger("uvicorn.access")
    logger.info(f"{request.method} {request.url}")
    response = await call_next(request)
    return response

# File and embed config
SUPPORTED_EXTENSIONS = [".txt", ".docx", ".pptx", ".pdf"]
CACHE_FILE = "embed_cache.json"
LOG_FILE = "embedding_log.txt"
DATA_DIR = "data"

# Setup vector store
chroma_client = chromadb.Client()
collection = chroma_client.get_or_create_collection(name="city_docs")

# Static and templates
templates = Jinja2Templates(directory="templates")
app.mount("/static", StaticFiles(directory="static"), name="static")

# Helpers
def load_cache():
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, "r") as f:
            return json.load(f)
    return {}

def save_cache(cache):
    with open(CACHE_FILE, "w") as f:
        json.dump(cache, f)

def extract_text(file_path, ext):
    if ext == ".txt":
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    elif ext == ".docx":
        return "\n".join(p.text for p in Document(file_path).paragraphs)
    elif ext == ".pptx":
        prs = Presentation(file_path)
        return "\n".join(shape.text for slide in prs.slides for shape in slide.shapes if hasattr(shape, "text"))
    elif ext == ".pdf":
        with pdfplumber.open(file_path) as pdf:
            return "\n".join(page.extract_text() or "" for page in pdf.pages)
    return ""

def split_and_embed_text(full_text, filename):
    splitter = RecursiveCharacterTextSplitter(chunk_size=300, chunk_overlap=100)
    docs = splitter.create_documents([full_text])
    for i, doc in enumerate(docs):
        embedding = client.embeddings.create(
            model="text-embedding-3-small",
            input=doc.page_content
        ).data[0].embedding
        collection.add(
            documents=[f"{filename}\n\n{doc.page_content}"],
            embeddings=[embedding],
            ids=[f"{filename}_chunk_{i}"]
        )

def embed_documents(folder_path):
    cache = load_cache()
    os.makedirs(folder_path, exist_ok=True)
    with open(LOG_FILE, "w", encoding="utf-8") as log:
        for filename in os.listdir(folder_path):
            path = os.path.join(folder_path, filename)
            ext = os.path.splitext(filename)[1].lower()
            if ext not in SUPPORTED_EXTENSIONS:
                continue
            mtime = os.path.getmtime(path)
            if filename in cache and cache[filename] == mtime:
                continue
            try:
                text = extract_text(path, ext)
                split_and_embed_text(text, filename)
                cache[filename] = mtime
                log.write(f"✅ Embedded: {filename}\n")
            except Exception as e:
                log.write(f"❌ Failed: {filename} — {e}\n")
    save_cache(cache)

# Routes
@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/ask")
async def ask_question(request: Request, question: str = Form(...)):
    logging.info(f"POST /ask — Question: {question}")
    query_embedding = client.embeddings.create(
        model="text-embedding-3-small",
        input=question
    ).data[0].embedding
    results = collection.query(query_embeddings=[query_embedding], n_results=10)
    context = "\n".join(results["documents"][0])
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "You are a helpful assistant who only uses the provided context."},
            {"role": "user", "content": f"Use this info to answer:\n\n{context}\n\nQuestion: {question}"}
        ]
    )
    return {"answer": response.choices[0].message.content}

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    logging.info(f"POST /upload — File: {file.filename}")
    contents = await file.read()
    os.makedirs(DATA_DIR, exist_ok=True)
    file_path = os.path.join(DATA_DIR, file.filename)
    with open(file_path, "wb") as f:
        f.write(contents)
    embed_documents(DATA_DIR)
    return {"status": "success", "filename": file.filename}

@app.get("/logs", response_class=HTMLResponse)
async def show_logs(request: Request):
    logging.info("GET /logs")
    logs = ""
    if os.path.exists(LOG_FILE):
        with open(LOG_FILE, "r", encoding="utf-8") as f:
            logs = f.read()
    return templates.TemplateResponse("logs.html", {"request": request, "logs": logs})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
