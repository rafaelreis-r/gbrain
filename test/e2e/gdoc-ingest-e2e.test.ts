/**
 * E2E test for gdoc-ingest. Exercises the full pipeline against the real
 * GAS Workspace Bridge using a known document.
 *
 * This test is GUARDED — it skips itself unless the env opts in:
 *
 *     OPSOS_GDOC_E2E=1 bun test test/e2e/gdoc-ingest-e2e.test.ts
 *
 * Why guarded: hitting the live Google Apps Script bridge requires valid
 * OAuth credentials at ~/.clasprc.json and is rate-limited. Default test
 * runs (CI, local quick sweep) skip it. The real protection against
 * regressions is the unit suite (test/gdoc-ingest.test.ts), which covers
 * every branch of the pure logic.
 *
 * The reference document is the Metas QD2 Gemini transcript captured on
 * 2026-05-06 (smoke-test fixture). If the document is deleted, swap with
 * any owned doc and update the assertions.
 */

import { describe, it, expect } from 'bun:test';
import { ingest, parseDriveUrl } from '../../skills/gdoc-ingest/scripts/gdoc-ingest.mjs';

const ENABLED = process.env.OPSOS_GDOC_E2E === '1';
const FIXTURE_URL =
  'https://docs.google.com/document/d/1Pb1AxiBcNg5bcHEa7XaHgzDQLmMu0eRlfweM0xLZ0XA/edit';
const FIXTURE_ID = '1Pb1AxiBcNg5bcHEa7XaHgzDQLmMu0eRlfweM0xLZ0XA';

const maybe = ENABLED ? describe : describe.skip;

maybe('gdoc-ingest E2E (live GAS)', () => {
  it('pipeline: parse → fetch → render (no commit)', async () => {
    const parsed = parseDriveUrl(FIXTURE_URL);
    expect(parsed?.kind).toBe('doc');
    expect(parsed?.fileId).toBe(FIXTURE_ID);

    const result = await ingest({ url: FIXTURE_URL, indexedVia: 'manual-cli', commit: false });

    expect(result.fileId).toBe(FIXTURE_ID);
    expect(result.kind).toBe('doc');
    expect(result.title).toContain('Metas QD2');
    expect(result.charCount).toBeGreaterThan(100);
    expect(result.slug).toMatch(/^docs\/inbox\//);
    expect(result.proposedFinalSlug).toMatch(/^docs\/[a-z]+\/[a-z-]+\/[a-z0-9-]+$/);
    expect(result.page).toContain('type: document');
    expect(result.page).toContain(`[Source: GDoc ${FIXTURE_ID}, fetched`);
    // committed flag must NOT be set when commit=false
    expect((result as { committed?: boolean }).committed).toBeUndefined();
  }, 60_000);

  it('rejects non-Drive URLs cleanly', async () => {
    await expect(
      ingest({ url: 'https://example.com/not-drive', indexedVia: 'manual-cli', commit: false }),
    ).rejects.toThrow(/URL inválida/);
  });
});
