jest.mock('expo-file-system', () => require('./__testutils__/mockFileSystem'));
jest.mock('expo-crypto', () => {
  const nodeCrypto = require('crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    digestStringAsync: async (_algo: string, data: string) => nodeCrypto.createHash('sha256').update(data).digest('hex'),
  };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const crypto = require('crypto');
import * as mockFs from './__testutils__/mockFileSystem';
import { __resetCatalogForTests, catalogDir, ACTIVE_FILE_NAME, PREVIOUS_FILE_NAME } from './catalogLoader';
import { checkManifest, downloadAndVerify, activateCatalog, rollbackCatalog, syncCatalog, CatalogSyncError } from './catalogSync';
import type { CatalogManifest } from './types';

const GOOD_CATALOG = [{ name: 'Test Mold', mfr: 'Test Mfr', speed: 9, glide: 5, turn: -1, fade: 2, stability: 1, type: 'Distance Driver' }];
const GOOD_CATALOG_TEXT = JSON.stringify(GOOD_CATALOG);
const GOOD_HASH = crypto.createHash('sha256').update(GOOD_CATALOG_TEXT).digest('hex');

function manifest(overrides: Partial<CatalogManifest> = {}): CatalogManifest {
  return {
    catalogVersion: 1,
    provider: 'Try Discs',
    datasetVersion: '2026-08-14',
    schemaVersion: 1,
    recordCount: GOOD_CATALOG.length,
    size: GOOD_CATALOG_TEXT.length,
    sha256: GOOD_HASH,
    asset: 'catalog-v1.json',
    ...overrides,
  };
}

function mockFetchSequence(responses: Array<{ ok: boolean; status?: number; json?: () => Promise<unknown>; text?: () => Promise<string> }>) {
  const fn = jest.fn();
  for (const r of responses) {
    fn.mockResolvedValueOnce({ ok: r.ok, status: r.status ?? 200, statusText: '', json: r.json ?? (async () => ({})), text: r.text ?? (async () => '') });
  }
  (globalThis as unknown as { fetch: typeof fetch }).fetch = fn as unknown as typeof fetch;
  return fn;
}

describe('catalogSync', () => {
  beforeEach(() => {
    mockFs.__reset();
    __resetCatalogForTests();
  });

  describe('checkManifest', () => {
    test('returns a valid manifest', async () => {
      mockFetchSequence([{ ok: true, json: async () => manifest() }]);
      const m = await checkManifest('https://example.test/manifest.json');
      expect(m.catalogVersion).toBe(1);
    });

    test('rejects a non-ok response', async () => {
      mockFetchSequence([{ ok: false, status: 500 }]);
      await expect(checkManifest('https://example.test/manifest.json')).rejects.toThrow(CatalogSyncError);
    });

    test('rejects a malformed manifest', async () => {
      mockFetchSequence([{ ok: true, json: async () => ({ nope: true }) }]);
      await expect(checkManifest('https://example.test/manifest.json')).rejects.toThrow(CatalogSyncError);
    });
  });

  describe('downloadAndVerify', () => {
    test('happy path: downloads, verifies hash + schema, writes a temp file', async () => {
      mockFetchSequence([{ ok: true, text: async () => GOOD_CATALOG_TEXT }]);
      const file = await downloadAndVerify(manifest(), 'https://example.test/manifest.json');
      expect(await file.text()).toBe(GOOD_CATALOG_TEXT);
    });

    test('rejects on hash mismatch and writes nothing usable', async () => {
      mockFetchSequence([{ ok: true, text: async () => GOOD_CATALOG_TEXT }]);
      await expect(downloadAndVerify(manifest({ sha256: 'deadbeef'.repeat(8) }), 'https://example.test/manifest.json')).rejects.toThrow(
        /hash mismatch/i
      );
    });

    test('rejects malformed JSON', async () => {
      const badText = '{not valid json';
      const badHash = crypto.createHash('sha256').update(badText).digest('hex');
      mockFetchSequence([{ ok: true, text: async () => badText }]);
      await expect(downloadAndVerify(manifest({ sha256: badHash }), 'https://example.test/manifest.json')).rejects.toThrow(
        /not valid json/i
      );
    });

    test('rejects schema-invalid content even if hash matches', async () => {
      const badArray = JSON.stringify([{ nope: true }]);
      const badHash = crypto.createHash('sha256').update(badArray).digest('hex');
      mockFetchSequence([{ ok: true, text: async () => badArray }]);
      await expect(downloadAndVerify(manifest({ sha256: badHash }), 'https://example.test/manifest.json')).rejects.toThrow(
        /schema validation/i
      );
    });
  });

  describe('activateCatalog / rollbackCatalog', () => {
    test('activates a downloaded temp file as the active catalog', async () => {
      mockFetchSequence([{ ok: true, text: async () => GOOD_CATALOG_TEXT }]);
      const tmp = await downloadAndVerify(manifest(), 'https://example.test/manifest.json');
      await activateCatalog(tmp);

      const activeUri = `${catalogDir().uri}/${ACTIVE_FILE_NAME}`;
      expect(mockFs.__getFile(activeUri)).toBe(GOOD_CATALOG_TEXT);
    });

    test('keeps the previous active catalog for rollback, and rollback restores it', async () => {
      const activeUri = `${catalogDir().uri}/${ACTIVE_FILE_NAME}`;
      const previousUri = `${catalogDir().uri}/${PREVIOUS_FILE_NAME}`;
      mockFs.__setFile(activeUri, 'ORIGINAL');

      mockFetchSequence([{ ok: true, text: async () => GOOD_CATALOG_TEXT }]);
      const tmp = await downloadAndVerify(manifest(), 'https://example.test/manifest.json');
      await activateCatalog(tmp);

      expect(mockFs.__getFile(activeUri)).toBe(GOOD_CATALOG_TEXT);
      expect(mockFs.__getFile(previousUri)).toBe('ORIGINAL');

      const rolledBack = await rollbackCatalog();
      expect(rolledBack).toBe(true);
      expect(mockFs.__getFile(activeUri)).toBe('ORIGINAL');
    });

    test('rollback returns false when there is nothing to roll back to', async () => {
      expect(await rollbackCatalog()).toBe(false);
    });
  });

  describe('syncCatalog (full pipeline)', () => {
    test('a hash-mismatched pipeline leaves any existing active catalog untouched', async () => {
      const activeUri = `${catalogDir().uri}/${ACTIVE_FILE_NAME}`;
      mockFs.__setFile(activeUri, 'ORIGINAL');

      mockFetchSequence([{ ok: true, json: async () => manifest({ sha256: 'deadbeef'.repeat(8) }) }, { ok: true, text: async () => GOOD_CATALOG_TEXT }]);

      await expect(syncCatalog('https://example.test/manifest.json')).rejects.toThrow(CatalogSyncError);
      expect(mockFs.__getFile(activeUri)).toBe('ORIGINAL');
    });

    test('happy path activates the new catalog end to end', async () => {
      mockFetchSequence([{ ok: true, json: async () => manifest() }, { ok: true, text: async () => GOOD_CATALOG_TEXT }]);
      const { manifest: m } = await syncCatalog('https://example.test/manifest.json');
      expect(m.catalogVersion).toBe(1);
      const activeUri = `${catalogDir().uri}/${ACTIVE_FILE_NAME}`;
      expect(mockFs.__getFile(activeUri)).toBe(GOOD_CATALOG_TEXT);
    });
  });
});
