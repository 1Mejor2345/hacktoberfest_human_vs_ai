"""Juego local Human vs AI. Los originales se leen sin modificarlos."""
from __future__ import annotations

import hashlib
import json
import os
import random
import secrets
from pathlib import Path

from flask import Flask, abort, jsonify, render_template, request, send_file, session

ROOT = Path(__file__).resolve().parent
app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY") or secrets.token_bytes(32)
app.config.update(SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE="Lax")

with (ROOT / "inventario.json").open(encoding="utf-8") as source:
    inventory = json.load(source)

MATERIALS = {}
for record in inventory:
    path = ROOT / record["categoria"] / record["archivo"]
    if path.is_file():
        key = hashlib.sha256(f'{record["categoria"]}/{record["archivo"]}'.encode()).hexdigest()[:16]
        MATERIALS[key] = {**record, "path": path}


def start_game():
    order = list(MATERIALS)
    random.SystemRandom().shuffle(order)
    session.clear()
    session.update(order=order, position=0, answers={})


def ensure_game():
    if not session.get("order") or any(key not in MATERIALS for key in session["order"]):
        start_game()


def state():
    ensure_game()
    order, position, answers = session["order"], session["position"], session["answers"]
    score = sum(answer["correct"] for answer in answers.values())
    result = {"position": position, "total": len(order), "score": score,
              "answered": len(answers), "finished": position >= len(order)}
    if result["finished"]:
        return result
    key = order[position]
    record = MATERIALS[key]
    media_type = record.get("tipo") or ("video" if record["path"].suffix == ".mp4" else "image")
    result["material"] = {"id": key, "type": media_type,
                          "url": f"/media/{key}"}
    if key in answers:
        result["answer"] = {
            **answers[key], "category": record["categoria"], "title": record["titulo"],
            "explanation": record["explicacion"], "source": record["fuente"],
            "download": record["url"], "credit": record["credito"],
            "treatment": record.get("transformacion", ""),
            "evidence": record.get("fundamento", ""),
        }
    return result


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/health")
def health():
    return jsonify(app="humanvsai", materials=len(MATERIALS))


@app.get("/api/state")
def get_state():
    return jsonify(state())


@app.post("/api/start")
def restart():
    start_game()
    return jsonify(state())


@app.post("/api/answer")
def answer():
    ensure_game()
    payload = request.get_json(silent=True) or {}
    choice = payload.get("choice")
    if choice not in {"ia", "real"}:
        return jsonify(error="Escoge IA o Real."), 400
    position, order = session["position"], session["order"]
    if position >= len(order):
        return jsonify(error="La partida terminó."), 409
    key = order[position]
    if payload.get("id") != key:
        return jsonify(error="La ronda cambió. Vuelve a intentarlo."), 409
    answers = dict(session["answers"])
    if key not in answers:
        answers[key] = {"choice": choice, "correct": choice == MATERIALS[key]["categoria"]}
        session["answers"] = answers
    return jsonify(state())


@app.post("/api/next")
def next_round():
    ensure_game()
    position, order = session["position"], session["order"]
    payload = request.get_json(silent=True) or {}
    if position < len(order):
        key = order[position]
        if payload.get("id") != key or key not in session["answers"]:
            return jsonify(error="Responde esta ronda antes de continuar."), 409
        session["position"] = position + 1
    return jsonify(state())


@app.get("/media/<key>")
def media(key):
    ensure_game()
    if key not in MATERIALS or key not in session["order"]:
        abort(404)
    record = MATERIALS[key]
    image_types = {"JPEG": "image/jpeg", "WEBP": "image/webp", "PNG": "image/png"}
    suffix = record["path"].suffix.lower()
    mimetype = {".mp4": "video/mp4", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg"}.get(suffix) or image_types.get(record.get("formato_real"), "image/jpeg")
    return send_file(record["path"], conditional=True, mimetype=mimetype)


@app.after_request
def headers(response):
    if request.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response
