"use client";

import { useState } from "react";
import { Note } from "@/components/bits";
import { ASK_EXAMPLES, answerQuestion, type AskAnswer } from "@/lib/ask";
import { displayText } from "@/lib/metrics";

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
    <article className="page-content">
      <p className="eyebrow">Ask LendFlow</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight text-ink">A question, with the evidence.</h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
        Choose a question below or type a related one. Answers come from the dashboard's published metrics. Questions outside this library return no figures.
      </p>

      <form
        className="ask-form mt-6"
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
          required
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="For example: where do applications drop off?"
        />
        <button type="submit" disabled={!draft.trim()} className="primary-button">
          Show answer
        </button>
      </form>

      <ul className="suggested-questions" aria-label="Suggested questions">
        {ASK_EXAMPLES.map((example) => (
          <li key={example.question}>
            <button
              type="button"
              onClick={() => ask(example.question)}
            >
              {example.question}
            </button>
          </li>
        ))}
      </ul>

      {answer && submitted ? (
        <AnswerView question={submitted} answer={answer} />
      ) : (
        <p className="mt-6 text-sm text-muted">Your answer and its supporting query will appear here.</p>
      )}
    </article>
  );
}

function AnswerView({ question, answer }: { question: string; answer: AskAnswer }) {
  return (
    <section className="mt-8" aria-live="polite" data-status={answer.status} data-intent={answer.intent}>
      <p className="text-xs uppercase tracking-[0.16em] text-copper">
        {answer.status === "answered" ? "Published answer" : "Outside the question library"}
      </p>
      <h2 className="mt-1 font-display text-2xl tracking-tight text-ink">{displayText(answer.heading)}</h2>
      <p className="mt-2 text-sm text-muted">Question: {question}</p>
      <div className="mt-4 grid gap-3">
        {answer.paragraphs.map((paragraph) => (
          <p key={paragraph} className="max-w-3xl text-sm leading-6 text-ink">
            {displayText(paragraph)}
          </p>
        ))}
      </div>
      <div className="mt-4">
        {answer.status === "answered" ? (
          <Note>This is a curated answer based on the published rows.</Note>
        ) : (
          <Note>No figure is filled in for this question.</Note>
        )}
      </div>
      {answer.table ? (
        <div className="mt-4 overflow-x-auto data-panel">
          <table className="data-table min-w-full text-left text-sm">
            <caption className="px-3 py-3 text-left text-xs leading-5 text-muted">{displayText(answer.table.caption)}</caption>
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                {answer.table.columns.map((column) => (
                  <th key={column} className="px-3 py-2 font-medium">
                    {displayText(column)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {answer.table.rows.map((row) => (
                <tr key={row.join("|")} className="border-t border-line">
                  {row.map((cell, index) => (
                    <td key={`${cell}-${index}`} className={`px-3 py-2 ${index === 0 ? "text-ink" : "num text-ink"}`}>
                      {displayText(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {answer.sql ? (
        <details className="mt-4 data-panel p-4">
          <summary className="cursor-pointer text-sm font-medium text-ink">Technical detail: read-only SQL</summary>
          <p className="mt-2 text-xs leading-5 text-muted">The query behind this answer is shown for auditability.</p>
          <pre className="mt-3 overflow-x-auto text-xs leading-5 text-muted">{answer.sql}</pre>
          {answer.compiledSql ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-ink">Compiled experiment query</summary>
              <pre className="mt-3 overflow-x-auto text-xs leading-5 text-muted">{answer.compiledSql}</pre>
            </details>
          ) : null}
        </details>
      ) : null}
    </section>
  );
}
