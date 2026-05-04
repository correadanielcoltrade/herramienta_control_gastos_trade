from flask import Blueprint

from app.api.deps import get_current_user, login_required
from app.api.utils import dump_schema, json_response, parse_optional_date, parse_optional_enum, parse_optional_int
from app.core.database import get_db
from app.core.enums import SerialStatus
from app.schemas.dashboard import DashboardPoint, DashboardResponse, DashboardSummary
from app.services.dashboard_service import build_series, build_summary


dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.get("/summary")
@login_required
def get_dashboard_summary():
    cav_id = parse_optional_int("cav_id")
    status = parse_optional_enum(SerialStatus, "status")
    user_id = parse_optional_int("user_id")
    start_date = parse_optional_date("start_date")
    end_date = parse_optional_date("end_date")
    db = get_db()
    current_user = get_current_user(db)
    summary = build_summary(
        db,
        current_user,
        cav_id=cav_id,
        status_filter=status,
        user_id=user_id,
    )
    series = build_series(
        db,
        current_user,
        cav_id=cav_id,
        status_filter=status,
        user_id=user_id,
        start_date=start_date,
        end_date=end_date,
    )
    response = DashboardResponse(
        summary=DashboardSummary.model_validate(summary),
        series=[DashboardPoint.model_validate(item) for item in series],
    )
    return json_response(dump_schema(response))
