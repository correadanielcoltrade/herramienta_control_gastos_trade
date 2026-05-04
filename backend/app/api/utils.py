from datetime import date
from enum import Enum
from typing import Any, TypeVar

from flask import jsonify, request
from pydantic import BaseModel, ValidationError

from app.core.errors import ApiError


SchemaT = TypeVar("SchemaT", bound=BaseModel)


def parse_body(schema_class: type[SchemaT]) -> SchemaT:
    payload = request.get_json(silent=True) or {}
    try:
        return schema_class.model_validate(payload)
    except ValidationError as error:
        raise error


def json_response(data: Any, status_code: int = 200):
    return jsonify(data), status_code


def dump_schema(schema: BaseModel) -> dict[str, Any]:
    return schema.model_dump(mode="json")


def dump_schema_list(items: list[BaseModel]) -> list[dict[str, Any]]:
    return [item.model_dump(mode="json") for item in items]


def parse_optional_int(name: str) -> int | None:
    value = request.args.get(name)
    if value in (None, ""):
        return None
    try:
        return int(value)
    except ValueError as error:
        raise ApiError(f"El parametro {name} debe ser numerico.", 400) from error


def parse_optional_date(name: str) -> date | None:
    value = request.args.get(name)
    if value in (None, ""):
        return None
    try:
        return date.fromisoformat(value)
    except ValueError as error:
        raise ApiError(f"El parametro {name} debe tener formato YYYY-MM-DD.", 400) from error


def parse_optional_enum(enum_class: type[Enum], name: str):
    value = request.args.get(name)
    if value in (None, ""):
        return None
    try:
        return enum_class(value)
    except ValueError as error:
        allowed = ", ".join(item.value for item in enum_class)
        raise ApiError(f"El parametro {name} debe ser uno de: {allowed}.", 400) from error

