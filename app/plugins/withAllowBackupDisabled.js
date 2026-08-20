// Expo config plugin — sets android:allowBackup="false" on the merged AndroidManifest.
//
// Why this exists as a plugin instead of hand-editing android/app/src/main/AndroidManifest.xml:
// `npx expo prebuild -p android --clean` regenerates that file from scratch every time it runs —
// confirmed by running it locally (2026-08-20) and watching a hand-edited allowBackup="false" get
// silently reverted back to the Expo/RN default of "true". F-Droid's own build recipe always runs
// prebuild --clean (non-negotiable per the reviewer, see app/plan/docs/fdroid-reference.md), so a
// native-XML-only fix would hold for local/sideload builds but silently disappear on the actual
// F-Droid build. This plugin runs as part of prebuild itself, so it survives every regeneration.
//
// See app/plan/docs/fdroid-privacy-audit-2026-08-20.md for why this was disabled (matches the
// app's "nothing leaves this device unless you explicitly do it" privacy claim literally, not
// just in spirit — Android's OS-level Auto Backup was the one path that wasn't strictly true).
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withAllowBackupDisabled(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (application) {
      application.$['android:allowBackup'] = 'false';
    }
    return config;
  });
};
