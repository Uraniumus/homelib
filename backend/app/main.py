from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Library Bot API")

# CORS: на dev пригодится, если не используешь dev-прокси
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # на проде сузить!
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health():
    return {"status": "ok"}

class Book(BaseModel):
    title: str
    author: str | None = None

_DB: list[Book] = []

@app.post("/api/books")
def create_book(b: Book):
    _DB.append(b)
    return b

@app.get("/api/books")
def list_books():
    return _DB
