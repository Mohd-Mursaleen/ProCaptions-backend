from fastapi import Request, status
from fastapi.responses import JSONResponse
from typing import Dict, Any, Callable
import logging
import traceback
from src.exceptions import BaseAppException

logger = logging.getLogger(__name__)


async def error_handler_middleware(request: Request, call_next: Callable) -> JSONResponse:
    """
    Middleware to handle exceptions across the application.
    Catches custom exceptions and transforms them into appropriate JSON responses.
    """
    try:
        return await call_next(request)
    except BaseAppException as exc:
        # Handle our custom exceptions
        logger.error(
            f"Application error: {exc.__class__.__name__}: {exc.message}",
            extra={
                "details": exc.details,
                "path": request.url.path,
                "method": request.method,
            }
        )
        
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": exc.__class__.__name__,
                "message": exc.message,
                "details": exc.details
            }
        )
    except Exception as exc:
        # Log any uncaught exceptions with traceback
        logger.error(
            f"Uncaught exception: {str(exc)}",
            exc_info=True,
            extra={
                "path": request.url.path,
                "method": request.method,
                "traceback": "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))
            }
        )
        
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "InternalServerError",
                "message": "An unexpected error occurred",
                # Don't expose internal error details in production
                "details": {"id": request.state.request_id} if hasattr(request.state, "request_id") else {}
            }
        )


def setup_request_id_middleware(app):
    """
    Add a middleware that assigns a unique ID to each request.
    This helps with tracking errors across logs.
    """
    import uuid
    
    @app.middleware("http")
    async def add_request_id(request: Request, call_next: Callable) -> JSONResponse:
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        
        # Add the request ID to response headers
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response 