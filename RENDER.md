# Desplegar Humano vs IA en Render

El repositorio contiene `app.py`, `requirements.txt`, `inventario.json`, `templates/`, `static/`, `ia/` y `real/` en su raíz. Los 100 materiales ocupan unos 159 MB y ya están incluidos. No es necesario descargarlos desde Drive durante el despliegue.

Configuración del servicio web:

- Runtime: Python
- Build: `pip install -r requirements.txt`
- Start: `gunicorn --bind 0.0.0.0:$PORT --workers 1 --threads 4 --timeout 120 app:app`
- Health check: `/health`, debe responder con `materials: 100`.
- Rama: `main`.

La configuración de arranque anterior sigue siendo válida. La variable `SECRET_KEY` ya no es necesaria: la actividad no utiliza sesiones firmadas ni puntajes en el servidor. Se puede conservar la variable existente sin afectar el funcionamiento.

El orden de materiales y el avance de las rondas se guardan en el navegador de la pantalla compartida. Un despliegue o reinicio del servidor no vuelve a mezclar el banco. Al completar tres turnos, la siguiente ronda espera una acción manual. El reloj dura 15 segundos, después deja el área blanca y espera **Mostrar respuesta**.

Si el servicio tiene Auto-Deploy activado para `main`, Render desplegará los nuevos commits automáticamente. De lo contrario, usar **Manual Deploy → Deploy latest commit** en el panel del servicio.
