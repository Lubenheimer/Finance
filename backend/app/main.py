from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import auth as auth_router
from app.api.v1 import accounts as accounts_router
from app.api.v1 import categories as categories_router
from app.api.v1 import transactions as transactions_router
from app.api.v1 import imports as imports_router
from app.api.v1 import budgets as budgets_router

app = FastAPI(title="Finanzen API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router, prefix="/api/v1")
app.include_router(accounts_router.router, prefix="/api/v1")
app.include_router(categories_router.router, prefix="/api/v1")
app.include_router(transactions_router.router, prefix="/api/v1")
app.include_router(imports_router.router, prefix="/api/v1")
app.include_router(budgets_router.router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok"}
