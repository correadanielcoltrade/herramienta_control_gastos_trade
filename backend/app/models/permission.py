from sqlalchemy import String, Integer, ForeignKey, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


# Association table for Role-Permission many-to-many relationship
role_permissions = Table(
    'role_permissions',
    Base.metadata,
    mapped_column('role_id', Integer, ForeignKey('roles.id'), primary_key=True),
    mapped_column('permission_id', Integer, ForeignKey('permissions.id'), primary_key=True),
    schema='Schemas_Herramienta_Trade_gastos'
)


class Module(Base, TimestampMixin):
    __tablename__ = "modules"
    __table_args__ = {"schema": "Schemas_Herramienta_Trade_gastos"}

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(255))
    icon: Mapped[str | None] = mapped_column(String(50))
    order: Mapped[int] = mapped_column(default=0)

    permissions: Mapped[list["Permission"]] = relationship(back_populates="module")


class Permission(Base, TimestampMixin):
    __tablename__ = "permissions"
    __table_args__ = {"schema": "Schemas_Herramienta_Trade_gastos"}

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    module_id: Mapped[int] = mapped_column(ForeignKey("Schemas_Herramienta_Trade_gastos.modules.id"), nullable=False)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255))

    module: Mapped["Module"] = relationship(back_populates="permissions")
    roles: Mapped[list["Role"]] = relationship(
        secondary=role_permissions,
        back_populates="permissions",
        lazy="select"
    )
