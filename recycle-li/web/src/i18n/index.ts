// 家長版文字（孩子版維持中文）。翻譯在開發階段產生，上線前須請母語者人工審核（見 TODO.md）。
import { createI18n } from 'vue-i18n'

const messages = {
  zh: {
    tonightTitle: '今晚的尖兵任務', at: '{time} 在 {place}', bring: '要帶：{bags}', withAdult: '請和孩子一起下樓',
    gate: '大人題：{a} + {b} = ?', gateWrong: '再算一次', howMany: '倒了幾袋？', bagSize: '一般垃圾用哪種專用袋？',
    recycleBags: '回收', foodBags: '廚餘', generalBags: '一般垃圾', confirm: '確認，孩子完成了', lang: '家長語言',
    reduce: '孩子今天自備水壺或環保杯', estimate: '數字是家庭自己回報的估計', liters: '公升', none: '沒有',
  },
  en: {
    tonightTitle: "Tonight's mission", at: '{time} at {place}', bring: 'Bring: {bags}', withAdult: 'Please go downstairs together with your child',
    gate: 'Adult check: {a} + {b} = ?', gateWrong: 'Try again', howMany: 'How many bags?', bagSize: 'Which official trash bag size?',
    recycleBags: 'Recycling', foodBags: 'Food waste', generalBags: 'General trash', confirm: 'Confirm: my child did it', lang: 'Parent language',
    reduce: 'My child brought a reusable bottle or cup today', estimate: 'Numbers are your own family estimates', liters: 'L', none: 'None',
  },
  vi: {
    tonightTitle: 'Nhiệm vụ tối nay', at: '{time} tại {place}', bring: 'Mang theo: {bags}', withAdult: 'Vui lòng xuống nhà cùng con',
    gate: 'Câu hỏi cho người lớn: {a} + {b} = ?', gateWrong: 'Thử lại', howMany: 'Đã đổ mấy túi?', bagSize: 'Dùng túi rác chuyên dụng cỡ nào?',
    recycleBags: 'Tái chế', foodBags: 'Rác thực phẩm', generalBags: 'Rác thường', confirm: 'Xác nhận: con đã làm xong', lang: 'Ngôn ngữ phụ huynh',
    reduce: 'Hôm nay con mang bình nước hoặc cốc riêng', estimate: 'Số liệu do gia đình tự ước tính', liters: 'L', none: 'Không',
  },
  id: {
    tonightTitle: 'Misi malam ini', at: '{time} di {place}', bring: 'Bawa: {bags}', withAdult: 'Mohon turun bersama anak Anda',
    gate: 'Pertanyaan orang tua: {a} + {b} = ?', gateWrong: 'Coba lagi', howMany: 'Berapa kantong?', bagSize: 'Ukuran kantong sampah resmi?',
    recycleBags: 'Daur ulang', foodBags: 'Sisa makanan', generalBags: 'Sampah umum', confirm: 'Konfirmasi: anak saya sudah melakukannya', lang: 'Bahasa orang tua',
    reduce: 'Anak saya membawa botol atau gelas sendiri hari ini', estimate: 'Angka ini perkiraan keluarga sendiri', liters: 'L', none: 'Tidak ada',
  },
}

export const i18n = createI18n({ legacy: false, locale: 'zh', fallbackLocale: 'zh', messages })
