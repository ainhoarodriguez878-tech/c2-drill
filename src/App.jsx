import React, { useState, useEffect, useRef } from "react";
import { ITEMS as EXAM_ITEMS } from "./items.js";
import { VOCAB_ITEMS } from "./vocabItems.js";
import Vocab from "./Vocab.jsx";

const ITEMS = [...EXAM_ITEMS, ...VOCAB_ITEMS];

const STORE_KEY = "c2drill:state";
const DARK_KEY  = "c2drill:dark";
const INTERVALS  = [0, 7, 15, 30, 60, 90]; // días de espera por caja (los fallos se repasan al día siguiente)
const DAILY_GOAL  = 5;                    // preguntas para que el día cuente
const EXAM_Q      = 10;                   // preguntas por sesión de examen
const EXAM_SECS   = 12 * 60;             // 12 minutos

const LABEL = {
  open:   "Open cloze",
  word:   "Word formation",
  trans:  "Key word transformation",
  mcq:    "Multiple-choice cloze",
  gapped: "Gapped sentences",
  vocab:  "Vocabulario (Test)",
  vocab_write: "Vocabulario (Escribir)",
};

const FILTERS = [
  { key: "all",    label: "Todo" },
  { key: "open",   label: "Cloze" },
  { key: "word",   label: "Palabras" },
  { key: "trans",  label: "Transform." },
  { key: "gapped", label: "Triples" },
  { key: "mcq",    label: "Opciones" },
  { key: "vocab",  label: "Vocab (Test)" },
  { key: "vocab_write", label: "Vocab (Escribir)" },
  { key: "errors", label: "Errores" },
];

const norm = (s) =>
  (s || "")
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[.,!?;:]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const today = () => Math.floor(Date.now() / 86400000);

const BLANK_STREAK = { count: 0, best: 0, lastDay: null, todayDay: null, todayN: 0 };

/** Devuelve el pool de ítems según el filtro activo */
function getScope(f, p) {
  if (f === "all")    return ITEMS;
  if (f === "errors") return ITEMS.filter((it) => p[it.id] && p[it.id].box === 0 && (p[it.id].seen || 0) > 0);
  return ITEMS.filter((it) => it.type === f);
}

export default function App() {
  /* ---- estado global ---- */
  const [progress, setProgress] = useState({});
  const [streak,   setStreak]   = useState(BLANK_STREAK);
  const [current,  setCurrent]  = useState(null);
  const [filter,   setFilter]   = useState("all");
  const [view,     setView]     = useState("drill");
  const [input,    setInput]    = useState("");
  const [result,   setResult]   = useState(null); // null | 'right' | 'wrong'
  const [notice,   setNotice]   = useState("");
  const [loaded,   setLoaded]   = useState(false);
  const [dark,     setDark]     = useState(false);

  /* ---- estado modo examen ---- */
  const [examItems,    setExamItems]    = useState([]);
  const [examIndex,    setExamIndex]    = useState(0);
  const [examInput,    setExamInput]    = useState("");
  const [examResult,   setExamResult]   = useState(null);
  const [examAnswers,  setExamAnswers]  = useState([]);
  const [examFinished, setExamFinished] = useState(false);
  const [examTimer,    setExamTimer]    = useState(EXAM_SECS);
  const [examRunning,  setExamRunning]  = useState(false);
  const timerRef    = useRef(null);
  const inputRef    = useRef(null);
  const examInputRef = useRef(null);
  const voicesRef   = useRef([]);   // caché de voces TTS

  /* ---------------- carga desde localStorage ---------------- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.progress) setProgress(parsed.progress);
        if (parsed.streak)   setStreak(parsed.streak);
      }
      if (localStorage.getItem(DARK_KEY) === "1") setDark(true);
    } catch (e) { /* primera visita */ }
    setLoaded(true);
  }, []);

  /* --- precarga de voces TTS (necesario en Chrome/Edge) --- */
  useEffect(() => {
    const load = () => { voicesRef.current = window.speechSynthesis?.getVoices() || []; };
    load();
    window.speechSynthesis?.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis?.removeEventListener("voiceschanged", load);
  }, []);

  const persist = (np, ns) => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ progress: np, streak: ns })); }
    catch (e) { setNotice("Este navegador no permite guardar el progreso."); }
  };

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    try { localStorage.setItem(DARK_KEY, next ? "1" : "0"); } catch (e) {}
  };

  /* ---------------- selección de ejercicio (drill) ---------------- */
  const pickNext = (p = progress, f = filter, excludeId = null) => {
    const d      = today();
    const scope  = getScope(f, p);
    const source = scope.length ? scope : ITEMS;

    // 1. Fallos pendientes (due y box === 0)
    const dueFailed = source.filter(
      (it) => p[it.id] && p[it.id].due <= d && p[it.id].box === 0 && it.id !== excludeId
    );

    // 2. Ítems nuevos / sin ver
    const fresh = source.filter(
      (it) => !p[it.id] && it.id !== excludeId
    );

    // 3. Aciertos pendientes (due y box > 0)
    const duePassed = source.filter(
      (it) => p[it.id] && p[it.id].due <= d && p[it.id].box > 0 && it.id !== excludeId
    );

    let pool = [];
    if (dueFailed.length) {
      // Prioridad máxima: repasar los fallos del día anterior
      pool = dueFailed;
    } else if (fresh.length) {
      // Prioridad media: aprender palabras nuevas del listado
      pool = fresh;
    } else if (duePassed.length) {
      // Prioridad baja: repasar aciertos anteriores una vez agotado el listado de nuevas
      pool = duePassed;
    } else {
      // Fallback: si no hay pendientes ni nuevos, mostramos cualquiera menos el actual
      pool = source.filter((it) => it.id !== excludeId);
      if (pool.length === 0) pool = source;
    }

    const next = pool[Math.floor(Math.random() * pool.length)];
    setCurrent(next);
    setInput("");
    setResult(null);
    setNotice("");
  };

  useEffect(() => { if (loaded && !current) pickNext(); }, [loaded]);

  useEffect(() => {
    if (current && current.type !== "mcq" && current.type !== "vocab" && inputRef.current)
      inputRef.current.focus();
    if (current && current.type === "vocab_write" && current.isSpelling) {
      setTimeout(() => { speak(current.word); }, 150);
    }
  }, [current]);

  /* ---------------- corrección + spaced repetition (drill) ---------------- */
  const grade = (value) => {
    if (result || !current) return;
    const ok  = current.answers.some((a) => norm(a) === norm(value));
    const st  = progress[current.id] || { box: 0 };
    const box = ok ? Math.min(st.box + 1, INTERVALS.length - 1) : 0;
    // los fallos vuelven mañana (due = hoy+1), nunca hoy
    const due = ok ? today() + INTERVALS[box] : today() + 1;
    const np  = { ...progress, [current.id]: { box, due, seen: (st.seen || 0) + 1 } };

    const d      = today();
    const todayN = streak.todayDay === d ? streak.todayN + 1 : 1;
    let ns = { ...streak, todayDay: d, todayN };
    if (todayN === DAILY_GOAL && streak.lastDay !== d) {
      const count = streak.lastDay === d - 1 ? streak.count + 1 : 1;
      ns = { ...ns, count, best: Math.max(count, streak.best || 0), lastDay: d };
    }
    setProgress(np); setStreak(ns);
    setResult(ok ? "right" : "wrong");
    setInput(value);
    persist(np, ns);
  };

  const reset = () => {
    setProgress({}); setStreak(BLANK_STREAK);
    persist({}, BLANK_STREAK);
    setNotice("Progreso borrado.");
    pickNext({}, filter);
  };

  /* ---------------- pronunciación TTS (inglés británico) ---------------- */
  /** Devuelve el texto en inglés que debe pronunciarse según el tipo de ejercicio */
  const getSpeakText = (item, isRevealed) => {
    if (!item) return "";
    if (item.type === "vocab") return item.word;
    if (item.type === "vocab_write") {
      if (item.isSpelling) return item.word;
      if (item.example) {
        return isRevealed ? item.example : item.text;
      }
      return isRevealed ? item.word : "";
    }
    if (item.type === "gapped") {
      const fill = isRevealed ? item.answers[0] : "";
      return (item.sentences || []).map((s) => s.replace("___", fill)).join(". ");
    }
    if (item.type === "trans") {
      // antes de responder: lee la frase fuente; después: lee la transformación completa
      return isRevealed
        ? (item.lead || "") + ". " + (item.text || "").replace("___", item.answers[0])
        : (item.lead || "");
    }
    const fill = isRevealed ? item.answers[0] : "";
    return (item.text || "").replace("___", fill);
  };

  const speak = (text) => {
    if (!window.speechSynthesis || !text.trim()) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = "en-GB";
    utt.rate = 0.88;
    const voices = voicesRef.current;
    const voice =
      voices.find((v) => v.lang === "en-GB") ||
      voices.find((v) => v.lang.startsWith("en-GB")) ||
      voices.find((v) => v.lang === "en-US") ||
      voices.find((v) => v.lang.startsWith("en")) ||
      null;
    if (voice) utt.voice = voice;
    window.speechSynthesis.speak(utt);
  };

  /* ---------------- exportar / importar ---------------- */
  const exportProgress = () => {
    const blob = new Blob([JSON.stringify({ progress, streak }, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `c2drill-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importProgress = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (!parsed.progress) { setNotice("Archivo no válido."); return; }
        setProgress(parsed.progress);
        setStreak(parsed.streak || BLANK_STREAK);
        persist(parsed.progress, parsed.streak || BLANK_STREAK);
        setNotice("✓ Progreso importado.");
        pickNext(parsed.progress, filter);
      } catch { setNotice("No se pudo leer el archivo."); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  /* ---------------- modo examen ---------------- */
  const startExam = (f = "all") => {
    const scope    = getScope(f, progress);
    const pool     = scope.length >= EXAM_Q ? scope : ITEMS;
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, EXAM_Q);
    setExamItems(shuffled);
    setExamIndex(0); setExamInput(""); setExamResult(null);
    setExamAnswers([]); setExamFinished(false);
    setExamTimer(EXAM_SECS); setExamRunning(true);
  };

  // cronómetro del examen
  useEffect(() => {
    if (!examRunning || examFinished) { clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => {
      setExamTimer((t) => {
        if (t <= 1) { clearInterval(timerRef.current); setExamFinished(true); setExamRunning(false); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [examRunning, examFinished]);

  const gradeExam = (value) => {
    if (examResult) return;
    const item = examItems[examIndex];
    const ok   = item.answers.some((a) => norm(a) === norm(value));
    // registra en spaced repetition
    const st  = progress[item.id] || { box: 0 };
    const box = ok ? Math.min(st.box + 1, INTERVALS.length - 1) : 0;
    const np  = { ...progress, [item.id]: { box, due: today() + INTERVALS[box], seen: (st.seen || 0) + 1 } };
    setProgress(np); persist(np, streak);
    setExamResult(ok ? "right" : "wrong");
    setExamInput(value);
    setExamAnswers((prev) => [...prev, { item, correct: ok, given: value }]);
  };

  const nextExamQ = () => {
    if (examIndex + 1 >= examItems.length) { setExamFinished(true); setExamRunning(false); }
    else { setExamIndex((i) => i + 1); setExamInput(""); setExamResult(null); }
  };

  useEffect(() => {
    if (view === "exam" && examRunning && examInputRef.current) {
      const item = examItems[examIndex];
      if (item && item.type !== "mcq" && item.type !== "vocab") examInputRef.current.focus();
      if (item && item.type === "vocab_write" && item.isSpelling) {
        setTimeout(() => { speak(item.word); }, 150);
      }
    }
  }, [examIndex, examRunning, view]);

  /* ---------------- métricas globales ---------------- */
  const d           = today();
  const dueCount    = ITEMS.filter((it) => progress[it.id] && progress[it.id].due <= d).length;
  const freshCount  = ITEMS.filter((it) => !progress[it.id]).length;
  const mastered    = Object.values(progress).filter((p) => p.box >= 4).length;
  const doneToday   = streak.todayDay === d ? streak.todayN : 0;
  const errorsCount = ITEMS.filter((it) => progress[it.id] && progress[it.id].box === 0 && (progress[it.id].seen || 0) > 0).length;

  /* ---------------- datos estadísticas ---------------- */
  const statsRows = [
    { key: "open",   label: "Open cloze" },
    { key: "word",   label: "Word formation" },
    { key: "trans",  label: "Key word transf." },
    { key: "gapped", label: "Gapped sentences" },
    { key: "mcq",    label: "Multiple-choice" },
    { key: "vocab",  label: "Vocabulario (Test)" },
    { key: "vocab_write", label: "Vocabulario (Escribir)" },
  ].map((f) => {
    const items    = ITEMS.filter((it) => it.type === f.key);
    const seen     = items.filter((it) => progress[it.id]);
    const correct  = seen.filter((it) => (progress[it.id]?.box || 0) > 0);
    const dom      = items.filter((it) => (progress[it.id]?.box || 0) >= 4);
    const accuracy = seen.length > 0 ? Math.round((correct.length / seen.length) * 100) : null;
    return { ...f, total: items.length, seen: seen.length, correct: correct.length, mastered: dom.length, accuracy };
  });
  const totalSeen     = Object.keys(progress).length;
  const totalCorrect  = Object.values(progress).filter((p) => p.box > 0).length;
  const globalAcc     = totalSeen > 0 ? Math.round((totalCorrect / totalSeen) * 100) : null;

  /* ---------------- helpers de render ---------------- */
  const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const renderQuestionBody = (item, examParts) => {
    const parts = item && item.text ? item.text.split("___") : [];
    return (
      <div className="c2-text">
        {item.type === "vocab" ? (
          <span className="c2-word">{item.word}</span>
        ) : item.type === "vocab_write" ? (
          item.text.includes("___") ? (
            <>{(examParts || parts)[0]}<span className="c2-gap">&nbsp;</span>{(examParts || parts)[1]}</>
          ) : (
            <span>{item.text}</span>
          )
        ) : item.type === "gapped" ? (
          <ol className="c2-triple">
            {(item.sentences || []).map((s, i) => {
              const bits = s.split("___");
              return <li key={i}>{bits[0]}<span className="c2-gap">&nbsp;</span>{bits[1]}</li>;
            })}
          </ol>
        ) : (
          <>{(examParts || parts)[0]}<span className="c2-gap">&nbsp;</span>{(examParts || parts)[1]}</>
        )}
      </div>
    );
  };

  if (!loaded) return (
    <div className="c2-root"><div className="c2-wrap"><p className="c2-sub">Cargando…</p></div></div>
  );

  const examItem  = examItems[examIndex];
  const examParts = examItem && examItem.text ? examItem.text.split("___") : [];
  const drillParts = current && current.text ? current.text.split("___") : [];

  return (
    <div className="c2-root" data-dark={dark ? "1" : "0"}>
      <div className="c2-wrap">

        {/* ---- cabecera ---- */}
        <div className="c2-head">
          <span className="c2-title">C2 Drill</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="c2-sub">Use of English</span>
            <button className="c2-dark-toggle" onClick={toggleDark} aria-label="Cambiar tema">
              {dark ? "☀" : "☾"}
            </button>
          </div>
        </div>

        {/* ---- pestañas ---- */}
        <div className="c2-tabs">
          <button className={"c2-tab" + (view === "drill" ? " on" : "")} onClick={() => setView("drill")}>Ejercicios</button>
          <button className={"c2-tab" + (view === "exam"  ? " on" : "")} onClick={() => { setView("exam"); if (!examRunning && !examFinished) startExam(); }}>Examen</button>
          <button className={"c2-tab" + (view === "stats" ? " on" : "")} onClick={() => setView("stats")}>Estadísticas</button>
          <button className={"c2-tab" + (view === "vocab" ? " on" : "")} onClick={() => setView("vocab")}>Vocabulario</button>
        </div>

        {/* ======================================================= */}
        {/*  VOCABULARIO                                             */}
        {/* ======================================================= */}
        {view === "vocab" && <Vocab />}

        {/* ======================================================= */}
        {/*  ESTADÍSTICAS                                            */}
        {/* ======================================================= */}
        {view === "stats" && (
          <div className="c2-stats">
            <div className="c2-stats-hero">
              <div className="c2-stats-big">
                <span className="c2-stats-num">{globalAcc !== null ? `${globalAcc}%` : "—"}</span>
                <span className="c2-stats-label">precisión global</span>
              </div>
              <div className="c2-stats-row3">
                <div className="c2-stats-cell">
                  <span className="c2-stats-n">{totalSeen}</span>
                  <span className="c2-stats-l">vistas</span>
                </div>
                <div className="c2-stats-cell">
                  <span className="c2-stats-n">{mastered}</span>
                  <span className="c2-stats-l">dominadas</span>
                </div>
                <div className="c2-stats-cell">
                  <span className="c2-stats-n">{streak.best || 0}</span>
                  <span className="c2-stats-l">días récord</span>
                </div>
              </div>
            </div>

            <div className="c2-stats-section">
              <div className="c2-stats-h">Precisión por tipo</div>
              {statsRows.map((s) => (
                <div key={s.key} className="c2-stats-bar-row">
                  <span className="c2-stats-bar-label">{s.label}</span>
                  <div className="c2-stats-bar-track">
                    <div className="c2-stats-bar-fill" style={{ width: s.accuracy !== null ? `${s.accuracy}%` : "0%" }} />
                  </div>
                  <span className="c2-stats-bar-pct">{s.accuracy !== null ? `${s.accuracy}%` : "—"}</span>
                  <span className="c2-stats-bar-sub">{s.seen}/{s.total}</span>
                </div>
              ))}
            </div>

            <div className="c2-stats-section">
              <div className="c2-stats-h">Estado de ítems</div>
              <div className="c2-stats-state-row">
                <div className="c2-stats-state-cell c2-state-review">
                  <span className="c2-stats-n">{dueCount}</span>
                  <span className="c2-stats-l">para repasar</span>
                </div>
                <div className="c2-stats-state-cell c2-state-fresh">
                  <span className="c2-stats-n">{freshCount}</span>
                  <span className="c2-stats-l">sin ver</span>
                </div>
                <div className="c2-stats-state-cell c2-state-error">
                  <span className="c2-stats-n">{errorsCount}</span>
                  <span className="c2-stats-l">con errores</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================= */}
        {/*  MODO EXAMEN                                             */}
        {/* ======================================================= */}
        {view === "exam" && (
          <div className="c2-exam">

            {/* pantalla de inicio */}
            {!examRunning && !examFinished && (
              <div className="c2-exam-start">
                <div className="c2-exam-title">Modo Examen</div>
                <p className="c2-exam-desc">
                  {EXAM_Q} preguntas · cronómetro de 12 min · los resultados cuentan para tu repaso.
                </p>
                <div className="c2-exam-filter-list">
                  {[
                    { key: "all",    label: "Todas las categorías" },
                    { key: "open",   label: "Open cloze" },
                    { key: "word",   label: "Word formation" },
                    { key: "trans",  label: "Key word transformation" },
                    { key: "mcq",    label: "Multiple-choice" },
                    { key: "gapped", label: "Gapped sentences" },
                    { key: "vocab_write", label: "Vocabulario (Escribir)" },
                  ].map((f) => (
                    <button key={f.key} className="c2-btn ghost c2-exam-pick" onClick={() => startExam(f.key)}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* sesión activa */}
            {examRunning && !examFinished && examItem && (
              <div className="c2-exam-session">
                <div className="c2-exam-hdr">
                  <span className="c2-exam-progress">{examIndex + 1} / {examItems.length}</span>
                  <span className={"c2-exam-timer" + (examTimer < 120 ? " c2-timer-warn" : "")}>{fmtTime(examTimer)}</span>
                </div>
                <div className="c2-exam-pbar">
                  <div className="c2-exam-pbar-fill" style={{ width: `${(examIndex / examItems.length) * 100}%` }} />
                </div>

                <div className="c2-card">
                  <div className="c2-tag">{LABEL[examItem.type]}</div>
                  {examItem.lead  && <div className="c2-lead">{examItem.lead}</div>}
                  {(examItem.type === "vocab_write" ? examItem.gloss : examItem.given) && (
                    <div className="c2-given">{examItem.type === "vocab_write" ? examItem.gloss : examItem.given}</div>
                  )}

                  {/* Pista: traduccion al espanol de la frase (visible antes de responder) */}
                  {examItem.type === "vocab_write" && examItem.exampleEs && !examResult && (
                    <div className="c2-hint-es">
                      <span className="c2-hint-label">{examItem.isSpelling ? "Significado: " : "Traducción: "}</span>
                      {examItem.exampleEs}
                    </div>
                  )}

                  {renderQuestionBody(examItem, examParts)}

                  {/* botón de pronunciación */}
                  <button
                    className="c2-speak-btn"
                    onClick={() => speak(getSpeakText(examItem, !!examResult))}
                    title="Pronunciación en inglés británico"
                  >
                    🔊
                  </button>

                  {examItem.type === "mcq" || examItem.type === "vocab" ? (
                    <div className="c2-opts">
                      {(examItem.options || []).map((o) => {
                        let cls = "c2-opt";
                        if (examResult) {
                          if (examItem.answers.some((a) => norm(a) === norm(o))) cls += " hit";
                          else if (norm(o) === norm(examInput)) cls += " miss";
                        }
                        return <button key={o} className={cls} disabled={!!examResult} onClick={() => gradeExam(o)}>{o}</button>;
                      })}
                    </div>
                  ) : (
                    <input
                      ref={examInputRef}
                      className="c2-field"
                      value={examInput}
                      disabled={!!examResult}
                      placeholder={
                        examItem.type === "trans" ? "escribe las palabras que faltan" :
                        examItem.type === "gapped" ? "una palabra para las tres" :
                        examItem.type === "vocab_write" ? (examItem.isSpelling ? "escribe la palabra pronunciada" : "escribe la traducción (forma base)") :
                        "escribe la palabra"
                      }
                      onChange={(e) => setExamInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { if (examResult) nextExamQ(); else if (examInput.trim()) gradeExam(examInput); } }}
                    />
                  )}

                  {examResult && (
                    <div className="c2-fb">
                      <div className="c2-verdict" style={{ color: examResult === "right" ? "var(--ok)" : "var(--pen)" }}>
                        {examResult === "right" ? "Correcto" : "Fallo"}
                      </div>
                      <div className="c2-sol">{examItem.answers[0]}</div>
                      {examItem.note && <div className="c2-note">{examItem.note}</div>}
                      {examItem.example && (
                        <div className="c2-example-block">
                          <div className="c2-example">{examItem.example}</div>
                          {examItem.exampleEs && <div className="c2-example-es">{examItem.exampleEs}</div>}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="c2-row">
                    {!examResult ? (
                      <button className="c2-btn" disabled={!examInput.trim() && examItem.type !== "mcq" && examItem.type !== "vocab"} onClick={() => gradeExam(examInput)}>Comprobar</button>
                    ) : (
                      <button className="c2-btn" onClick={nextExamQ}>
                        {examIndex + 1 < examItems.length ? "Siguiente" : "Ver resultados"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* resultados finales */}
            {examFinished && (
              <div className="c2-exam-results">
                <div className="c2-exam-title">Resultado</div>
                <div className="c2-exam-score">
                  <span className="c2-stats-num">{examAnswers.filter((a) => a.correct).length}<span style={{ fontSize: 28, fontWeight: 300 }}>/{examAnswers.length}</span></span>
                  <span className="c2-stats-label">correctas{examTimer === 0 ? " · tiempo agotado" : ""}</span>
                </div>
                <div className="c2-exam-review">
                  {examAnswers.map(({ item, correct, given }, i) => (
                    <div key={i} className={"c2-exam-row" + (correct ? " c2-row-ok" : " c2-row-fail")}>
                      <span className="c2-exam-row-icon">{correct ? "✓" : "✗"}</span>
                      <div>
                        <div className="c2-exam-row-type">{LABEL[item.type]}</div>
                        <div className="c2-exam-row-ans">
                          {item.answers[0]}
                          {!correct && <span className="c2-exam-row-given"> (tú: {given || "—"})</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="c2-row" style={{ marginTop: 20 }}>
                  <button className="c2-btn" onClick={() => { setExamRunning(false); setExamFinished(false); }}>Nuevo examen</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================= */}
        {/*  DRILL (ejercicios libres)                               */}
        {/* ======================================================= */}
        {view === "drill" && (<>
          <div className="c2-streak">
            <span className="c2-streak-n">
              {streak.count}
              <span className="c2-streak-u">{streak.count === 1 ? " día" : " días"} seguidos</span>
            </span>
            <span className="c2-tally" aria-hidden="true">
              {Array.from({ length: Math.min(streak.count, 30) }).map((_, i) => (
                <i key={i} className={(i + 1) % 5 === 0 ? "cut" : ""} />
              ))}
            </span>
            {streak.best > streak.count && <span className="c2-best">récord {streak.best}</span>}
          </div>

          <div className="c2-goal">
            <span className="c2-dots" aria-hidden="true">
              {Array.from({ length: DAILY_GOAL }).map((_, i) => (
                <i key={i} className={i < doneToday ? "on" : ""} />
              ))}
            </span>
            <span>
              {doneToday >= DAILY_GOAL
                ? `Día cumplido — ${doneToday} respondidas`
                : `${doneToday} de ${DAILY_GOAL} para que hoy cuente`}
            </span>
          </div>

          <div className="c2-meter">
            <span>Para repasar <b>{dueCount}</b></span>
            <span>Sin ver <b>{freshCount}</b></span>
            <span>Dominadas <b>{mastered}</b></span>
          </div>

          <div className="c2-filters">
            {FILTERS.map((f) => {
              const n = f.key === "all" ? ITEMS.length
                : f.key === "errors" ? errorsCount
                : ITEMS.filter((i) => i.type === f.key).length;
              return (
                <button
                  key={f.key}
                  className={"c2-chip" + (filter === f.key ? " on" : "") + (f.key === "errors" ? " c2-chip-errors" : "")}
                  onClick={() => { setFilter(f.key); pickNext(progress, f.key); }}
                >
                  {f.label} <span className="c2-chip-n">{n}</span>
                </button>
              );
            })}
          </div>

          {current && (
            <div className="c2-card">
              <div className="c2-tag">{LABEL[current.type]}</div>
              {current.lead  && <div className="c2-lead">{current.lead}</div>}
              {(current.type === "vocab_write" ? current.gloss : current.given) && (
                <div className="c2-given">{current.type === "vocab_write" ? current.gloss : current.given}</div>
              )}

              {/* Pista: traduccion al espanol de la frase (visible antes de responder) */}
              {current.type === "vocab_write" && current.exampleEs && !result && (
                <div className="c2-hint-es">
                  <span className="c2-hint-label">{current.isSpelling ? "Significado: " : "Traduccion: "}</span>
                  {current.exampleEs}
                </div>
              )}

              <div className="c2-text">
                {current.type === "vocab" ? (
                  <span className="c2-word">{current.word}</span>
                ) : current.type === "gapped" ? (
                  <ol className="c2-triple">
                    {(current.sentences || []).map((s, i) => {
                      const bits = s.split("___");
                      return <li key={i}>{bits[0]}<span className="c2-gap">&nbsp;</span>{bits[1]}</li>;
                    })}
                  </ol>
                ) : (
                  <>{drillParts[0]}<span className="c2-gap">&nbsp;</span>{drillParts[1]}</>
                )}
              </div>

              {/* botón de pronunciación */}
              <button
                className="c2-speak-btn"
                onClick={() => speak(getSpeakText(current, !!result))}
                title="Pronunciación en inglés británico"
              >
                🔊
              </button>

              {current.type === "mcq" || current.type === "vocab" ? (
                <div className="c2-opts">
                  {(current.options || []).map((o) => {
                    let cls = "c2-opt";
                    if (result) {
                      if (current.answers.some((a) => norm(a) === norm(o))) cls += " hit";
                      else if (norm(o) === norm(input)) cls += " miss";
                    }
                    return <button key={o} className={cls} disabled={!!result} onClick={() => grade(o)}>{o}</button>;
                  })}
                </div>
              ) : (
                <input
                  ref={inputRef}
                  className="c2-field"
                  value={input}
                  disabled={!!result}
                  placeholder={
                    current.type === "trans" ? "escribe las palabras que faltan" :
                    current.type === "gapped" ? "una palabra que valga para las tres" :
                    current.type === "vocab_write" ? (current.isSpelling ? "escribe la palabra pronunciada" : "escribe la traducción (forma base)") :
                    "escribe la palabra"
                  }
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { if (result) pickNext(progress, filter, current?.id); else if (input.trim()) grade(input); } }}
                />
              )}

              {result && (
                <div className="c2-fb">
                  <div className="c2-verdict" style={{ color: result === "right" ? "var(--ok)" : "var(--pen)" }}>
                    {result === "right" ? "Correcto" : "Fallo — vuelve mañana"}
                  </div>
                  <div className="c2-sol">{current.answers[0]}</div>
                  {current.note && <div className="c2-note">{current.note}</div>}
                  {current.example && (
                    <div className="c2-example-block">
                      <div className="c2-example">{current.example}</div>
                      {current.exampleEs && <div className="c2-example-es">{current.exampleEs}</div>}
                    </div>
                  )}
                  {current.isSpelling && current.exampleEs && (
                    <div className="c2-example-block">
                      <div className="c2-example-es" style={{ marginTop: "8px", fontSize: "14px", color: "var(--mute)" }}>
                        Significado: {current.exampleEs}
                      </div>
                    </div>
                  )}
                  {(current.type === "mcq" || current.type === "vocab") && current.whyNot && (
                    <div className="c2-why">
                      <div className="c2-why-h">Por qué las otras no</div>
                      {(current.options || [])
                        .filter((o) => !current.answers.some((a) => norm(a) === norm(o)))
                        .map((o) => (
                          <div key={o} className="c2-why-row">
                            <span className="c2-why-w">{o}</span>
                            <span>{current.whyNot[o] || "No colocaciona en este contexto."}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              <div className="c2-row">
                {!result ? (
                  <button className="c2-btn" disabled={!input.trim() && current.type !== "mcq" && current.type !== "vocab"} onClick={() => grade(input)}>
                    Comprobar
                  </button>
                ) : (
                  <button className="c2-btn" onClick={() => pickNext(progress, filter, current?.id)}>Siguiente</button>
                )}
              </div>

              {notice && <div className="c2-note-line">{notice}</div>}
            </div>
          )}

          <div className="c2-foot">
            Los fallos no vuelven hasta mañana; los aciertos se espacian a 7, 15, 30, 60 y 90 días.
            La racha suma cuando respondes {DAILY_GOAL} preguntas en un día; se pierde si te saltas
            un día entero. El progreso se guarda en este navegador.
            <br />
            <div className="c2-foot-btns">
              <button className="c2-btn ghost c2-foot-btn" onClick={reset}>Empezar de cero</button>
              <button className="c2-btn ghost c2-foot-btn" onClick={exportProgress}>Exportar progreso</button>
              <label  className="c2-btn ghost c2-foot-btn">
                Importar progreso
                <input type="file" accept=".json" style={{ display: "none" }} onChange={importProgress} />
              </label>
            </div>
          </div>
        </>)}

      </div>
    </div>
  );
}
