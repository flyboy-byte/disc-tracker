// Expo config plugin — turns on R8 minification + resource shrinking for release builds.
//
// Why a plugin: `npx expo prebuild -p android --clean` regenerates android/gradle.properties from
// the template (both flags off), so setting them by hand in android/ never reached F-Droid's build
// (same reason as withAllowBackupDisabled). The flags are only read inside the `release` buildType
// block of android/app/build.gradle, so debug builds are unaffected. Requested by F-Droid review
// on MR !52998 (2026-10-19).
const { withGradleProperties } = require('expo/config-plugins');

const FLAGS = {
  'android.enableMinifyInReleaseBuilds': 'true',
  'android.enableShrinkResourcesInReleaseBuilds': 'true',
};

module.exports = function withR8Release(config) {
  return withGradleProperties(config, (config) => {
    for (const [key, value] of Object.entries(FLAGS)) {
      config.modResults = config.modResults.filter((p) => !(p.type === 'property' && p.key === key));
      config.modResults.push({ type: 'property', key, value });
    }
    return config;
  });
};
