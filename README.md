# C2 Drill

Práctica de **Use of English** de nivel C2 con repetición espaciada. 99 ejercicios originales
en los cinco formatos que entran en el examen: open cloze, word formation, key word
transformation, gapped sentences y multiple-choice cloze.

Cada respuesta viene con una explicación de por qué es la correcta, y en las de opción
múltiple, también de por qué falla cada distractor.

## Cómo funciona el repaso

Sistema de cajas: al acertar, el ejercicio se aleja siguiendo la secuencia **1, 3, 7, 16 y 35
días**. Al fallar vuelve a la caja cero y reaparece al día siguiente. La app prioriza siempre
lo que toca repasar; si no hay nada pendiente, saca ejercicios sin ver.

La racha suma cuando respondes 5 preguntas en un mismo día y se rompe si te saltas un día
entero. Todo el progreso se guarda en `localStorage`, en tu navegador: no hay cuentas ni
servidor, pero tampoco se sincroniza entre dispositivos.

## Instalar y arrancar

Necesitas Node 18 o superior.

```bash
npm install
npm run dev
```

Se abre en `http://localhost:5173`.

Para generar la versión de producción:

```bash
npm run build
```

El resultado queda en `dist/`.

## Publicar en GitHub Pages

El repo incluye `.github/workflows/deploy.yml`, que compila y publica en cada push a `main`.
Para activarlo, en tu repositorio ve a **Settings → Pages** y en *Source* elige
**GitHub Actions**. El primer despliegue tarda un par de minutos y la web queda en
`https://TU-USUARIO.github.io/c2-drill/`.

La configuración usa rutas relativas (`base: "./"`), así que funciona igual si prefieres
Netlify, Vercel o abrir la carpeta `dist` en local.

## Añadir tus propios ejercicios

Todos los ítems están en `src/items.js`. El formato varía según el tipo:

```js
// open cloze, word formation
{ id: "o36", type: "open", text: "Frase con ___ para el hueco.", answers: ["palabra"], note: "Por qué." }
{ id: "w25", type: "word", given: "RAÍZ", text: "Frase con ___.", answers: ["derivada"], note: "Por qué." }

// key word transformation
{ id: "t19", type: "trans", lead: "Frase original.", given: "CLAVE",
  text: "Frase reescrita con ___.", answers: ["palabras que faltan"], note: "Por qué." }

// gapped sentences: una palabra para las tres frases
{ id: "g11", type: "gapped", sentences: ["Frase uno ___.", "Frase dos ___.", "Frase tres ___."],
  answers: ["palabra"], note: "Por qué." }

// multiple-choice cloze
{ id: "m13", type: "mcq", text: "Frase con ___.", options: ["a", "b", "c", "d"],
  answers: ["a"], note: "Por qué.", whyNot: { b: "Por qué no.", c: "...", d: "..." } }
```

`answers` admite varias formas válidas: la comparación ignora mayúsculas, tildes tipográficas
y puntuación. El `id` debe ser único, porque es la clave con la que se guarda tu progreso: si
cambias el id de un ejercicio, pierdes su historial de repaso.

## Licencia

Los ejercicios son originales. No reproducen material de exámenes reales de Cambridge, que
está protegido por derechos de autor.
