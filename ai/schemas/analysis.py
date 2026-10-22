from pydantic import BaseModel, Field


class CompetencyHypothesis(BaseModel):
    competency_code: str
    hypothesis: str = Field(description="Hypothèse pédagogique, formulée comme telle")
    suggested_action: str


class ResultsSummary(BaseModel):
    summary: str
    hypotheses: list[CompetencyHypothesis]


class ErrorLink(BaseModel):
    error_tag: str
    competency_code: str
    rationale: str


class ErrorLinks(BaseModel):
    links: list[ErrorLink]
