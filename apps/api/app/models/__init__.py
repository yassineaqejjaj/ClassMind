from datetime import UTC, datetime

from sqlalchemy import JSON, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


def now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


class Establishment(Base):
    __tablename__ = "establishments"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    monthly_llm_cap_eur: Mapped[float] = mapped_column(Float, default=20.0)
    retention_days: Mapped[int] = mapped_column(Integer, default=365)


class SchoolClass(Base):
    __tablename__ = "classes"
    id: Mapped[int] = mapped_column(primary_key=True)
    establishment_id: Mapped[int] = mapped_column(ForeignKey("establishments.id"), index=True)
    owner_sub: Mapped[str] = mapped_column(String(64), index=True)
    name: Mapped[str] = mapped_column(String(100))
    level: Mapped[str] = mapped_column(String(20), default="5e")
    school_year: Mapped[str] = mapped_column(String(9), default="")
    students: Mapped[list["Student"]] = relationship(cascade="all, delete-orphan", back_populates="school_class")
    assessments: Mapped[list["Assessment"]] = relationship(cascade="all, delete-orphan", back_populates="school_class")


class Student(Base):
    """Élève identifié uniquement par un pseudonyme (aucun nom, aucune donnée directe)."""

    __tablename__ = "students"
    __table_args__ = (UniqueConstraint("class_id", "pseudonym"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id"), index=True)
    pseudonym: Mapped[str] = mapped_column(String(32))
    school_class: Mapped[SchoolClass] = relationship(back_populates="students")


class Competency(Base):
    __tablename__ = "competencies"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True)
    level: Mapped[str] = mapped_column(String(20), default="5e")
    chapter: Mapped[str] = mapped_column(String(100))
    label: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    example: Mapped[str] = mapped_column(Text, default="")


class CompetencyPrerequisite(Base):
    __tablename__ = "competency_prerequisites"
    competency_id: Mapped[int] = mapped_column(ForeignKey("competencies.id"), primary_key=True)
    prerequisite_id: Mapped[int] = mapped_column(ForeignKey("competencies.id"), primary_key=True)


class Assessment(Base):
    __tablename__ = "assessments"
    id: Mapped[int] = mapped_column(primary_key=True)
    establishment_id: Mapped[int] = mapped_column(ForeignKey("establishments.id"), index=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    held_on: Mapped[str] = mapped_column(String(10))  # AAAA-MM-JJ
    created_at: Mapped[datetime] = mapped_column(default=now)
    school_class: Mapped[SchoolClass] = relationship(back_populates="assessments")
    questions: Mapped[list["Question"]] = relationship(cascade="all, delete-orphan", back_populates="assessment")


class Question(Base):
    __tablename__ = "questions"
    __table_args__ = (UniqueConstraint("assessment_id", "code"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    assessment_id: Mapped[int] = mapped_column(ForeignKey("assessments.id"), index=True)
    code: Mapped[str] = mapped_column(String(20))
    competency_id: Mapped[int] = mapped_column(ForeignKey("competencies.id"))
    max_points: Mapped[float] = mapped_column(Float)
    assessment: Mapped[Assessment] = relationship(back_populates="questions")
    competency: Mapped[Competency] = relationship()


class Result(Base):
    __tablename__ = "results"
    __table_args__ = (UniqueConstraint("question_id", "student_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    assessment_id: Mapped[int] = mapped_column(ForeignKey("assessments.id"), index=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id"), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    points: Mapped[float] = mapped_column(Float)
    error_tag: Mapped[str | None] = mapped_column(String(100), nullable=True)


class ExerciseSet(Base):
    __tablename__ = "exercise_sets"
    id: Mapped[int] = mapped_column(primary_key=True)
    establishment_id: Mapped[int] = mapped_column(ForeignKey("establishments.id"), index=True)
    owner_sub: Mapped[str] = mapped_column(String(64), index=True)
    competency_id: Mapped[int] = mapped_column(ForeignKey("competencies.id"))
    difficulty: Mapped[str] = mapped_column(String(20))
    exercise_type: Mapped[str] = mapped_column(String(40))
    n_questions: Mapped[int] = mapped_column(Integer)
    constraints: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft | validated
    created_at: Mapped[datetime] = mapped_column(default=now)
    competency: Mapped[Competency] = relationship()
    # [{"label","title","questions":[{statement,expression,answer,explanation,check}]}]
    variants: Mapped[list] = mapped_column(JSON, default=list)


class ValidationEvent(Base):
    __tablename__ = "validation_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    exercise_set_id: Mapped[int] = mapped_column(ForeignKey("exercise_sets.id"), index=True)
    actor_sub: Mapped[str] = mapped_column(String(64))
    action: Mapped[str] = mapped_column(String(30))  # generated | edited | validated
    at: Mapped[datetime] = mapped_column(default=now)


class LLMUsage(Base):
    __tablename__ = "llm_usage"
    id: Mapped[int] = mapped_column(primary_key=True)
    establishment_id: Mapped[int] = mapped_column(ForeignKey("establishments.id"), index=True)
    operation: Mapped[str] = mapped_column(String(40))
    model: Mapped[str] = mapped_column(String(80))
    input_tokens: Mapped[int] = mapped_column(Integer)
    output_tokens: Mapped[int] = mapped_column(Integer)
    cost_eur: Mapped[float] = mapped_column(Float)
    at: Mapped[datetime] = mapped_column(default=now, index=True)
