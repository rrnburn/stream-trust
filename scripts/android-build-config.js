/** Configure only test builds; production signing stays separate. */
export function androidVersionCode(env = process.env) {
  if (!env.GITHUB_RUN_NUMBER) return 1;
  const run = Number(env.GITHUB_RUN_NUMBER);
  const offset = Number(env.ANDROID_VERSION_CODE_OFFSET || '100000');
  const version = offset + run;
  if (!/^\d+$/.test(env.GITHUB_RUN_NUMBER) || !Number.isSafeInteger(run) || run < 1 ||
      !Number.isSafeInteger(offset) || offset < 0 || version > 2100000000) {
    throw new Error('Invalid Android version code; use a positive run number and a safe version offset.');
  }
  return version;
}

export function configureBuildGradle(source, env = process.env) {
  const version = androidVersionCode(env);
  if (!/versionCode\s+\d+/.test(source)) throw new Error('Android template is missing versionCode.');
  let output = source.replace(/versionCode\s+\d+/, `versionCode ${version}`);
  const marker = '// StreaminStuff stable test signing';
  if (!output.includes(marker)) {
    output += `
${marker}
def testKeystore = System.getenv('ANDROID_DEBUG_KEYSTORE_PATH')
if (testKeystore) {
    def keyFile = new File(testKeystore)
    if (!keyFile.isFile()) { throw new GradleException('Test signing keystore is missing') }
    android.signingConfigs.debug.storeFile = keyFile
    android.signingConfigs.debug.storePassword = 'android'
    android.signingConfigs.debug.keyAlias = 'androiddebugkey'
    android.signingConfigs.debug.keyPassword = 'android'
}
`;
  }
  return output;
}