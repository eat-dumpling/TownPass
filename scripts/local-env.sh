# Source this file from zsh or bash. All tools remain inside this workspace.
if [ -n "${ZSH_VERSION:-}" ]; then
  tp_env_file="${(%):-%x}"
else
  tp_env_file="${BASH_SOURCE[0]}"
fi
tp_repo_root="$(cd "$(dirname "$tp_env_file")/.." && pwd)"
tp_workspace_root="$(cd "$tp_repo_root/../.." && pwd)"
tp_work_root="${TOWNPASS_LOCAL_WORK_ROOT:-$tp_workspace_root/work}"
export PUB_CACHE="$tp_work_root/cache/pub"
export FVM_CACHE_PATH="$tp_work_root/cache/fvm"
export FVM_SKIP_UPDATE_CHECK=true
export GRADLE_USER_HOME="$tp_work_root/cache/gradle"
export ANDROID_HOME="$tp_work_root/toolchain/android-sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export ANDROID_USER_HOME="$tp_work_root/android-user"
export ANDROID_AVD_HOME="$tp_work_root/avd"
export JAVA_HOME="$tp_work_root/toolchain/jdk/Contents/Home"
export GEM_HOME="$tp_work_root/toolchain/gems"
export GEM_PATH="$GEM_HOME"
export CP_HOME_DIR="$tp_work_root/cache/cocoapods"
export COCOAPODS_DISABLE_STATS=true
export XDG_CONFIG_HOME="$tp_work_root/cache/config"
export FLUTTER_SUPPRESS_ANALYTICS=true
export DART_SUPPRESS_ANALYTICS=true
export PATH="$tp_work_root/toolchain/flutter/bin:$PUB_CACHE/bin:$GEM_HOME/bin:$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
