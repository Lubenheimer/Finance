import uuid
from pydantic import BaseModel


class CategoryResponse(BaseModel):
    id: uuid.UUID
    parent_id: uuid.UUID | None
    name: str
    icon: str | None
    color: str | None
    kind: str
    position: int

    model_config = {"from_attributes": True}


class CategoryCreate(BaseModel):
    name: str
    parent_id: uuid.UUID | None = None
    icon: str | None = None
    color: str | None = None
    kind: str = "expense"
    position: int = 0
