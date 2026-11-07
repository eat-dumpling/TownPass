#!/bin/zsh
# Build the requested Dart entry point and use Xcode's actual device output.
set -e
source "${0:A:h}/local-env.sh"
tp_entry="${1:?Dart entry point required}"
tp_device="${2:?iPhone device ID required}"
tp_service_url="${3:?Microservice URL required}"
tp_mode="${4:-Debug}"
tp_ios_app_root="${5:-$tp_repo_root}"
cd "$tp_ios_app_root"
case "$tp_mode" in
  Debug) tp_flutter_mode=debug ;;
  Profile) tp_flutter_mode=profile ;;
  *) print "Use Debug or Profile"; exit 1 ;;
esac
fvm flutter build ios "--$tp_flutter_mode" --config-only --target "$tp_entry" --dart-define=ENABLE_HACKATHON_DEMO=true --dart-define=HACKATHON_SERVICE_URL="$tp_service_url" ${TRASH_HELPER_URL:+--dart-define=TRASH_HELPER_URL=$TRASH_HELPER_URL} ${RECYCLE_LI_URL:+--dart-define=RECYCLE_LI_URL=$RECYCLE_LI_URL}
xcodebuild -workspace "$tp_ios_app_root/ios/Runner.xcworkspace" -scheme Runner -configuration "$tp_mode" -sdk iphoneos -destination "id=$tp_device" "BUILD_DIR=$tp_ios_app_root/build/ios" -quiet build
test -d "$tp_ios_app_root/build/ios/$tp_mode-iphoneos/Runner.app"
mkdir -p "$tp_ios_app_root/build/ios/iphoneos"
rsync -a --delete "$tp_ios_app_root/build/ios/$tp_mode-iphoneos/Runner.app" "$tp_ios_app_root/build/ios/iphoneos/"
