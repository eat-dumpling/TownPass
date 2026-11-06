// SPDX-License-Identifier: AGPL-3.0-or-later
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:town_pass/util/tp_colors.dart';
import 'package:town_pass/util/tp_route.dart';

class CityAiEntryCard extends StatelessWidget {
  const CityAiEntryCard({super.key});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 16),
    child: Card(
      color: TPColors.white,
      child: ListTile(
        key: const Key('open-city-ai-microservice'),
        minVerticalPadding: 16,
        leading: const Icon(
          Icons.forum_outlined,
          color: TPColors.primary500,
          size: 32,
        ),
        title: const Text(
          '城市小幫手',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
        ),
        subtitle: const Text('日常問題，手機裡就能聊'),
        trailing: const Icon(Icons.chevron_right),
        onTap: () => Get.toNamed(TPRoute.cityAi),
      ),
    ),
  );
}
