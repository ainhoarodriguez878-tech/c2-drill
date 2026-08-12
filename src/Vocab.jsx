import React, { useState } from "react";
import { VOCAB } from "./vocab.js";

const match = (q, ...fields) =>
  !q || fields.some((f) => (f || "").toLowerCase().includes(q));

export default function Vocab() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(VOCAB[0].id);
  const [hidden, setHidden] = useState(false);
  const [shown, setShown] = useState({});

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  const filtered = VOCAB.map((sec) => {
    if (!searching) return sec;
    if (sec.kind === "pairs") {
      return { ...sec, items: sec.items.filter(([a, b]) => match(q, a, b)) };
    }
    if (sec.kind === "list") {
      return { ...sec, items: sec.items.filter((i) => match(q, i)) };
    }
    return {
      ...sec,
      groups: sec.groups
        .map((g) => ({ ...g, items: g.items.filter((i) => match(q, i, g.label)) }))
        .filter((g) => g.items.length),
    };
  }).filter((sec) => (sec.kind === "groups" ? sec.groups.length : sec.items.length));

  const total = VOCAB.reduce(
    (n, s) => n + (s.kind === "groups" ? s.groups.reduce((m, g) => m + g.items.length, 0) : s.items.length),
    0
  );

  const reveal = (key) => setShown((s) => ({ ...s, [key]: true }));

  return (
    <div>
      <div className="c2-vtools">
        <input
          className="c2-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Buscar entre ${total} entradas…`}
        />
        <button
          className={"c2-chip" + (hidden ? " on" : "")}
          onClick={() => {
            setHidden(!hidden);
            setShown({});
          }}
        >
          {hidden ? "Significados tapados" : "Tapar significados"}
        </button>
      </div>

      {filtered.length === 0 && (
        <p className="c2-empty">Nada con «{query}». Prueba con otra raíz o en inglés.</p>
      )}

      {filtered.map((sec) => {
        const count =
          sec.kind === "groups"
            ? sec.groups.reduce((m, g) => m + g.items.length, 0)
            : sec.items.length;
        const isOpen = searching || open === sec.id;
        return (
          <section key={sec.id} className="c2-sec">
            <button
              className="c2-sec-h"
              aria-expanded={isOpen}
              onClick={() => setOpen(open === sec.id ? null : sec.id)}
            >
              <span>{sec.title}</span>
              <span className="c2-sec-n">{count}</span>
            </button>

            {isOpen && (
              <div className="c2-sec-b">
                {sec.note && <p className="c2-sec-note">{sec.note}</p>}

                {sec.kind === "pairs" && (
                  <dl className="c2-pairs">
                    {sec.items.map(([term, gloss]) => {
                      const key = sec.id + term;
                      const veiled = hidden && !shown[key];
                      return (
                        <div key={key} className="c2-pair">
                          <dt>{term}</dt>
                          <dd>
                            {veiled ? (
                              <button className="c2-veil" onClick={() => reveal(key)}>
                                mostrar
                              </button>
                            ) : (
                              gloss
                            )}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                )}

                {sec.kind === "list" && (
                  <p className="c2-chunks">
                    {sec.items.map((i) => (
                      <span key={i} className="c2-chunk">{i}</span>
                    ))}
                  </p>
                )}

                {sec.kind === "groups" &&
                  sec.groups.map((g) => (
                    <div key={g.label} className="c2-group">
                      <h4>{g.label}</h4>
                      <p className="c2-chunks">
                        {g.items.map((i) => (
                          <span key={i} className="c2-chunk">{i}</span>
                        ))}
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
