#!/usr/bin/env node

/**
 * Configuration script for Android memory optimization
 * Run this after: npx cap add android
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ANDROID_DIR = path.join(__dirname, '..', 'android');

if (!fs.existsSync(ANDROID_DIR)) {
  console.error('❌ Android directory not found. Run: npx cap add android');
  process.exit(1);
}

console.log('🔧 Configuring Android for memory optimization...\n');

// 1. Update AndroidManifest.xml to add largeHeap
const manifestPath = path.join(ANDROID_DIR, 'app', 'src', 'main', 'AndroidManifest.xml');
if (fs.existsSync(manifestPath)) {
  let manifest = fs.readFileSync(manifestPath, 'utf8');
  if (!manifest.includes('android:largeHeap')) {
    console.log('✓ Adding largeHeap to AndroidManifest.xml');
    manifest = manifest.replace(/<application([^>]*)>/, '<application$1\n        android:largeHeap="true">');
    fs.writeFileSync(manifestPath, manifest, 'utf8');
  }
}

// 2. Update gradle.properties
const gradlePropsPath = path.join(ANDROID_DIR, 'gradle.properties');
if (fs.existsSync(gradlePropsPath)) {
  let gradleProps = fs.readFileSync(gradlePropsPath, 'utf8');
  if (!gradleProps.includes('org.gradle.jvmargs=-Xmx4096m')) {
    console.log('✓ Updating gradle.properties');
    gradleProps += `
# Memory optimization
org.gradle.jvmargs=-Xmx4096m -XX:MaxPermSize=512m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8
org.gradle.daemon=true
org.gradle.configureondemand=true
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
  let buildGradle = fs.readFileSync(buildGradlePath, 'utf8');
  
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

console.log('\n✅ Android configuration complete!');
console.log('\nNext steps:');
console.log('  1. npx cap sync android');
console.log('  2. npx cap open android');
console.log('  3. Build → Clean Project');
console.log('  4. Build → Rebuild Project');
