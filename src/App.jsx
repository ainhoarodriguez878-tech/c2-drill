import React, { useState, useEffect, useRef } from "react";
import { ITEMS as EXAM_ITEMS } from "./items.js";
import { VOCAB_ITEMS } from "./vocabItems.js";
import Vocab from "./Vocab.jsx";

const ITEMS = [...EXAM_ITEMS, ...VOCAB_ITEMS];

const STORE_KEY = "c2drill:state";
const INTERVALS = [0, 1, 3, 7, 16, 35]; // días de espera por caja
const DAILY_GOAL = 5; // preguntas necesarias para que el día cuente

const LABEL = {
  open: "Open cloze",
  word: "Word formation",
  trans: "Key word transformation",
  mcq: "Multiple-choice cloze",
  gapped: "Gapped sentences",
  vocab: "Vocabulario",
};

const FILTERS = [
  { key: "all", label: "Todo" },
  { key: "open", label: "Cloze" },
  { key: "word", label: "Palabras" },
  { key: "trans", label: "Transform." },
  { key: "gapped", label: "Triples" },
  { key: "mcq", label: "Opciones" },
  { key: "vocab", label: "Vocab" },
];

const norm = (s) =>
  (s || "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[.,!?;:]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const today = () => Math.floor(Date.now() / 86400000);

const BLANK_STREAK = { count: 0, best: 0, lastDay: null, todayDay: null, todayN: 0 };

export default function App() {
  const [progress, setProgress] = useState({});
  const [streak, setStreak] = useState(BLANK_STREAK);
  const [current, setCurrent] = useState(null);
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState("drill");
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null); // null | 'right' | 'wrong'
  const [notice, setNotice] = useState("");
  const [loaded, setLoaded] = useState(false);
  const inputRef = useRef(null);

  /* ---------------- guardado en el navegador ---------------- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.progress) setProgress(parsed.progress);
        if (parsed.streak) setStreak(parsed.streak);
      }
    } catch (e) {
      // primera visita o almacenamiento bloqueado: empezamos de cero
    }
    setLoaded(true);
  }, []);

  const persist = (nextProgress, nextStreak) => {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ progress: nextProgress, streak: nextStreak })
      );
    } catch (e) {
      setNotice("Este navegador no permite guardar el progreso.");
    }
  };

  /* ---------------- selección de ejercicio ---------------- */
  const pickNext = (p = progress, f = filter) => {
    const d = today();
    const scope = f === "all" ? ITEMS : ITEMS.filter((it) => it.type === f);
    const source = scope.length ? scope : ITEMS;
    const due = source.filter((it) => p[it.id] && p[it.id].due <= d);
    const fresh = source.filter((it) => !p[it.id]);
    const pool = due.length ? due : fresh.length ? fresh : source;
    let next = pool[Math.floor(Math.random() * pool.length)];
    if (pool.length > 1 && current && next.id === current.id) {
      next = pool[(pool.indexOf(next) + 1) % pool.length];
    }
    setCurrent(next);
    setInput("");
    setResult(null);
    setNotice("");
  };

  useEffect(() => {
    if (loaded && !current) pickNext();
  }, [loaded]);

  useEffect(() => {
    if (current && current.type !== "mcq" && inputRef.current) inputRef.current.focus();
  }, [current]);

  /* ---------------- corrección y repetición espaciada ---------------- */
  const grade = (value) => {
    if (result || !current) return;
    const ok = current.answers.some((a) => norm(a) === norm(value));
    const st = progress[current.id] || { box: 0 };
    const box = ok ? Math.min(st.box + 1, INTERVALS.length - 1) : 0;
    const nextProgress = {
      ...progress,
      [current.id]: { box, due: today() + INTERVALS[box], seen: (st.seen || 0) + 1 },
    };

    const d = today();
    const todayN = streak.todayDay === d ? streak.todayN + 1 : 1;
    let nextStreak = { ...streak, todayDay: d, todayN };
    if (todayN === DAILY_GOAL && streak.lastDay !== d) {
      const count = streak.lastDay === d - 1 ? streak.count + 1 : 1;
      nextStreak = { ...nextStreak, count, best: Math.max(count, streak.best || 0), lastDay: d };
    }

    setProgress(nextProgress);
    setStreak(nextStreak);
    setResult(ok ? "right" : "wrong");
    setInput(value);
    persist(nextProgress, nextStreak);
  };

  const reset = () => {
    setProgress({});
    setStreak(BLANK_STREAK);
    persist({}, BLANK_STREAK);
    setNotice("Progreso borrado.");
    pickNext({}, filter);
  };

  /* ---------------- métricas ---------------- */
  const d = today();
  const dueCount = ITEMS.filter((it) => progress[it.id] && progress[it.id].due <= d).length;
  const freshCount = ITEMS.filter((it) => !progress[it.id]).length;
  const mastered = Object.values(progress).filter((p) => p.box >= 4).length;
  const doneToday = streak.todayDay === d ? streak.todayN : 0;

  if (!loaded) {
    return (
      <div className="c2-root">
        <div className="c2-wrap"><p className="c2-sub">Cargando tu progreso…</p></div>
      </div>
    );
  }

  const parts = current && current.text ? current.text.split("___") : [];

  return (
    <div className="c2-root">
      <div className="c2-wrap">
        <div className="c2-head">
          <span className="c2-title">C2 Drill</span>
          <span className="c2-sub">Use of English</span>
        </div>

        <div className="c2-tabs">
          <button
            className={"c2-tab" + (view === "drill" ? " on" : "")}
            onClick={() => setView("drill")}
          >
            Ejercicios
          </button>
          <button
            className={"c2-tab" + (view === "vocab" ? " on" : "")}
            onClick={() => setView("vocab")}
          >
            Vocabulario
          </button>
        </div>

        {view === "vocab" && <Vocab />}

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
            const n = f.key === "all" ? ITEMS.length : ITEMS.filter((i) => i.type === f.key).length;
            return (
              <button
                key={f.key}
                className={"c2-chip" + (filter === f.key ? " on" : "")}
                onClick={() => {
                  setFilter(f.key);
                  pickNext(progress, f.key);
                }}
              >
                {f.label} <span className="c2-chip-n">{n}</span>
              </button>
            );
          })}
        </div>

        {current && (
          <div className="c2-card">
            <div className="c2-tag">{LABEL[current.type]}</div>

            {current.lead && <div className="c2-lead">{current.lead}</div>}
            {current.given && <div className="c2-given">{current.given}</div>}

            <div className="c2-text">
              {current.type === "vocab" ? (
                <span className="c2-word">{current.word}</span>
              ) : current.type === "gapped" ? (
                <ol className="c2-triple">
                  {(current.sentences || []).map((s, i) => {
                    const bits = s.split("___");
                    return (
                      <li key={i}>
                        {bits[0]}
                        <span className="c2-gap">&nbsp;</span>
                        {bits[1]}
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <>
                  {parts[0]}
                  <span className="c2-gap">&nbsp;</span>
                  {parts[1]}
                </>
              )}
            </div>

            {current.type === "mcq" || current.type === "vocab" ? (
              <div className="c2-opts">
                {(current.options || []).map((o) => {
                  let cls = "c2-opt";
                  if (result) {
                    if (current.answers.some((a) => norm(a) === norm(o))) cls += " hit";
                    else if (norm(o) === norm(input)) cls += " miss";
                  }
                  return (
                    <button key={o} className={cls} disabled={!!result} onClick={() => grade(o)}>
                      {o}
                    </button>
                  );
                })}
              </div>
            ) : (
              <input
                ref={inputRef}
                className="c2-field"
                value={input}
                disabled={!!result}
                placeholder={
                  current.type === "trans"
                    ? "escribe las palabras que faltan"
                    : current.type === "gapped"
                    ? "una palabra que valga para las tres"
                    : "escribe la palabra"
                }
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (result) pickNext();
                    else if (input.trim()) grade(input);
                  }
                }}
              />
            )}

            {result && (
              <div className="c2-fb">
                <div
                  className="c2-verdict"
                  style={{ color: result === "right" ? "var(--ok)" : "var(--pen)" }}
                >
                  {result === "right" ? "Correcto" : "Fallo — vuelve mañana"}
                </div>
                <div className="c2-sol">{current.answers[0]}</div>
                {current.example && <div className="c2-example">{current.example}</div>}
                {current.note && <div className="c2-note">{current.note}</div>}
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
                <button
                  className="c2-btn"
                  disabled={!input.trim() && current.type !== "mcq" && current.type !== "vocab"}
                  onClick={() => grade(input)}
                >
                  Comprobar
                </button>
              ) : (
                <button className="c2-btn" onClick={() => pickNext()}>Siguiente</button>
              )}
            </div>

            {notice && <div className="c2-note-line">{notice}</div>}
          </div>
        )}

        <div className="c2-foot">
          Los fallos vuelven al día siguiente; los aciertos se espacian a 1, 3, 7, 16 y 35 días.
          La racha suma cuando respondes {DAILY_GOAL} preguntas en un día; se pierde si te saltas
          un día entero. El progreso se guarda en este navegador.
          <br />
          <button
            className="c2-btn ghost"
            style={{ marginTop: 12, minWidth: 0, flex: "none", padding: "8px 12px" }}
            onClick={reset}
          >
            Empezar de cero
          </button>
        </div>
        </>)}
      </div>
    </div>
  );
}
