#!/usr/bin/env node

/**
 * Configuration script for Android memory optimization
 * Run this after: npx cap add android
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { configureBuildGradle } from './android-build-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ANDROID_DIR = path.join(__dirname, '..', 'android');

if (!fs.existsSync(ANDROID_DIR)) {
  console.error('❌ Android directory not found. Run: npx cap add android');
  process.exit(1);
}

console.log('🔧 Configuring Android for memory optimization...\n');

// 1. Update AndroidManifest.xml: largeHeap + Android TV / Google TV support
const manifestPath = path.join(ANDROID_DIR, 'app', 'src', 'main', 'AndroidManifest.xml');
if (fs.existsSync(manifestPath)) {
  let manifest = fs.readFileSync(manifestPath, 'utf8');

  // largeHeap
  if (!manifest.includes('android:largeHeap')) {
    console.log('✓ Adding largeHeap to AndroidManifest.xml');
    manifest = manifest.replace(/<application([^>]*)>/, '<application$1\n        android:largeHeap="true">');
  }

  if (!manifest.includes('android:usesCleartextTraffic')) {
    manifest = manifest.replace(/<application([^>]*)>/, '<application$1\n        android:usesCleartextTraffic="true">');
  }

  // TV banner (referenced from /res/drawable/tv_banner.png — copied below)
  if (!manifest.includes('android:banner')) {
    console.log('✓ Adding android:banner for TV launcher');
    manifest = manifest.replace(
      /<application([^>]*)>/,
      '<application$1\n        android:banner="@drawable/tv_banner">',
    );
  }

  // Declare touchscreen as not required so the app is installable on Android TV
  if (!manifest.includes('android.hardware.touchscreen')) {
    console.log('✓ Marking touchscreen + telephony as not required (TV-compatible)');
    const featureBlock = `
    <uses-feature android:name="android.hardware.touchscreen" android:required="false" />
    <uses-feature android:name="android.hardware.faketouch" android:required="false" />
    <uses-feature android:name="android.hardware.telephony" android:required="false" />
    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.microphone" android:required="false" />
    <uses-feature android:name="android.software.leanback" android:required="false" />
`;
    manifest = manifest.replace(/<application/, `${featureBlock}    <application`);
  }

  // Add LEANBACK_LAUNCHER intent filter so the app appears on the Android TV / Google TV home screen.
  if (!manifest.includes('android.intent.category.LEANBACK_LAUNCHER')) {
    console.log('✓ Adding LEANBACK_LAUNCHER intent filter to MainActivity');
    manifest = manifest.replace(
      /(<action android:name="android\.intent\.action\.MAIN"\s*\/>\s*<category android:name="android\.intent\.category\.LAUNCHER"\s*\/>)/,
      `$1\n                <category android:name="android.intent.category.LEANBACK_LAUNCHER" />`,
    );
  }

  fs.writeFileSync(manifestPath, manifest, 'utf8');
}

// 1b. Copy TV launcher banner into the Android drawable resources.
const bannerSrc = path.join(__dirname, '..', 'public', 'android', 'tv-banner.png');
const drawableDir = path.join(ANDROID_DIR, 'app', 'src', 'main', 'res', 'drawable');
if (fs.existsSync(bannerSrc) && fs.existsSync(drawableDir)) {
  const bannerDest = path.join(drawableDir, 'tv_banner.png');
  fs.copyFileSync(bannerSrc, bannerDest);
  console.log('✓ Copied TV banner → res/drawable/tv_banner.png');
}

// 2. Update gradle.properties
const gradlePropsPath = path.join(ANDROID_DIR, 'gradle.properties');
if (fs.existsSync(gradlePropsPath)) {
  let gradleProps = fs.readFileSync(gradlePropsPath, 'utf8');
  if (!gradleProps.includes('org.gradle.jvmargs=-Xmx4096m')) {
    console.log('✓ Updating gradle.properties');
    gradleProps += `
# Memory optimization
org.gradle.jvmargs=-Xmx4096m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8
org.gradle.daemon=true
org.gradle.caching=true
android.enableJetifier=true
android.useAndroidX=true
`;
    fs.writeFileSync(gradlePropsPath, gradleProps, 'utf8');
  }
}

// 3. Update variables.gradle
const variablesGradlePath = path.join(ANDROID_DIR, 'variables.gradle');
if (fs.existsSync(variablesGradlePath)) {
  console.log('✓ Updating variables.gradle');
  let variables = fs.readFileSync(variablesGradlePath, 'utf8');
  variables = variables.replace(/minSdkVersion = \d+/, 'minSdkVersion = 24');
  fs.writeFileSync(variablesGradlePath, variables, 'utf8');
}

// 4. Update app/build.gradle
const buildGradlePath = path.join(ANDROID_DIR, 'app', 'build.gradle');
if (fs.existsSync(buildGradlePath)) {
  console.log('✓ Updating app/build.gradle');
  let buildGradle = configureBuildGradle(fs.readFileSync(buildGradlePath, 'utf8'));
  
  // Add multiDexEnabled
  if (!buildGradle.includes('multiDexEnabled')) {
    buildGradle = buildGradle.replace(
      /defaultConfig\s*{/,
      `defaultConfig {\n        multiDexEnabled true`
    );
  }
  
  // Add dexOptions
  if (!buildGradle.includes('dexOptions')) {
    buildGradle = buildGradle.replace(
      /android\s*{/,
      `android {\n    dexOptions {\n        javaMaxHeapSize "4g"\n    }\n`
    );
  }
  
  // Add multidex dependency
  if (!buildGradle.includes('androidx.multidex:multidex')) {
    buildGradle = buildGradle.replace(
      /dependencies\s*{/,
      `dependencies {\n    implementation 'androidx.multidex:multidex:2.0.1'`
    );
  }
  
  fs.writeFileSync(buildGradlePath, buildGradle, 'utf8');
}

// 5. Inject native OS DownloadManager plugin (hands downloads to Android)
const javaRoot = path.join(ANDROID_DIR, 'app', 'src', 'main', 'java');
const findMain = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { const r = findMain(p); if (r) return r; }
    else if (e.name === 'MainActivity.java') return p;
  }
  return null;
};
const mainPath = fs.existsSync(javaRoot) ? findMain(javaRoot) : null;
if (mainPath) {
  const pkg = (fs.readFileSync(mainPath, 'utf8').match(/package\s+([\w.]+);/) || [])[1];
  const pluginSrc = `package ${pkg};

import android.app.DownloadManager;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.os.Environment;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "OsDownload")
public class OsDownloadPlugin extends Plugin {
  private DownloadManager dm() { return (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE); }
  private boolean isVideo(String name) {
    String n = name.toLowerCase(java.util.Locale.ROOT);
    return n.endsWith(".mp4") || n.endsWith(".mkv") || n.endsWith(".avi") || n.endsWith(".mov") || n.endsWith(".ts") || n.endsWith(".m4v") || n.endsWith(".webm");
  }

  @PluginMethod
  public void enqueue(PluginCall call) {
    try {
      DownloadManager.Request r = new DownloadManager.Request(Uri.parse(call.getString("url")));
      r.setTitle(call.getString("title", "Download"));
      r.addRequestHeader("User-Agent", call.getString("userAgent", "Mozilla/5.0"));
      r.addRequestHeader("Accept", "*/*");
      r.addRequestHeader("Accept-Encoding", "identity");
      r.addRequestHeader("Connection", "keep-alive");
      r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
      r.setAllowedNetworkTypes(DownloadManager.Request.NETWORK_WIFI | DownloadManager.Request.NETWORK_MOBILE);
      r.setAllowedOverMetered(true);
      r.setAllowedOverRoaming(true);
      // App-specific external dir: playable in-app via the local file bridge (scoped storage safe).
      r.setDestinationInExternalFilesDir(getContext(), Environment.DIRECTORY_MOVIES, call.getString("fileName", "video.mp4"));
      long id = dm().enqueue(r);
      JSObject o = new JSObject(); o.put("id", String.valueOf(id)); call.resolve(o);
    } catch (Exception e) { call.reject(e.getMessage()); }
  }

  @PluginMethod
  public void query(PluginCall call) {
    long id = Long.parseLong(call.getString("id", "0"));
    Cursor c = dm().query(new DownloadManager.Query().setFilterById(id));
    JSObject o = new JSObject();
    if (c != null && c.moveToFirst()) {
      int st = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
      o.put("status", st == DownloadManager.STATUS_SUCCESSFUL ? "done" : st == DownloadManager.STATUS_FAILED ? "failed" : st == DownloadManager.STATUS_PAUSED ? "paused" : "running");
      o.put("loaded", c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)));
      o.put("total", c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)));
      o.put("reason", c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON)));
      String local = c.getString(c.getColumnIndexOrThrow(DownloadManager.COLUMN_LOCAL_URI));
      o.put("localUri", local == null ? "" : local);
      Uri u = dm().getUriForDownloadedFile(id);
      o.put("uri", u == null ? "" : u.toString());
      c.close();
    } else { o.put("status", "missing"); if (c != null) c.close(); }
    call.resolve(o);
  }

  @PluginMethod
  public void remove(PluginCall call) {
    try { dm().remove(Long.parseLong(call.getString("id", "0"))); } catch (Exception ignored) {}
    call.resolve();
  }

  // Lists video files already on the device from this or older app versions.
  @PluginMethod
  public void scan(PluginCall call) {
    com.getcapacitor.JSArray arr = new com.getcapacitor.JSArray();
    java.util.List<java.io.File> dirs = new java.util.ArrayList<>();
    java.io.File mv = getContext().getExternalFilesDir(Environment.DIRECTORY_MOVIES);
    if (mv != null) dirs.add(mv);
    dirs.add(new java.io.File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "StreaminStuff"));
    dirs.add(new java.io.File(getContext().getFilesDir(), "downloads"));
    for (java.io.File d : dirs) {
      java.io.File[] fs;
      try { fs = d.listFiles(); } catch (Exception e) { fs = null; }
      if (fs == null) continue;
      for (java.io.File f : fs) {
        if (!f.isFile() || f.length() == 0 || !isVideo(f.getName())) continue;
        JSObject o = new JSObject();
        o.put("name", f.getName()); o.put("path", f.getAbsolutePath()); o.put("size", f.length());
        arr.put(o);
      }
    }
    // Also ask Android's download history, which works despite scoped-storage limits.
    try {
      Cursor c = dm().query(new DownloadManager.Query().setFilterByStatus(DownloadManager.STATUS_SUCCESSFUL));
      if (c != null) {
        while (c.moveToNext()) {
          String local = c.getString(c.getColumnIndexOrThrow(DownloadManager.COLUMN_LOCAL_URI));
          long size = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
          if (local == null || size <= 0) continue;
          String path = Uri.parse(local).getPath();
          if (path == null) continue;
          String name = path.substring(path.lastIndexOf('/') + 1);
          if (!isVideo(name)) continue;
          // Scoped storage may deny File.exists even for our completed downloads.
          // Verify access through DownloadManager instead of rejecting public paths.
          long downloadId = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_ID));
          try (android.os.ParcelFileDescriptor fd = dm().openDownloadedFile(downloadId)) {
            if (fd == null) continue;
          } catch (Exception inaccessible) { continue; }
          JSObject o = new JSObject();
          o.put("name", name); o.put("path", path); o.put("size", size);
          arr.put(o);
        }
        c.close();
      }
    } catch (Exception ignored) {}
    JSObject r = new JSObject(); r.put("files", arr); call.resolve(r);
  }
}
`;
  fs.writeFileSync(path.join(path.dirname(mainPath), 'OsDownloadPlugin.java'), pluginSrc, 'utf8');
  let main = fs.readFileSync(mainPath, 'utf8');
  if (!main.includes('OsDownloadPlugin')) {
    if (/onCreate\s*\(/.test(main)) {
      main = main.replace(/(onCreate\s*\([^)]*\)\s*\{)/, '$1\n        registerPlugin(OsDownloadPlugin.class);');
    } else {
      main = main.replace(/(class MainActivity extends BridgeActivity\s*\{)/,
        '$1\n    @Override\n    public void onCreate(android.os.Bundle savedInstanceState) {\n        registerPlugin(OsDownloadPlugin.class);\n        super.onCreate(savedInstanceState);\n    }\n');
    }
    fs.writeFileSync(mainPath, main, 'utf8');
  }
  console.log('✓ Injected OsDownload (Android DownloadManager) plugin');
}

console.log('\n✅ Android configuration complete!');
console.log('\nNext steps:');
console.log('  1. npx cap sync android');
console.log('  2. npx cap open android');
console.log('  3. Build → Clean Project');
console.log('  4. Build → Rebuild Project');
