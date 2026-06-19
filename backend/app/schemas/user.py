from pydantic import BaseModel, EmailStr, Field

from app.schemas.cav import CAVRead
from app.schemas.common import ORMModel


class RoleRead(ORMModel):
    id: int
    name: str
    description: str | None = None


class UserBase(BaseModel):
    nombre_usuario: str = Field(min_length=2, max_length=120)
    correo: EmailStr
    role_id: int
    cav_id: int | None = None
    regional: str | None = Field(default=None, max_length=80)
    is_active: bool = True


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


class UserUpdate(BaseModel):
    nombre_usuario: str | None = Field(default=None, min_length=2, max_length=120)
    correo: EmailStr | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)
    role_id: int | None = None
    cav_id: int | None = None
    regional: str | None = Field(default=None, max_length=80)
    is_active: bool | None = None


class UserRead(UserBase, ORMModel):
    id: int
    role: RoleRead
    cav: CAVRead | None = None

