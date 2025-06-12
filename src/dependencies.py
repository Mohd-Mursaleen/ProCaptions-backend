"""
Dependencies for FastAPI routes and services.
This module contains factory functions for dependency injection,
improving testability and maintainability.
"""
from typing import Generator, AsyncGenerator
from fastapi import Depends

from src.services.segmentation import SegmentationService
from src.services.composition import CompositionService
from src.services.s3_service import S3Service


# Service singletons for dependency injection
_segmentation_service: SegmentationService = None
_composition_service: CompositionService = None
_s3_service: S3Service = None


def get_segmentation_service() -> SegmentationService:
    """
    Get a singleton instance of the SegmentationService.
    Used as a FastAPI dependency.
    """
    global _segmentation_service
    if _segmentation_service is None:
        _segmentation_service = SegmentationService()
    return _segmentation_service


def get_composition_service() -> CompositionService:
    """
    Get a singleton instance of the CompositionService.
    Used as a FastAPI dependency.
    """
    global _composition_service
    if _composition_service is None:
        _composition_service = CompositionService()
    return _composition_service


def get_s3_service() -> S3Service:
    """
    Get a singleton instance of the S3Service.
    Used as a FastAPI dependency.
    """
    global _s3_service
    if _s3_service is None:
        _s3_service = S3Service()
    return _s3_service 