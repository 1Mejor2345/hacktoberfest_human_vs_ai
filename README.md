# Humano vs IA

Actividad abierta para mostrar en una pantalla grande. Conserva la estética medieval de Código Secreto y los 100 archivos originales del Drive compartido, con fuentes y créditos.

## Dinámica

- No hay equipos, votos ni marcador.
- Cada ronda tiene exactamente tres turnos.
- Cada turno espera el botón **Start**. El material se prepara oculto antes de habilitar el botón.
- Al pulsarlo, se muestra el material durante 10 segundos. El audio o video se reproduce con ese mismo comando.
- Cuando termina el tiempo, el material se oculta, el reproductor se detiene y el área queda blanca. La respuesta todavía no aparece.
- **Mostrar respuesta** revela el origen, la explicación y la fuente en esa área blanca.
- **Siguiente** prepara el turno siguiente, que vuelve a esperar Start.
- Después del tercer turno, una pantalla de cierre espera **Siguiente ronda**. Se pueden acercar nuevos participantes.

## Encuadre

Las imágenes y los videos conservan su proporción y se ajustan al espacio disponible, sin la ampliación forzada de la versión anterior. Por defecto, el zoom es del 100 % y solo se recorta el 8 % inferior. El botón de encuadre de la cabecera permite ajustar el zoom (100–160 %) y el recorte inferior (0–20 %), guardar esos valores en este navegador o restablecer los valores predeterminados. El encuadre se aplica igual a materiales humanos y de IA. Los archivos originales, las fuentes y los créditos se conservan.

La portada se adapta al alto de las pantallas de computadora e incluye los tres logotipos del evento. El botón de música permite ajustar el volumen o silenciar el ambiente; la música se pausa durante los diez segundos de cada material. Créditos en [MUSIC_CREDITS.md](MUSIC_CREDITS.md).

## Sin repeticiones

Se mezcla el banco una sola vez por sesión y se recorre sin repetir archivos. El orden, el turno y la fecha de finalización del cronómetro se guardan en el navegador. Recargar no reinicia el reloj ni mezcla otra vez el banco.

Con 100 materiales hay 33 rondas completas y queda un archivo. Cuando quedan menos de tres, se avisa y no se inicia otra ronda incompleta ni se repiten materiales automáticamente. Solo **Reiniciar banco de materiales**, con confirmación, permite reutilizar el banco.

El historial pertenece a este navegador y se conserva mientras no se borren sus datos. La pantalla compartida debe usar la misma pestaña y navegador durante el evento.

## Ejecutar localmente

```sh
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
flask --app app run
```

Visita http://127.0.0.1:5000. Los archivos del juego se sirven desde Flask y los 100 materiales permanecen en `ia/` y `real/`.

## Render

El servicio existente sigue usando Python y el mismo comando de Gunicorn. Consulta [RENDER.md](RENDER.md). Si Render tiene despliegue automático conectado a `main`, actualizar esa rama inicia un nuevo despliegue.

## Verificación

```sh
python -m unittest discover -s tests -p 'test_*.py'
node --test tests/flow.test.mjs
```

Los archivos del Drive mantienen sus bytes originales. `inventario.json` conserva sus fuentes y créditos. El navegador recibe los metadatos en `/materials.json` y carga los archivos mediante rutas neutrales en `/media/<id>`. Los logotipos y la tortuga proceden de la página de referencia proporcionada por el usuario.
