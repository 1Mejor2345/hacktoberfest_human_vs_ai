"""Presentación Humano vs IA: rondas de tres turnos sin marcador."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from flask import Flask, abort, jsonify, render_template, request, send_file

ROOT = Path(__file__).resolve().parent
app = Flask(__name__)

with (ROOT / "inventario.json").open(encoding="utf-8") as source:
    inventory = json.load(source)

MATERIALS = {}
for record in inventory:
    path = ROOT / record["categoria"] / record["archivo"]
    if path.is_file():
        key = hashlib.sha256(f'{record["categoria"]}/{record["archivo"]}'.encode()).hexdigest()[:16]
        MATERIALS[key] = {**record, "path": path}


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/health")
def health():
    return jsonify(app="humanvsai", materials=len(MATERIALS))


@app.get("/materials.json")
def materials():
    """The presenter controls timing and reveal locally, including across reloads."""
    return jsonify([
        {**{field: value for field, value in record.items() if field != "path"},
         "asset": f"/media/{key}"}
        for key, record in MATERIALS.items()
    ])


@app.get("/media/<key>")
def media(key):
    record = MATERIALS.get(key)
    if record is None:
        abort(404)
    mimetype = {
        ".mp4": "video/mp4", ".mp3": "audio/mpeg", ".wav": "audio/wav",
        ".ogg": "audio/ogg", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png", ".webp": "image/webp",
    }.get(record["path"].suffix.lower(), "application/octet-stream")
    return send_file(record["path"], conditional=True, mimetype=mimetype)


@app.after_request
def headers(response):
    if request.path in {"/", "/materials.json"} or request.path in {
        "/static/game.js", "/static/flow.js", "/static/style.css",
        "/static/framing.js", "/static/music.js", "/static/presentation.css"
    }:
        response.headers["Cache-Control"] = "no-cache"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response
