from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class CAVBase(BaseModel):
    nombre_cav: str = Field(min_length=2, max_length=120)
    centro_costos: str = Field(min_length=2, max_length=120)
    regional: str | None = Field(default=None, max_length=80)


class CAVCreate(CAVBase):
    pass


class CAVUpdate(BaseModel):
    nombre_cav: str | None = Field(default=None, min_length=2, max_length=120)
    centro_costos: str | None = Field(default=None, min_length=2, max_length=120)
    regional: str | None = Field(default=None, max_length=80)


class CAVRead(CAVBase, ORMModel):
    id: int

