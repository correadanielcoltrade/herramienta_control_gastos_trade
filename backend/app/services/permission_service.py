from sqlalchemy.orm import Session

from app.models.user import User
from app.models.permission import Permission, Module


class PermissionService:
    @staticmethod
    def has_module_access(user: User, module_name: str, session: Session) -> bool:
        """Check if user has access to a module"""
        if user.role.name == "SuperAdmin":
            return True

        module = session.query(Module).filter(Module.name == module_name).first()
        if not module:
            return False

        return any(p.module_id == module.id for p in user.role.permissions)

    @staticmethod
    def has_permission(user: User, module_name: str, action: str, session: Session) -> bool:
        """Check if user has specific permission (module + action)"""
        if user.role.name == "SuperAdmin":
            return True

        permission = (
            session.query(Permission)
            .join(Module)
            .filter(
                Module.name == module_name,
                Permission.action == action
            )
            .first()
        )

        if not permission:
            return False

        return permission in user.role.permissions

    @staticmethod
    def can_read(user: User, module_name: str, session: Session) -> bool:
        """Check if user can read/view a module"""
        return PermissionService.has_permission(user, module_name, "read", session)

    @staticmethod
    def can_create(user: User, module_name: str, session: Session) -> bool:
        """Check if user can create in a module"""
        if user.role.is_read_only:
            return False
        return PermissionService.has_permission(user, module_name, "create", session)

    @staticmethod
    def can_edit(user: User, module_name: str, session: Session) -> bool:
        """Check if user can edit in a module"""
        if user.role.is_read_only:
            return False
        return PermissionService.has_permission(user, module_name, "edit", session)

    @staticmethod
    def can_delete(user: User, module_name: str, session: Session) -> bool:
        """Check if user can delete in a module"""
        if user.role.is_read_only:
            return False
        return PermissionService.has_permission(user, module_name, "delete", session)

    @staticmethod
    def get_accessible_modules(user: User) -> list[dict]:
        """Get all modules the user can access"""
        if user.role.name == "SuperAdmin":
            modules = set(p.module for p in user.role.permissions)
        else:
            modules = {p.module for p in user.role.permissions}

        return [
            {
                "id": m.id,
                "name": m.name,
                "description": m.description,
                "icon": m.icon,
                "order": m.order,
            }
            for m in sorted(modules, key=lambda x: x.order)
        ]
