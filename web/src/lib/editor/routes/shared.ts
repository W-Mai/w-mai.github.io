/** Shared utilities for editor API route handlers. */

/** Create a JSON Response with the given data and status code. */
export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
