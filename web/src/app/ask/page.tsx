"use client";

import { useState } from "react";
import { Note } from "@/components/bits";
import { ASK_EXAMPLES, answerQuestion, type AskAnswer } from "@/lib/ask";

export default function AskPage() {
  const [draft, setDraft] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const answer = submitted == null ? null : answerQuestion(submitted);

  function ask(question: string) {
    const next = question.trim();
    if (!next) return;
    setDraft(next);
    setSubmitted(next);
  }

  return (
    <article>
      <p className="text-xs uppercase tracking-[0.16em] text-copper">05 — Ask LendFlow</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight text-ink">Ask the governed export</h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
        Answers are a fixed catalog over product_metrics and fct_experiment_results. The same question
        returns the same answer. Interpretation is generated for this demo. There is no live model.
        Synthetic data. Unofficial portfolio case study. Not a lender product.
      </p>

      <form
        className="mt-6 flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          ask(draft);
        }}
      >
        <label className="sr-only" htmlFor="ask-question">
          Question
        </label>
        <input
          id="ask-question"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask a question the export can answer"
          className="w-full rounded-full border border-line bg-card px-4 py-2 text-ink"
        />
        <button type="submit" className="rounded-full bg-ink px-5 py-2 text-sm text-paper">
          Ask
        </button>
      </form>

      <ul className="mt-4 flex flex-wrap gap-2">
        {ASK_EXAMPLES.map((example) => (
          <li key={example.question}>
            <button
              type="button"
              onClick={() => ask(example.question)}
              className="rounded-full border border-line bg-card px-3 py-1.5 text-left text-sm text-ink hover:border-muted"
            >
              {example.question}
            </button>
          </li>
        ))}
      </ul>

      {answer && submitted ? (
        <AnswerView question={submitted} answer={answer} />
      ) : (
        <p className="mt-6 max-w-2xl text-sm leading-6 text-muted">
          Pick a suggested question, or type one. Unsupported questions return no figures.
        </p>
      )}
    </article>
  );
}

function AnswerView({ question, answer }: { question: string; answer: AskAnswer }) {
  return (
    <section className="mt-8" aria-live="polite" data-status={answer.status} data-intent={answer.intent}>
      <p className="text-xs uppercase tracking-[0.16em] text-copper">
        {answer.status === "answered" ? "From the export" : "Refused"}
      </p>
      <h2 className="mt-1 font-display text-2xl tracking-tight text-ink">{answer.heading}</h2>
      <p className="mt-2 text-sm text-muted">Question: {question}</p>
      <div className="mt-4 grid gap-3">
        {answer.paragraphs.map((paragraph) => (
          <p key={paragraph} className="max-w-3xl text-sm leading-6 text-ink">
            {paragraph}
          </p>
        ))}
      </div>
      <div className="mt-4">
        {answer.status === "answered" ? (
          <Note>Interpretation is generated for the demo from these rows. It is not a live model.</Note>
        ) : (
          <Note>No figure is filled in for this question.</Note>
        )}
      </div>
      {answer.table ? (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-card">
          <table className="min-w-full text-left text-sm">
            <caption className="px-3 py-3 text-left text-xs leading-5 text-muted">{answer.table.caption}</caption>
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                {answer.table.columns.map((column) => (
                  <th key={column} className="px-3 py-2 font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {answer.table.rows.map((row) => (
                <tr key={row.join("|")} className="border-t border-line">
                  {row.map((cell, index) => (
                    <td key={`${cell}-${index}`} className={`px-3 py-2 ${index === 0 ? "text-ink" : "num text-ink"}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {answer.sql ? (
        <div className="mt-4 rounded-2xl border border-line bg-card p-4">
          <h3 className="text-sm text-ink">Read-only SQL</h3>
          <p className="mt-1 text-xs leading-5 text-muted">
            This select reads the mart. The page uses the same rows from the committed export. It does not open a
            database.
          </p>
          <pre className="mt-3 overflow-x-auto text-xs leading-5 text-muted">{answer.sql}</pre>
          {answer.compiledSql ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-ink">{answer.compiledSqlLabel}</summary>
              <pre className="mt-3 overflow-x-auto text-xs leading-5 text-muted">{answer.compiledSql}</pre>
            </details>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
