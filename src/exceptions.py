from fastapi import HTTPException, status
from typing import Any, Dict, Optional


class BaseAppException(Exception):
    """Base exception class for all application-specific exceptions."""
    def __init__(
        self, 
        message: str, 
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


class ResourceNotFoundException(BaseAppException):
    """Exception raised when a requested resource is not found."""
    def __init__(
        self, 
        message: str = "The requested resource was not found",
        resource_type: str = "resource",
        resource_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        _details = {"resource_type": resource_type}
        if resource_id:
            _details["resource_id"] = resource_id
        if details:
            _details.update(details)
            
        super().__init__(
            message=message,
            status_code=status.HTTP_404_NOT_FOUND,
            details=_details
        )


class ValidationException(BaseAppException):
    """Exception raised when input validation fails."""
    def __init__(
        self, 
        message: str = "Validation error",
        field: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        _details = {}
        if field:
            _details["field"] = field
        if details:
            _details.update(details)
            
        super().__init__(
            message=message,
            status_code=status.HTTP_400_BAD_REQUEST,
            details=_details
        )


class ImageProcessingException(BaseAppException):
    """Exception raised for errors during image processing."""
    def __init__(
        self, 
        message: str = "Image processing failed",
        phase: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        _details = {}
        if phase:
            _details["phase"] = phase
        if details:
            _details.update(details)
            
        super().__init__(
            message=message,
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            details=_details
        )


class StorageException(BaseAppException):
    """Exception raised for errors related to file storage operations."""
    def __init__(
        self, 
        message: str = "Storage operation failed",
        operation: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        _details = {}
        if operation:
            _details["operation"] = operation
        if details:
            _details.update(details)
            
        super().__init__(
            message=message,
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            details=_details
        )


class ExternalServiceException(BaseAppException):
    """Exception raised when an external service call fails."""
    def __init__(
        self, 
        message: str = "External service request failed",
        service: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        _details = {}
        if service:
            _details["service"] = service
        if details:
            _details.update(details)
            
        super().__init__(
            message=message,
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            details=_details
        )


class ModelNotReadyException(BaseAppException):
    """Exception raised when AI models are not loaded or ready."""
    def __init__(
        self, 
        message: str = "AI model not ready",
        model_name: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        _details = {}
        if model_name:
            _details["model_name"] = model_name
        if details:
            _details.update(details)
            
        super().__init__(
            message=message,
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            details=_details
        ) 