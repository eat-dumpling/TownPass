// SPDX-License-Identifier: AGPL-3.0-or-later
import 'dart:convert';

enum ModelState {
  needsConfiguration,
  licenseRequired,
  notInstalled,
  downloading,
  verifying,
  ready,
  loading,
  failed,
}

class ModelDescriptor {
  final String id,
      name,
      developer,
      publisher,
      originalUrl,
      license,
      licenseStatus,
      revision,
      message;
  final String? artifactUrl, sha256;
  final int sizeBytes;
  final bool enabled;
  const ModelDescriptor({
    required this.id,
    required this.name,
    required this.developer,
    required this.publisher,
    required this.originalUrl,
    required this.license,
    required this.licenseStatus,
    required this.revision,
    required this.message,
    required this.enabled,
    required this.sizeBytes,
    this.artifactUrl,
    this.sha256,
  });

  ModelState get initialState => licenseStatus != 'approved'
      ? ModelState.licenseRequired
      : approved
      ? ModelState.notInstalled
      : ModelState.needsConfiguration;

  // Closed provenance allowlist. Adding a model requires a reviewed code change.
  bool get approved =>
      enabled &&
      license == 'Apache-2.0' &&
      licenseStatus == 'approved' &&
      ((id == 'granite-4-1b-q4km' &&
              developer == 'IBM' &&
              publisher == 'IBM Granite' &&
              originalUrl ==
                  'https://huggingface.co/ibm-granite/granite-4.0-1b' &&
              revision == 'b27c2fe3f211b7f44e80fa620177aea371099aaa' &&
              sha256 ==
                  '22ec0f9cc99a90185312de3c882c84e7bd6789bdd050389844380a01a831d7f1' &&
              sizeBytes == 1023645440 &&
              artifactUrl ==
                  'https://huggingface.co/ibm-granite/granite-4.0-1b-GGUF/resolve/$revision/granite-4.0-1b-Q4_K_M.gguf') ||
          (id == 'granite-4-350m-q4km' &&
              developer == 'IBM' &&
              publisher == 'IBM Granite' &&
              originalUrl ==
                  'https://huggingface.co/ibm-granite/granite-4.0-350m' &&
              revision == 'b8208a86a58427e1739265318028eb5895b74bf2' &&
              sha256 ==
                  '771c588a49607f274a2bba3185733607ebe6f74b996ab90e2d6bee0d98bcec52' &&
              sizeBytes == 236985760 &&
              artifactUrl ==
                  'https://huggingface.co/ibm-granite/granite-4.0-350m-GGUF/resolve/$revision/granite-4.0-350m-Q4_K_M.gguf') ||
          (id == 'smollm2-135m-q4km' &&
              developer == 'Hugging Face' &&
              publisher == 'Unsloth AI' &&
              revision == '9e6855bc4be717fca1ef21360a1db4b29d5c559a' &&
              sha256 ==
                  'ed5fa30c487b282ec156c29062f1222e5c20875a944ac98289dbd242e947f747' &&
              sizeBytes == 105454144 &&
              artifactUrl ==
                  'https://huggingface.co/unsloth/SmolLM2-135M-Instruct-GGUF/resolve/$revision/SmolLM2-135M-Instruct-Q4_K_M.gguf'));

  factory ModelDescriptor.fromJson(Map<String, dynamic> j) => ModelDescriptor(
    id: j['id'] as String,
    name: j['display_name'] as String,
    developer: j['original_developer'] as String,
    publisher: j['artifact_publisher'] as String,
    originalUrl: j['original_model_url'] as String,
    license: j['license_name'] as String,
    licenseStatus: j['license_review_status'] as String,
    revision: j['revision'] as String,
    message: j['message'] as String,
    enabled: j['enabled'] as bool,
    sizeBytes: j['size_bytes'] as int,
    artifactUrl: j['artifact_url'] as String?,
    sha256: j['sha256'] as String?,
  );

  static List<ModelDescriptor> parseRegistry(String text) => List.unmodifiable(
    (jsonDecode(text) as List).map(
      (e) => ModelDescriptor.fromJson(e as Map<String, dynamic>),
    ),
  );
}

class InstalledModel {
  final ModelDescriptor descriptor;
  final String path;
  const InstalledModel(this.descriptor, this.path);
}

enum AiFailureKind {
  consent,
  license,
  integrity,
  space,
  memory,
  unsupported,
  network,
  cancelled,
  configuration,
  busy,
  runtime,
}

class AiFailure implements Exception {
  final AiFailureKind kind;
  final String message;
  const AiFailure(this.kind, this.message);
  @override
  String toString() => message;
}
