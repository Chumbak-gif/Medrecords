"""Disease use cases."""

from src.application.use_cases.diseases.list_diseases import ListDiseasesUseCase
from src.application.use_cases.diseases.create_disease import CreateDiseaseUseCase

__all__ = [
    "ListDiseasesUseCase",
    "CreateDiseaseUseCase",
]
