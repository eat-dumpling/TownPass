// SPDX-License-Identifier: AGPL-3.0-or-later
enum ChatRole { user, assistant }

class ChatTurn {
  final ChatRole role;
  final String text;
  const ChatTurn(this.role, this.text);
}
