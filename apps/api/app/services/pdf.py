from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.models import ExerciseSet

_env = Environment(
    loader=FileSystemLoader(Path(__file__).parent.parent / "templates"),
    autoescape=select_autoescape(["html"]),
)


def render_exercises_pdf(ex: ExerciseSet, *, with_answers: bool) -> bytes:
    from weasyprint import HTML  # import tardif : dépend de bibliothèques système (Pango)

    html = _env.get_template("exercises.html").render(
        competency=ex.competency,
        difficulty=ex.difficulty,
        variants=ex.variants,
        with_answers=with_answers,
    )
    return HTML(string=html).write_pdf()
