/** Client requests have a finite lifetime, including reading the response body. */
export async function requestJson<T>(
  url: string,
  {
    timeoutMs = 90_000,
    signal,
    ...options
  }: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    let data: unknown;
    try {
      data = await response.json();
    } catch (error) {
      if (controller.signal.aborted) throw error;
      throw new Error(
        "The server returned an unreadable response. Please retry.",
      );
    }
    if (!response.ok) {
      const error =
        data && typeof data === "object" && "error" in data ? data.error : null;
      throw new Error(
        typeof error === "string" ? error : "The request failed. Please retry.",
      );
    }
    return data as T;
  } catch (error) {
    if (timedOut) {
      const timeout = new Error(
        "This is taking longer than expected. Please retry.",
      );
      timeout.name = "TimeoutError";
      throw timeout;
    }
    if (signal?.aborted) {
      const cancelled = new Error("Request cancelled.");
      cancelled.name = "AbortError";
      throw cancelled;
    }
    if (error instanceof TypeError)
      throw new Error("Could not connect. Check your connection and retry.");
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
