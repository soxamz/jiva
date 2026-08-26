from typing import Literal

from pydantic import BaseModel, Field


SocratesField = Literal[
    "site",
    "onset",
    "character",
    "radiation",
    "associations",
    "time_course",
    "exacerbating_relieving",
    "severity",
]


class SocratesSlots(BaseModel):
    site: str | None = None
    onset: str | None = None
    character: str | None = None
    radiation: str | None = None
    associations: str | None = None
    time_course: str | None = None
    exacerbating_relieving: str | None = None
    severity: int | None = Field(default=None, ge=0, le=10)

    def filled_fields(self) -> list[str]:
        filled: list[str] = []
        for name in (
            "site",
            "onset",
            "character",
            "radiation",
            "associations",
            "time_course",
            "exacerbating_relieving",
            "severity",
        ):
            value = getattr(self, name)
            if value is not None and value != "":
                filled.append(name)
        return filled

    def merge(self, other: "SocratesSlots") -> "SocratesSlots":
        data = self.model_dump()
        for key, value in other.model_dump(exclude_none=True).items():
            if value is not None and value != "":
                data[key] = value
        return SocratesSlots.model_validate(data)

    def progress(self) -> dict[str, bool]:
        return {
            "site": self.site is not None and self.site != "",
            "onset": self.onset is not None and self.onset != "",
            "character": self.character is not None and self.character != "",
            "radiation": self.radiation is not None and self.radiation != "",
            "associations": self.associations is not None and self.associations != "",
            "time_course": self.time_course is not None and self.time_course != "",
            "exacerbating_relieving": (
                self.exacerbating_relieving is not None
                and self.exacerbating_relieving != ""
            ),
            "severity": self.severity is not None,
        }
