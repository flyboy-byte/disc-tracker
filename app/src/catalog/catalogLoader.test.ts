jest.mock('expo-file-system', () => require('./__testutils__/mockFileSystem'));

import { masterDiscs } from '../utils/masterLibrary';
import * as mockFs from './__testutils__/mockFileSystem';
import {
  __resetCatalogForTests,
  catalogDir,
  activeFileName,
  metaFileName,
  getCatalog,
  getCatalogSource,
  getActiveCatalogMeta,
  getSlotMeta,
  isSlotCached,
  initCatalog,
  switchToSource,
  searchCatalog,
} from './catalogLoader';

const DOWNLOADED = [{ name: 'Test Mold', mfr: 'Test Mfr', speed: 9, glide: 5, turn: -1, fade: 2, stability: 1, type: 'Distance Driver' }];

describe('catalogLoader', () => {
  beforeEach(() => {
    mockFs.__reset();
    __resetCatalogForTests();
  });

  test('getCatalog() defaults to the bundled fallback, byte-identical to masterDiscs', () => {
    expect(getCatalog()).toBe(masterDiscs);
    expect(getCatalogSource()).toBe('bundled');
    expect(getActiveCatalogMeta()).toBeNull();
  });

  test('initCatalog() with no cached slot leaves the bundled fallback active (no regression)', async () => {
    await initCatalog();
    expect(getCatalog()).toBe(masterDiscs);
    expect(getCatalogSource()).toBe('bundled');
  });

  test('initCatalog() restores a previously-selected, cached trydiscs slot', async () => {
    mockFs.__setFile(`${catalogDir().uri}/${activeFileName('trydiscs')}`, JSON.stringify(DOWNLOADED));
    mockFs.__setFile(`${catalogDir().uri}/${metaFileName('trydiscs')}`, JSON.stringify({ recordCount: 1, label: 'Try Discs' }));
    mockFs.__setFile(`${catalogDir().uri}/source-pref.json`, JSON.stringify({ source: 'trydiscs' }));

    await initCatalog();
    expect(getCatalogSource()).toBe('trydiscs');
    expect(getCatalog()).toEqual(DOWNLOADED);
    expect(getActiveCatalogMeta()).toEqual({ recordCount: 1, label: 'Try Discs' });
  });

  test('initCatalog() falls back to bundled when the preferred slot is missing', async () => {
    mockFs.__setFile(`${catalogDir().uri}/source-pref.json`, JSON.stringify({ source: 'custom' }));

    await initCatalog();
    expect(getCatalogSource()).toBe('bundled');
    expect(getCatalog()).toBe(masterDiscs);
  });

  test('initCatalog() rejects malformed JSON and stays on the bundled fallback', async () => {
    mockFs.__setFile(`${catalogDir().uri}/${activeFileName('trydiscs')}`, '{not valid json');
    mockFs.__setFile(`${catalogDir().uri}/source-pref.json`, JSON.stringify({ source: 'trydiscs' }));

    await initCatalog();
    expect(getCatalogSource()).toBe('bundled');
    expect(getCatalog()).toBe(masterDiscs);
  });

  test('initCatalog() rejects a schema-invalid array and stays on the bundled fallback', async () => {
    mockFs.__setFile(`${catalogDir().uri}/${activeFileName('trydiscs')}`, JSON.stringify([{ name: 'Missing fields' }]));
    mockFs.__setFile(`${catalogDir().uri}/source-pref.json`, JSON.stringify({ source: 'trydiscs' }));

    await initCatalog();
    expect(getCatalogSource()).toBe('bundled');
    expect(getCatalog()).toBe(masterDiscs);
  });

  test('isSlotCached() / getSlotMeta() reflect a cached slot', async () => {
    expect(await isSlotCached('custom')).toBe(false);
    expect(await getSlotMeta('custom')).toBeNull();

    mockFs.__setFile(`${catalogDir().uri}/${activeFileName('custom')}`, JSON.stringify(DOWNLOADED));
    mockFs.__setFile(`${catalogDir().uri}/${metaFileName('custom')}`, JSON.stringify({ recordCount: 1, label: 'my-catalog.json' }));

    expect(await isSlotCached('custom')).toBe(true);
    expect(await getSlotMeta('custom')).toEqual({ recordCount: 1, label: 'my-catalog.json' });
  });

  test('switchToSource() activates a cached slot without needing a re-download', async () => {
    mockFs.__setFile(`${catalogDir().uri}/${activeFileName('trydiscs')}`, JSON.stringify(DOWNLOADED));
    mockFs.__setFile(`${catalogDir().uri}/${metaFileName('trydiscs')}`, JSON.stringify({ recordCount: 1, label: 'Try Discs' }));

    expect(await switchToSource('trydiscs')).toBe(true);
    expect(getCatalogSource()).toBe('trydiscs');
    expect(getCatalog()).toEqual(DOWNLOADED);

    expect(await switchToSource('bundled')).toBe(true);
    expect(getCatalogSource()).toBe('bundled');
    expect(getCatalog()).toBe(masterDiscs);

    // Switching back doesn't need the file to be re-downloaded — it's still cached.
    expect(await switchToSource('trydiscs')).toBe(true);
    expect(getCatalogSource()).toBe('trydiscs');
  });

  test('switchToSource() returns false for an uncached slot and leaves the active catalog unchanged', async () => {
    expect(await switchToSource('custom')).toBe(false);
    expect(getCatalogSource()).toBe('bundled');
  });

  test('searchCatalog() searches whatever catalog is currently active', () => {
    const hits = searchCatalog('destroyer');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((d) => d.name.toLowerCase().includes('destroyer'))).toBe(true);
  });
});
