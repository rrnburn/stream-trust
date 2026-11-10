import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { androidVersionCode, configureBuildGradle } from '../../scripts/android-build-config.js';

describe('Android test build configuration', () => {
  it('uses a positive local fallback', () => expect(androidVersionCode({})).toBe(1));
  it('increases versions for successive workflow runs', () => {
    expect(androidVersionCode({ GITHUB_RUN_NUMBER: '52' })).toBe(100052);
    expect(androidVersionCode({ GITHUB_RUN_NUMBER: '53' })).toBe(100053);
  });
  it('allows raising the offset if the workflow counter is reset', () => {
    expect(androidVersionCode({ GITHUB_RUN_NUMBER: '1', ANDROID_VERSION_CODE_OFFSET: '200000' })).toBe(200001);
  });
  it.each(['NaN', '0', '-1', '1.5', '2100000000'])('rejects invalid run number %s', (run) => {
    expect(() => androidVersionCode({ GITHUB_RUN_NUMBER: run })).toThrow();
  });
  it('does not duplicate signing configuration', () => {
    const once = configureBuildGradle('android { defaultConfig { versionCode 1 } }', {});
    expect(configureBuildGradle(once, {})).toBe(once);
  });
  it('configures the real Capacitor template repeatedly and emits a reliable download scan', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'android-config-'));
    try {
      mkdirSync(path.join(root, 'scripts'));
      for (const file of ['configure-android.js', 'android-build-config.js']) {
        writeFileSync(path.join(root, 'scripts', file), readFileSync(path.resolve('scripts', file)));
      }
      writeFileSync(path.join(root, 'package.json'), '{"type":"module"}');
      mkdirSync(path.join(root, 'android'));
      execFileSync('tar', ['-xzf', path.resolve('node_modules/@capacitor/cli/assets/android-template.tar.gz'), '-C', path.join(root, 'android')]);
      const script = path.join(root, 'scripts/configure-android.js');
      const env = { ...process.env, GITHUB_RUN_NUMBER: '53', ANDROID_VERSION_CODE_OFFSET: '100000' };
      execFileSync(process.execPath, [script], { env });
      const gradle = path.join(root, 'android/app/build.gradle');
      const once = readFileSync(gradle, 'utf8');
      execFileSync(process.execPath, [script], { env });
      expect(readFileSync(gradle, 'utf8')).toBe(once);
      expect(once).toContain('versionCode 100053');
      const plugin = readFileSync(path.join(root, 'android/app/src/main/java/com/getcapacitor/myapp/OsDownloadPlugin.java'), 'utf8');
      expect(plugin).toContain('!isVideo(f.getName())');
      expect(plugin).not.toContain('new java.io.File(path).exists()');
      expect(plugin).not.toContain('.matches(');
      for (const ext of ['mp4', 'mkv', 'avi', 'mov', 'ts', 'm4v', 'webm']) {
        expect(plugin).toContain(`n.endsWith(".${ext}")`);
      }
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
