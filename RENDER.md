# Desplegar Human vs AI

El repositorio debe contener app.py, requirements.txt, inventario.json, templates/, static/, ia/ y real/ en su raíz. Los 100 materiales seleccionados ocupan unos 152 MB; no incluir _preparacion/.

Configuración del servicio web en Render:

- Runtime: Python
- Build: `pip install -r requirements.txt`
- Start: `gunicorn --bind 0.0.0.0:$PORT --workers 1 --threads 4 --timeout 120 app:app`
- Health check: `/health` (debe responder con materials: 100)
- Variable SECRET_KEY: valor aleatorio privado generado en Render; no guardarlo en el repositorio.

Un proceso con cuatro hilos sirve tanto el juego como los archivos multimedia. La variable SECRET_KEY mantiene las sesiones firmadas entre reinicios; si no se configura, las partidas se reinician tras reiniciar el proceso.
