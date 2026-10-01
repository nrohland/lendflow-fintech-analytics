"use client";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <section className="data-panel p-6" role="alert">
    <h1 className="font-display text-3xl">This view could not be loaded.</h1>
    <p className="mt-3 text-sm text-muted">Retry the view to reload the published dashboard.</p>
    <button className="primary-button mt-5" type="button" onClick={retry}>Reload view</button>
  </section>;
}
