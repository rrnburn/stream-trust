import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  transfer: vi.fn(),
  legacy: vi.fn(),
  request: vi.fn(),
  stat: vi.fn(),
  remove: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@capacitor/core', () => ({ CapacitorHttp: { request: mocks.request } }));
vi.mock('@capacitor/file-transfer', () => ({
  FileTransfer: {
    downloadFile: mocks.transfer,
    addListener: vi.fn(async () => ({ remove: mocks.remove })),
  },
}));
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Data: 'DATA' },
  Encoding: {},
  Filesystem: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockResolvedValue({ files: [] }),
    deleteFile: vi.fn().mockResolvedValue(undefined),
    getUri: vi.fn(async ({ path }) => ({ uri: `file:///device/${path}` })),
    stat: mocks.stat,
    downloadFile: mocks.legacy,
    addListener: vi.fn(async () => ({ remove: mocks.remove })),
  },
}));
vi.mock('@/lib/platform', () => ({ isNativePlatform: () => true }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { downloadStream, isDownloading } from './downloads';

const url = 'http://provider.example/movie/user/password/123.mkv';

describe('native download retries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transfer.mockReset().mockResolvedValue(undefined);
    mocks.legacy.mockReset().mockResolvedValue(undefined);
    mocks.stat.mockReset().mockResolvedValue({ size: 1024 });
  });

  it('downloads the original URL without consuming a redirect token in a probe', async () => {
    const result = await downloadStream('movie-1', 'Movie', url);
    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.transfer).toHaveBeenCalledWith(expect.objectContaining({ url }));
    expect(result.size).toBe(1024);
    expect(mocks.legacy).not.toHaveBeenCalled();
  });

  it('tries the legacy engine after a generic OS-PLUG-FLTR-0011 failure', async () => {
    mocks.transfer.mockRejectedValue({ code: 'OS-PLUG-FLTR-0011', message: 'Error during file transfer' });
    await downloadStream('movie-2', 'Movie', url);
    expect(mocks.legacy).toHaveBeenCalledTimes(1);
    expect(mocks.legacy).toHaveBeenCalledWith(expect.objectContaining({ url }));
  });

  it('tries both engines but no external DNS requests when hostname resolution fails', async () => {
    mocks.transfer.mockRejectedValue(new Error('Unable to resolve host provider.example'));
    mocks.legacy.mockRejectedValue(new Error('UnknownHostException'));
    await expect(downloadStream('movie-3', 'Movie', url)).rejects.toThrow("Your device couldn't find the download server");
    expect(mocks.transfer).toHaveBeenCalledTimes(1);
    expect(mocks.legacy).toHaveBeenCalledTimes(1);
    expect(mocks.request).not.toHaveBeenCalled();
    expect(isDownloading('movie-3')).toBe(false);
  });

  it('never marks empty files as completed', async () => {
    mocks.stat.mockResolvedValue({ size: 0 });
    await expect(downloadStream('movie-4', 'Movie', url)).rejects.toThrow('Downloaded file is empty');
    expect(isDownloading('movie-4')).toBe(false);
  });
});