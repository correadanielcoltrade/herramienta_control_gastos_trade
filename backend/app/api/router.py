from flask import Flask

from app.core.config import settings


def register_blueprints(app: Flask) -> None:
    from app.api.v1.endpoints.auth import auth_bp
    from app.api.v1.endpoints.cavs import cavs_bp
    from app.api.v1.endpoints.dashboard import dashboard_bp
    from app.api.v1.endpoints.serials import serials_bp
    from app.api.v1.endpoints.users import users_bp

    app.register_blueprint(auth_bp, url_prefix=f"{settings.api_v1_prefix}/auth")
    app.register_blueprint(users_bp, url_prefix=f"{settings.api_v1_prefix}/users")
    app.register_blueprint(cavs_bp, url_prefix=f"{settings.api_v1_prefix}/cavs")
    app.register_blueprint(serials_bp, url_prefix=f"{settings.api_v1_prefix}/serials")
    app.register_blueprint(dashboard_bp, url_prefix=f"{settings.api_v1_prefix}/dashboard")
