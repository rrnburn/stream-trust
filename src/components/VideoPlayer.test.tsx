import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ init: vi.fn() }));
vi.mock('hls.js', () => ({ default: class {
  static isSupported() { mock.init(); return false; }
} }));
vi.mock('mpegts.js', () => ({ default: { isSupported: () => false } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: vi.fn().mockResolvedValue({}) } } }));
vi.mock('@/lib/platform', () => ({ isNativePlatform: () => true }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/nativePlayer', () => ({ playInVlc: vi.fn(), playInMxPlayer: vi.fn(), playInSystemChooser: vi.fn(), stopNative: vi.fn() }));
vi.mock('@/lib/castSender', () => ({ loadCastSDK: vi.fn(), startCasting: vi.fn(), isCasting: () => false, stopCasting: vi.fn() }));
import VideoPlayer from './VideoPlayer';

describe('playback session teardown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    mock.init.mockClear();
  });
  afterEach(() => { cleanup(); vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('stops the old element and prevents its native HLS timeout from reviving playback', () => {
    const { container, unmount } = render(<VideoPlayer src="http://provider.example/live/a.m3u8" />);
    const video = container.querySelector('video');
    if (!video) throw new Error('Missing media element');
    expect(video.getAttribute('src')).toContain('a.m3u8');
    unmount();
    expect(video.pause).toHaveBeenCalled();
    expect(video.getAttribute('src')).toBeNull();
    act(() => { video.dispatchEvent(new Event('canplay')); vi.advanceTimersByTime(10000); });
    expect(mock.init).not.toHaveBeenCalled();
    expect(video.play).not.toHaveBeenCalled();
  });

  it('cancels a pending prebuffer loop when switching channels', () => {
    const { container, rerender } = render(<VideoPlayer key="a" src="http://provider.example/live/a.m3u8" />);
    const old = container.querySelector('video');
    if (!old) throw new Error('Missing old media element');
    act(() => old.dispatchEvent(new Event('canplay')));
    rerender(<VideoPlayer key="b" src="http://provider.example/live/b.m3u8" />);
    Object.defineProperty(old, 'buffered', { value: { length: 1, end: () => 5 } });
    act(() => vi.advanceTimersByTime(1000));
    expect(old.getAttribute('src')).toBeNull();
    expect(old.play).not.toHaveBeenCalled();
    expect(container.querySelector('video')?.getAttribute('src')).toContain('b.m3u8');
  });

  it('saves the playhead before clearing the source', () => {
    const progress = vi.fn();
    const { container, unmount } = render(<VideoPlayer src="http://provider.example/movie/a.mp4" onProgress={progress} />);
    const video = container.querySelector('video');
    if (!video) throw new Error('Missing media element');
    Object.defineProperty(video, 'duration', { value: 200 });
    video.currentTime = 73;
    unmount();
    expect(progress).toHaveBeenCalledWith(73 / 200, 73, 200);
  });
});