// The native job keeps its own180s execution limit. Claude clients allow a
// bounded30s observation/cleanup grace so the server's terminal error wins
// over a browser-side Cancel. This does not extend model execution.
export function generationObservationMs(provider:'claude'|'codex'):number{
 return provider==='claude'?210000:180000;
}
