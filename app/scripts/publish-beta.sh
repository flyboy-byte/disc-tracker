#!/usr/bin/env bash
# Build a beta from origin/dev and, with --publish, post it as a GitHub pre-release.
# Rules and reasons: app/plan/docs/disc-scanner-scope.md, "Test builds".
#
#   app/scripts/publish-beta.sh <version> <N>             build and sign only
#   app/scripts/publish-beta.sh <version> <N> --publish   also create the pre-release
#   e.g. app/scripts/publish-beta.sh 0.29.0 1 --publish   -> v0.29.0-beta.1
#
# The beta version is set only in a throwaway clone. The committed version must still be the
# official one, or F-Droid would treat the beta tag as a new release; this script refuses then.
#
# Environment (optional): BETA_WORK (build folder), SIGNING_PROPS (file with RELEASE_STORE_FILE,
# RELEASE_KEY_ALIAS, RELEASE_STORE_PASSWORD, RELEASE_KEY_PASSWORD). Values are never printed.
set -euo pipefail

die() { echo "publish-beta: $*" >&2; exit 1; }
[ $# -ge 2 ] || { sed -n '2,13p' "$0"; exit 1; }
VERSION=$1 N=$2 PUBLISH=${3:-}
[[ $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "version must look like 0.29.0"
[[ $N =~ ^[1-9][0-9]*$ ]] || die "N must be 1 or more"
[ -z "$PUBLISH" ] || [ "$PUBLISH" = --publish ] || die "unknown option: $PUBLISH"

APP_ID=com.disctracker.app
CERT=ff739cf565d8fe3af4ff97e641f6336fa69ebcf3eec222a7a7c5ab9f8e3d837a
RECIPE=https://gitlab.com/fdroid/fdroiddata/-/raw/master/metadata/$APP_ID.yml
REPO=$(git -C "$(dirname "$0")" remote get-url origin)
WORK=${BETA_WORK:-$HOME/.cache/disc-tracker-beta}
PROPS=${SIGNING_PROPS:-$HOME/projects/drag-tree/android/local.properties}
SDK=${ANDROID_HOME:-$HOME/Android/Sdk}
BT=$SDK/build-tools/36.0.0
export JAVA_HOME=${JAVA_HOME_21:-/usr/lib/jvm/java-21-openjdk}
TAG=v$VERSION-beta.$N

[ -x "$BT/apksigner" ] || die "apksigner not found in $BT"
[ -f "$PROPS" ] || die "signing properties file not found"

# --- guards ---------------------------------------------------------------------------------
recipe=$(curl -sfL "$RECIPE") || die "cannot read the F-Droid recipe"
cur_name=$(sed -n 's/^CurrentVersion: *//p' <<<"$recipe")
cur_code=$(sed -n 's/^CurrentVersionCode: *//p' <<<"$recipe")
[[ -n $cur_name && $cur_code =~ ^[0-9]+$ ]] || die "cannot read the current version from the recipe"
base=$((cur_code / 10))
code=$((base * 10 + 2 + N))
max=$((base * 10 + 10))
[ "$code" -le "$max" ] || code=$max   # codes run out below the next official one; reuse the last

[ "$(printf '%s\n%s\n' "$cur_name" "$VERSION" | sort -V | tail -1)" = "$VERSION" ] && [ "$VERSION" != "$cur_name" ] \
  || die "$VERSION is not newer than the official $cur_name"
[ -z "$(git ls-remote --tags "$REPO" "refs/tags/$TAG")" ] || die "tag $TAG already exists"

rm -rf "$WORK/src"; mkdir -p "$WORK/out"
git clone -q --depth 1 --branch dev "$REPO" "$WORK/src"
SHA=$(git -C "$WORK/src" rev-parse HEAD)
cd "$WORK/src/app"

c_app=$(node -p 'require("./app.json").expo.version')
c_pkg=$(node -p 'require("./package.json").version')
c_name=$(sed -n 's/^ *versionName "\(.*\)"/\1/p' android/app/build.gradle)
c_code=$(sed -n 's/^ *versionCode \([0-9]*\)$/\1/p' android/app/build.gradle)
[ "$c_app" = "$cur_name" ] && [ "$c_pkg" = "$cur_name" ] && [ "$c_name" = "$cur_name" ] && [ "$c_code" = "$base" ] \
  || die "committed version is $c_app/$c_pkg/$c_name code $c_code; it must stay $cur_name code $base"

echo "== $TAG from dev ${SHA:0:7}, versionCode $code (official $cur_name is $cur_code)"

# --- build ----------------------------------------------------------------------------------
npx --yes npm@10.9.2 ci --no-audit --no-fund
node -e 'const f="app.json",j=require("./"+f);j.expo.version=process.argv[1];require("fs").writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$VERSION-beta.$N"
npx expo prebuild -p android --clean --no-install
node scripts/check-manifest-permissions.js
sed -i "s/^\( *\)versionCode .*/\1versionCode $code/" android/app/build.gradle
grep -q "versionCode $code\$" android/app/build.gradle || die "versionCode not set"
echo "sdk.dir=$SDK" > android/local.properties
(cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a --max-workers=2 \
  -Dorg.gradle.parallel=false "-Dorg.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1g")

# --- sign and verify ------------------------------------------------------------------------
built=android/app/build/outputs/apk/release/app-release.apk
[ -f "$built" ] || die "no APK at $built"
out=$WORK/out/disc-tracker-$VERSION-beta.$N-arm64-v8a.apk
prop() { sed -n "s/^$1=//p" "$PROPS" | head -1; }
ks=$(prop RELEASE_STORE_FILE); ks=${ks/#\~/$HOME}
[[ $ks = /* ]] || ks=$(dirname "$PROPS")/app/$ks
[ -f "$ks" ] || die "keystore not found"
KS_PASS=$(prop RELEASE_STORE_PASSWORD) KEY_PASS=$(prop RELEASE_KEY_PASSWORD) \
  "$BT/apksigner" sign --ks "$ks" --ks-key-alias "$(prop RELEASE_KEY_ALIAS)" \
  --ks-pass env:KS_PASS --key-pass env:KEY_PASS --v4-signing-enabled false --alignment-preserved true \
  --out "$out" "$built"

got=$("$BT/apksigner" verify --print-certs "$out" | sed -n 's/.*certificate SHA-256 digest: //p' | head -1)
[ "$got" = "$CERT" ] || { rm -f "$out"; die "wrong signing certificate: ${got:-none}"; }
badge=$("$BT/aapt2" dump badging "$out")
grep -q "^package: name='$APP_ID' versionCode='$code' versionName='$VERSION-beta.$N'" <<<"$badge" || die "APK id or version is wrong"
grep -q "^native-code: 'arm64-v8a'" <<<"$badge" || die "APK is not arm64-only"
echo "== signed $out"
sha256sum "$out"

[ "$PUBLISH" = --publish ] || { echo "== not published (no --publish)"; exit 0; }

# --- publish --------------------------------------------------------------------------------
gh release create "$TAG" "$out" --repo "$REPO" --prerelease --target "$SHA" --title "$TAG (test build)" \
  --notes "Test build for the developer, not an official release. Official builds come from F-Droid.

Back up in the app before installing: going back to an older version means uninstalling.
versionCode $code, arm64-v8a. Built from dev commit $SHA.
SHA-256: $(sha256sum "$out" | cut -d' ' -f1)"
echo "== published $TAG"
