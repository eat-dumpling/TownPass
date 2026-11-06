# TownPass AGP 9 compatibility patch

Upstream: pub.dev `flutter_inappwebview_android 1.1.3` (Apache-2.0; preserve LICENSE and notices).
Original archive SHA-256 from pub cache: `62557c15a5c2db5d195cb3892aab74fcaec266d7b86d59a6f0027abd672cddba`.

Only functional change: `android/build.gradle` uses `getDefaultProguardFile('proguard-android-optimize.txt')` in place of the legacy `proguard-android.txt` rejected by AGP 9.1.0. This uses the supported optimizer rules; it does not disable R8, certificates, licensing or download verification. Example/test/build cache directories are omitted from vendoring. The root and AI-host pubspecs explicitly override only this Android platform package. Other platforms remain from pub.dev.

Remove this override after a compatible upstream release is adopted and both platform builds/regressions pass. No shared pub cache files were edited.
