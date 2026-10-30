"use client";

/**
 * Last-resort boundary: catches failures in the root layout itself, where app/error.tsx
 * cannot render because it lives inside that layout. It must ship its own <html>/<body>
 * and cannot rely on globals.css or the component kit having loaded.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.75rem",
          fontFamily: "system-ui, -apple-system, sans-serif",
          textAlign: "center",
          padding: "2rem",
          color: "#1a1a1a",
          background: "#faf9f6",
        }}
      >
        <p style={{ fontSize: "0.75rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#6b6b6b" }}>
          Nexus Commerce
        </p>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>The shop couldn&apos;t load</h1>
        <p style={{ maxWidth: "28rem", fontSize: "0.875rem", color: "#4a4a4a", margin: 0 }}>
          Something failed before the page could render. Reloading usually fixes it.
        </p>
        {error.digest ? (
          <p style={{ fontSize: "0.75rem", color: "#6b6b6b", margin: 0 }}>Reference: {error.digest}</p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "0.5rem",
            padding: "0.6rem 1.2rem",
            borderRadius: "0.375rem",
            border: "1px solid #1a1a1a",
            background: "#1a1a1a",
            color: "#faf9f6",
            cursor: "pointer",
            fontSize: "0.875rem",
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
