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
  "lexico-adicional",
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
  if (!sentence) return { maskedText: "", answers: [word] };
  
  let targets = [word];
  if (word.includes("→")) {
    targets = word.split("→")[1].split("/").map((p) => p.trim());
  }

  let text = sentence;
  let answers = [word];

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

  for (const t of targets) {
    const cleanT = t.replace(/\b(sth|sb|oneself|one's|to)\b/gi, "").trim();
    if (!cleanT) continue;

    // 1. Try contiguous match first (matching all words of the phrase contiguously with potential inflections)
    const phraseParts = cleanT.split(/\s+/).filter(Boolean);
    if (phraseParts.length > 0) {
      const contiguousPattern = phraseParts.map((part) => {
        const escapedPart = part.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        let p = escapedPart;
        if (irregulars[part]) {
          p = `(${escapedPart}|${irregulars[part]})`;
        }
        return `\\b${p}(s|ed|ing|d|es|med|ned|ted|red|ged)?\\b`;
      }).join("\\s+");

      try {
        const regexContiguous = new RegExp(contiguousPattern, 'gi');
        const match = text.match(regexContiguous);
        if (match) {
          text = text.replace(regexContiguous, "___");
          for (const m of match) {
            if (!answers.includes(m)) answers.push(m);
          }
          continue;
        }
      } catch (e) {
        // ignore regex error and fall through
      }
    }

    // 2. Fallback to individual parts matching (useful if phrase is split in the sentence)
    const parts = cleanT.split(/\s+/).filter((p) => p.length > 2);
    
    if (parts.length === 0) {
      const escaped = t.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp('\\b' + escaped + '(s|ed|ing|d|es)?\\b', 'gi');
      const match = text.match(regex);
      if (match) {
        text = text.replace(regex, "___");
        for (const m of match) {
          if (!answers.includes(m)) answers.push(m);
        }
      }
      continue;
    }

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
      const match = text.match(regex);
      if (match) {
        text = text.replace(regex, "___");
        for (const m of match) {
          if (!answers.includes(m)) answers.push(m);
        }
      }
    } catch (e) {
      const escapedT = t.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(escapedT, 'gi');
      const match = text.match(regex);
      if (match) {
        text = text.replace(regex, "___");
        for (const m of match) {
          if (!answers.includes(m)) answers.push(m);
        }
      }
    }
  }

  // Si no se pudo enmascarar nada, forzar un ___
  if (text === sentence && sentence.length > 0) {
    text = sentence + " (___)";
  }

  return { maskedText: text, answers };
}

function build() {
  const seen = new Set();
  const out = [];

  // Mapa global palabra→gloss para poder consultar cualquier palabra
  const glossMap = {};
  for (const sec of VOCAB) {
    if (!Array.isArray(sec.items)) continue;
    for (const item of sec.items) {
      if (Array.isArray(item) && item.length >= 2) {
        const [w, g] = item;
        if (!glossMap[w]) glossMap[w] = g;
      }
    }
  }

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
      const { maskedText, answers } = maskWord(example, word);
      out.push({
        id: `vw-${word}`,
        type: "vocab_write",
        word,
        text: maskedText || `Traduce al inglés: «${gloss}»`,
        gloss,
        options: answers,
        answers: answers,
        example,
        exampleEs: exampleEs || "",
        note: extra || "",
      });
    }
  }

const SPELLING_TRANSLATIONS = {
  accommodate: "alojar, hospedar, dar cabida a",
  occurrence: "aparición, suceso, acontecimiento",
  occurred: "ocurrió, sucedido",
  necessary: "necesario",
  embarrass: "avergonzar",
  definitely: "definitivamente, sin duda",
  separate: "separar, independiente",
  privilege: "privilegio",
  rhythm: "ritmo",
  conscience: "conciencia (moral)",
  conscientious: "concienzudo, meticuloso",
  maintenance: "mantenimiento",
  recommend: "recomendar",
  argument: "discusión, argumento",
  existence: "existencia",
  independent: "independiente",
  liaison: "enlace, contacto, comunicación",
  millennium: "milenio",
  questionnaire: "cuestionario",
  restaurant: "restaurante",
  threshold: "umbral, límite",
  weird: "extraño, raro",
  bureaucracy: "burocracia",
  entrepreneur: "empresario, emprendedor",
  acquaintance: "conocido (persona)",
  indispensable: "indispensable",
  perseverance: "perseverancia",
  supersede: "reemplazar, sustituir",
  harass: "acosar, hostigar",
  publicly: "públicamente",
  foreign: "extranjero",
  colleague: "colega, compañero de trabajo",
  exaggerate: "exagerar",
  hierarchy: "jerarquía",
  noticeable: "perceptible, evidente",
  parallel: "paralelo",
  pronunciation: "pronunciación",
  referred: "referido, consultado",
  relevant: "relevante",
  twelfth: "duodécimo",
  vacuum: "aspiradora (n) / aspirar (v) / vacío (n)",
  apparent: "aparente",
  committee: "comité, comisión",
  curiosity: "curiosidad",
  guarantee: "garantía (n) / garantizar (v)",
  immediately: "inmediatamente",
  acknowledge: "reconocer, admitir",
  aggressive: "agresivo",
  apparently: "aparentemente",
  assassinate: "asesinar (a un personaje público)",
  collaborate: "colaborar",
  commitment: "compromiso",
  consciously: "conscientemente",
  continuously: "continuamente",
  desiccate: "desecar",
  dilemma: "dilema",
  diphthong: "diptongo",
  disappear: "desaparecer",
  dumbbell: "mancuerna, pesa",
  ecstasy: "éxtasis",
  eighth: "octavo",
  fluorescent: "fluorescente",
  forty: "cuarenta",
  fuelling: "abastecimiento de combustible, alimentar",
  gauge: "calibrar, medir / indicador",
  grammar: "gramática",
  grievous: "grave, doloroso",
  handkerchief: "pañuelo",
  humorous: "humorístico, gracioso",
  hygiene: "higiene",
  hypocrisy: "hipocresía",
  ignorance: "ignorancia",
  inadvertent: "inadvertido, involuntario",
  incidentally: "por cierto, incidentalmente",
  inoculate: "vacunar, inocular",
  insistent: "insistente",
  intellectual: "intelectual",
  irresistible: "irresistible",
  legitimate: "legítimo",
  leisure: "ocio, tiempo libre",
  liquefy: "licuar",
  manoeuvre: "maniobra (n) / maniobrar (v)",
  miniature: "miniatura",
  mischievous: "travieso, pícaro",
  misspell: "escribir mal",
  mysterious: "misterioso",
  naïve: "ingenuo, cándido",
  negligible: "insignificante, despreciable",
  occasionally: "ocasionalmente, de vez en cuando",
  oscillate: "oscilar",
  parliament: "parlamento",
  perceive: "percibir",
  permanent: "permanente",
  phenomenal: "fenomenal, extraordinario",
  possess: "poseer",
  preceding: "precedente, anterior",
  prejudice: "prejuicio",
  prevalent: "prevalente, común",
  psychology: "psicología",
  pursue: "perseguir, buscar",
  receipt: "recibo",
  receive: "recibir",
  reminisce: "rememorar, recordar",
  resistance: "resistencia",
  rhyme: "rima (n) / rimar (v)",
  ridiculous: "ridículo",
  science: "ciencia",
  seize: "apoderarse de, agarrar",
  siege: "asedio, sitio",
  sincerely: "atentamente, sinceramente",
  skilful: "habilidoso, diestro",
  subtle: "sutil",
  succeed: "tener éxito / suceder",
  surprise: "sorpresa (n) / sorprender (v)",
  tomorrow: "mañana",
  unnecessary: "innecesario",
  until: "hasta (preposición / conjunción)",
  withhold: "retener, no divulgar"
};

  // 3. Palabras con faltas de ortografía (faltas) en modo vocab_write
  const faltasSec = VOCAB.find((s) => s.id === "faltas");
  if (faltasSec && Array.isArray(faltasSec.items)) {
    for (const spellingWord of faltasSec.items) {
      const realGloss = SPELLING_TRANSLATIONS[spellingWord] || glossMap[spellingWord] || "";
      const [spExample, spExtra, spExampleEs] = getExampleAndNote(spellingWord);
      out.push({
        id: `vw-spelling-${spellingWord}`,
        type: "vocab_write",
        word: spellingWord,
        text: `Escribe correctamente la palabra pronunciada (${spellingWord.length} letras)`,
        gloss: "Ortografía",
        options: [spellingWord],
        answers: [spellingWord],
        example: spExample || "",
        exampleEs: realGloss || "",
        note: spExtra || "Esta palabra suele escribirse incorrectamente.",
        isSpelling: true
      });
    }
  }

  return out;
}

export const VOCAB_ITEMS = build();
