// Minimal type surface for analyze-face-core.mjs (plain JS, copied verbatim
// from avatar-anim-v2) so vite.config.ts can import it under strict mode
// without pulling in `allowJs` project-wide for one file.
export declare function handleAnalyzeFaceRequest(
  parsedBody: unknown,
  apiKey: string | undefined,
): Promise<{ status: number; body: Record<string, unknown> }>;
