jest.mock('expo-file-system', () => require('./__testutils__/mockFileSystem'));

import { masterDiscs } from '../utils/masterLibrary';
import * as mockFs from './__testutils__/mockFileSystem';
import {
  __resetCatalogForTests,
  catalogDir,
  ACTIVE_FILE_NAME,
  getCatalog,
  getCatalogSource,
  initCatalog,
  searchCatalog,
} from './catalogLoader';

describe('catalogLoader', () => {
  beforeEach(() => {
    mockFs.__reset();
    __resetCatalogForTests();
  });

  test('getCatalog() defaults to the bundled fallback, byte-identical to masterDiscs', () => {
    expect(getCatalog()).toBe(masterDiscs);
    expect(getCatalogSource()).toBe('bundled');
  });

  test('initCatalog() with no downloaded file leaves the bundled fallback active (no regression)', async () => {
    await initCatalog();
    expect(getCatalog()).toBe(masterDiscs);
    expect(getCatalogSource()).toBe('bundled');
  });

  test('initCatalog() swaps in a valid downloaded catalog', async () => {
    const downloaded = [{ name: 'Test Mold', mfr: 'Test Mfr', speed: 9, glide: 5, turn: -1, fade: 2, stability: 1, type: 'Distance Driver' }];
    mockFs.__setFile(`${catalogDir().uri}/${ACTIVE_FILE_NAME}`, JSON.stringify(downloaded));

    await initCatalog();
    expect(getCatalogSource()).toBe('downloaded');
    expect(getCatalog()).toEqual(downloaded);
  });

  test('initCatalog() rejects malformed JSON and stays on the bundled fallback', async () => {
    mockFs.__setFile(`${catalogDir().uri}/${ACTIVE_FILE_NAME}`, '{not valid json');

    await initCatalog();
    expect(getCatalogSource()).toBe('bundled');
    expect(getCatalog()).toBe(masterDiscs);
  });

  test('initCatalog() rejects a schema-invalid array and stays on the bundled fallback', async () => {
    mockFs.__setFile(`${catalogDir().uri}/${ACTIVE_FILE_NAME}`, JSON.stringify([{ name: 'Missing fields' }]));

    await initCatalog();
    expect(getCatalogSource()).toBe('bundled');
    expect(getCatalog()).toBe(masterDiscs);
  });

  test('searchCatalog() searches whatever catalog is currently active', () => {
    const hits = searchCatalog('destroyer');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((d) => d.name.toLowerCase().includes('destroyer'))).toBe(true);
  });
});
