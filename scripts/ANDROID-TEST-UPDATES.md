# Stable test APK updates

The workflow supports a persistent **test-only** key supplied through the GitHub Actions secret `ANDROID_DEBUG_KEYSTORE_BASE64`. No private key is committed. Without this secret, the existing build continues with Android's temporary debug key and displays a warning; updates may still require reinstalling.

## One-time setup

Generate the key on your own computer with Java installed, in a private folder outside the repository:

```sh
keytool -genkeypair -keystore streaminstuff-debug.keystore -storetype JKS -alias androiddebugkey -storepass android -keypass android -keyalg RSA -keysize 2048 -sigalg SHA256withRSA -validity 10000 -dname "CN=Android Debug,O=Android,C=US"
```

Encode this file as Base64 using a local tool and paste the result directly into the GitHub repository's **Settings → Secrets and variables → Actions → New repository secret**, named `ANDROID_DEBUG_KEYSTORE_BASE64`. Do not paste the key into chat, commit it, or add it as a public repository variable. Keep a private backup and restrict repository/Actions access. The standard password is for test keys only; it is not protection for a production key.

The workflow decodes the key into its temporary runner folder and verifies its alias before building. Every subsequent build must reuse this exact key. An older installed APK with a different certificate cannot be updated by this key: one final uninstall may be needed, and Android can delete app-owned data/downloads during uninstall. Back up what you need first. Keeping the existing old key, if still available, avoids that transition.

## Version ordering

CI uses `100000 + GITHUB_RUN_NUMBER` by default. A rerun of the same run retains the same version. Set the Actions variable `ANDROID_VERSION_CODE_OFFSET` higher before recreating/renaming the workflow or when switching from a previously higher version code. The resulting value must exceed the installed version and not exceed 2,100,000,000. Local builds retain version code 1 and do not promise to update a CI APK.

## Phone validation

Install one consistently signed APK, download a video, then install the next build without uninstalling. Confirm sources, watch progress, and downloads remain. Also switch live channels rapidly, wait at least ten seconds, and confirm only the selected channel is audible. Old public download discovery still depends on Android retaining the file and allowing this app to open it.

For Google Play, use a separate protected upload key and Play App Signing. These debug APKs are not Play Store release artifacts. No in-app updater is introduced.

After updating your local project from the connected repository, run `npx cap sync android`. See [Lovable's native mobile guide](https://lovable.dev/blog/capacitor) for the device workflow.