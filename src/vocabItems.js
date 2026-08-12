import { VOCAB } from "./vocab.js";
import { EXAMPLES } from "./examples.js";

/* Convierte las listas de vocabulario en ejercicios de opción múltiple:
   se muestra la palabra inglesa y hay que elegir el significado.
   Los distractores salen de otras palabras de la misma sección, así que
   siempre son del mismo registro y no se resuelven por descarte fácil. */

const SECTIONS = ["academicas", "registro-alto", "ampliacion", "falsos-amigos"];

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

function build() {
  const seen = new Set();
  const out = [];

  for (const secId of SECTIONS) {
    const sec = VOCAB.find((s) => s.id === secId);
    if (!sec) continue;

    for (const [word, gloss] of sec.items) {
      if (seen.has(word)) continue;
      seen.add(word);

      // tres distractores del mismo bloque
      const others = shuffle(sec.items.filter(([w]) => w !== word)).slice(0, 3);
      const owner = {};
      others.forEach(([w, g]) => {
        owner[g] = w;
      });

      const [example, extra] = EXAMPLES[word] || [];
      const whyNot = {};
      others.forEach(([, g]) => {
        whyNot[g] = `Ese es el significado de «${owner[g]}».`;
      });

      out.push({
        id: `v-${word}`,
        type: "vocab",
        word,
        text: word,
        options: shuffle([gloss, ...others.map(([, g]) => g)]),
        answers: [gloss],
        example,
        note: extra || "",
        whyNot,
      });
    }
  }
  return out;
}

export const VOCAB_ITEMS = build();
