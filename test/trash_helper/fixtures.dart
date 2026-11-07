// TEST DATA ONLY — made-up stops for unit tests. Not part of the city data.
import 'package:town_pass/page/trash_helper/trash_data.dart';
import 'package:town_pass/page/trash_helper/trash_schedule.dart';

/// Taipei wall-clock time → instant (Taipei is UTC+8 all year).
DateTime taipei(int y, int m, int d, [int h = 0, int min = 0]) => DateTime.utc(y, m, d, h, min).subtract(const Duration(hours: 8));

const testStopEvening = TrashStop(
  id: 'test-evening', district: '測試區', village: '測試里', address: '測試路1號（測試用）',
  arrive: 19 * 60 + 20, leave: 19 * 60 + 25, lat: 25.04, lng: 121.53, route: '測試-1', trip: '第1車',
);
const testStopMidnight = TrashStop(
  id: 'test-midnight', district: '測試區', village: '測試里', address: '測試路2號（測試用）',
  arrive: 24 * 60 + 10, leave: 24 * 60 + 15, lat: 25.04, lng: 121.53, route: '測試-2', trip: '第3車',
);
const testStopMonThu = TrashStop(
  id: 'test-monthu', district: '測試區', village: '測試里', address: '測試路3號(週一、週四收運)（測試用）',
  arrive: 17 * 60, leave: 17 * 60 + 5, lat: 25.04, lng: 121.53, route: '測試-3', trip: '第1車', noteDays: [1, 4],
);
const testStopNoFood = TrashStop(
  id: 'test-nofood', district: '測試區', village: '測試里', address: '測試路4號(廚餘車不停)（測試用）',
  arrive: 20 * 60, leave: 20 * 60 + 1, lat: 25.04, lng: 121.53, route: '測試-4', trip: '第2車', noFood: true,
);

TrashData testData({List<CollectionException> exceptions = const []}) => TrashData(
      version: 'test-1',
      stops: {for (final s in [testStopEvening, testStopMidnight, testStopMonThu, testStopNoFood]) s.id: s},
      schedule: TrashSchedule(generalDays: const [1, 2, 4, 5, 6], exceptions: exceptions),
    );
