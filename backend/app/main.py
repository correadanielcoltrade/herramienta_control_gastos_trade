import logging
import traceback

from flask import Flask, jsonify
from flask_cors import CORS
from pydantic import ValidationError
from werkzeug.exceptions import HTTPException

from app.api.deps import attach_auth_context
from app.api.router import register_blueprints
from app.core.config import settings
from app.core.database import remove_db_session
from app.core.errors import ApiError


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["APP_NAME"] = settings.app_name
    app.config["DEBUG"] = settings.flask_debug
    app.url_map.strict_slashes = False

    CORS(
        app,
        resources={
            r"/*": {
                "origins": settings.allowed_origins,
                "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
                "allow_headers": ["Content-Type", "Authorization"],
            }
        },
        supports_credentials=True,
    )

    @app.before_request
    def auth_context_middleware():
        attach_auth_context()

    @app.teardown_appcontext
    def cleanup_session(exception: Exception | None):
        remove_db_session(exception)

    @app.errorhandler(ApiError)
    def handle_api_error(error: ApiError):
        return jsonify({"detail": error.detail}), error.status_code

    @app.errorhandler(ValidationError)
    def handle_validation_error(error: ValidationError):
        return jsonify({"detail": "Solicitud invalida.", "errors": error.errors()}), 422

    @app.errorhandler(HTTPException)
    def handle_http_error(error: HTTPException):
        return jsonify({"detail": error.description}), error.code or 500

    logging.basicConfig(level=logging.INFO)

    @app.errorhandler(Exception)
    def handle_unexpected_error(error: Exception):
        app.logger.error("Unhandled exception: %s\n%s", error, traceback.format_exc())
        return jsonify({"detail": "Ocurrio un error interno en el servidor."}), 500

    @app.get("/health")
    def healthcheck():
        return jsonify({"status": "ok"})

    register_blueprints(app)
    return app


app = create_app()
