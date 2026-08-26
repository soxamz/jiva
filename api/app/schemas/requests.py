from pydantic import BaseModel, Field


class TextTurnRequest(BaseModel):
    text: str = Field(min_length=1)
