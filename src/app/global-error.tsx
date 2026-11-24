"use client";

export default function GlobalError({
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
          padding: "3rem 1.5rem",
          fontFamily: "system-ui, sans-serif",
          color: "#111",
          background: "white",
        }}
      >
        <main style={{ maxWidth: "40rem", margin: "auto" }}>
          <h1>VC Memory couldn’t start</h1>
          <p style={{ lineHeight: 1.7 }}>
            The application is temporarily unavailable. Retry to reload the
            workspace.
          </p>
          <button
            onClick={reset}
            style={{
              minHeight: 44,
              padding: "0.75rem 1.25rem",
              border: "1px solid #111",
              background: "#111",
              color: "white",
              font: "inherit",
              cursor: "pointer",
            }}
          >
            Retry application
          </button>
        </main>
      </body>
    </html>
  );
}
