import { VOCAB } from "./vocab.js";
import { EXAMPLES } from "./examples.js";

/* Convierte las listas de vocabulario en ejercicios de opción múltiple (vocab)
   y de escribir/deletrear (vocab_write). */

const SECTIONS = [
  "academicas",
  "registro-alto",
  "ampliacion",
  "falsos-amigos",
  "phrasal-movimiento",
  "phrasal-comunicacion",
  "idioms-c1c2",
  "verb-noun-col",
  "adj-noun-col",
  "crime-law",
  "science-tech",
  "literary-art",
  "formal-verbs",
  "society-media",
  "negative-vocab",
  "degree-quantity",
];

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

function getExampleAndNote(word) {
  if (EXAMPLES[word]) return EXAMPLES[word];
  if (word.includes("→")) {
    const parts = word.split("→")[1].split("/").map((p) => p.trim());
    for (const p of parts) {
      if (EXAMPLES[p]) return EXAMPLES[p];
    }
  }
  return [];
}

function maskWord(sentence, word) {
  if (!sentence) return "";
  
  let targets = [word];
  if (word.includes("→")) {
    targets = word.split("→")[1].split("/").map((p) => p.trim());
  }

  let text = sentence;

  for (const t of targets) {
    const cleanT = t.replace(/\b(sth|sb|oneself|one's|to)\b/gi, "").trim();
    if (!cleanT) continue;

    const parts = cleanT.split(/\s+/).filter((p) => p.length > 2);
    
    if (parts.length === 0) {
      const escaped = t.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp('\\b' + escaped + '(s|ed|ing|d|es)?\\b', 'gi');
      text = text.replace(regex, "___");
      continue;
    }

    const irregulars = {
      bring: "brought",
      go: "went|gone",
      seek: "sought",
      teach: "taught",
      think: "thought",
      buy: "bought",
      catch: "caught",
      draw: "drew|drawn",
      fall: "fell|fallen",
      give: "gave|given",
      run: "ran",
      take: "took|taken",
      see: "saw|seen",
      write: "wrote|written",
      rose: "rose",
      arise: "arose|arisen",
      hold: "held",
      stem: "stemmed",
      bind: "bound",
      find: "found",
      strike: "struck",
      bear: "bore|borne",
      cast: "cast",
      shake: "shook|shaken",
      speak: "spoke|spoken",
      wear: "wore|worn"
    };

    let patternStr = parts.map((part) => {
      const escapedPart = part.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      let p = escapedPart;
      if (irregulars[part]) {
        p = `(${escapedPart}|${irregulars[part]})`;
      }
      return `\\b${p}(s|ed|ing|d|es|med|ned|ted|red|ged)?\\b`;
    }).join("|");

    try {
      const regex = new RegExp(patternStr, 'gi');
      text = text.replace(regex, "___");
    } catch (e) {
      const escapedT = t.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      text = text.replace(new RegExp(escapedT, 'gi'), "___");
    }
  }

  // Si no se pudo enmascarar nada, forzar un ___
  if (text === sentence && sentence.length > 0) {
    return sentence + " (___)";
  }

  return text;
}

function build() {
  const seen = new Set();
  const out = [];

  for (const secId of SECTIONS) {
    const sec = VOCAB.find((s) => s.id === secId);
    if (!sec) continue;

    for (const [word, gloss] of sec.items) {
      if (seen.has(word)) continue;
      seen.add(word);

      // Distractores para el modo MCQ
      const others = shuffle(sec.items.filter(([w]) => w !== word)).slice(0, 3);
      const owner = {};
      others.forEach(([w, g]) => {
        owner[g] = w;
      });

      const [example, extra, exampleEs] = getExampleAndNote(word);
      const whyNot = {};
      others.forEach(([, g]) => {
        whyNot[g] = `Ese es el significado de «${owner[g]}».`;
      });

      // 1. Modo Opción Múltiple (vocab)
      out.push({
        id: `v-${word}`,
        type: "vocab",
        word,
        text: word,
        options: shuffle([gloss, ...others.map(([, g]) => g)]),
        answers: [gloss],
        example,
        exampleEs: exampleEs || "",
        note: extra || "",
        whyNot,
      });

      // 2. Modo Escribir/Deletrear (vocab_write)
      const maskedText = maskWord(example, word);
      out.push({
        id: `vw-${word}`,
        type: "vocab_write",
        word,
        text: maskedText || `Traduce al inglés: «${gloss}»`,
        gloss,
        options: [word],
        answers: [word],
        example,
        exampleEs: exampleEs || "",
        note: extra || "",
      });
    }
  }

  // 3. Palabras con faltas de ortografía (faltas) en modo vocab_write
  const faltasSec = VOCAB.find((s) => s.id === "faltas");
  if (faltasSec && Array.isArray(faltasSec.items)) {
    for (const spellingWord of faltasSec.items) {
      out.push({
        id: `vw-spelling-${spellingWord}`,
        type: "vocab_write",
        word: spellingWord,
        text: `Escribe correctamente la palabra pronunciada (${spellingWord.length} letras)`,
        gloss: "Spelling / Ortografía",
        options: [spellingWord],
        answers: [spellingWord],
        example: "",
        note: "Esta palabra suele escribirse incorrectamente. ¡Presta atención a las letras dobles!",
        isSpelling: true
      });
    }
  }

  return out;
}

export const VOCAB_ITEMS = build();
