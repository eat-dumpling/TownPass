import 'package:get/get.dart';
import 'package:town_pass/page/city_service/model/my_service_model.dart';

class PinnedServiceWidgetController extends GetxController {
  final RxList<MyServiceItemId> _pinnedList = RxList(
    [
      // 黑客松作品：回收小里長、丟丟放在「我的服務」最前面，一點就進入微服務
      MyServiceItemId.recycleLi,
      MyServiceItemId.trashHelper,
      MyServiceItemId.locationSearch,
      MyServiceItemId.districtOffice,
      MyServiceItemId.dashboard,
    ],
  );

  RxList<MyServiceItemId> get pinnedList => _pinnedList;

  bool remove(MyServiceItemId itemId) {
    return _pinnedList.remove(itemId);
  }

  bool replaceWith(List<MyServiceItemId> list) {
    if (list.isNotEmpty) {
      _pinnedList.value = list;
      return true;
    }
    return false;
  }

  bool push(MyServiceItemId itemId) {
    if (_pinnedList.length < 12) {
      _pinnedList.add(itemId);
      return true;
    }
    return false;
  }
}
