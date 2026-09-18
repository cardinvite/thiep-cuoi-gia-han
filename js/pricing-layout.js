// Tự xếp lại (reflow) các thẻ trong Bảng giá theo chiều cao thật của nội dung.
//
// Ladipage xuất HTML với mọi phần tử đặt vị trí tuyệt đối (top/height cố định
// trong index.css), nên khi text từ Google Sheet dài/ngắn hơn bản thiết kế thì
// chữ bị đè lên nhau (vd: giá gói VIP đè lên mô tả) hoặc thẻ thừa khoảng trống.
//
// Script này đo chiều cao thật của từng dòng text, xếp lại từ trên xuống bên trong
// mỗi thẻ, chỉnh chiều cao khung/viền của thẻ, dồn các thẻ phía dưới lên/xuống
// tương ứng và cập nhật chiều cao của section. Nếu có lỗi thì bỏ qua, giữ nguyên
// layout gốc để không làm vỡ trang.
(function (root) {
  const SECTION_ID = 'SECTION3';

  // Khoảng cách (px) dùng chung cho các thẻ, lấy theo bản thiết kế gốc.
  const PAD_TOP = 14;        // từ mép trên thẻ tới dòng "Giá gốc"
  const PAD_BOTTOM = 26;     // từ dòng cuối tới mép dưới thẻ
  const GAP_BEFORE_LINE = 8; // từ mô tả tới đường kẻ ngang
  const GAP_AFTER_LINE = 4;  // từ đường kẻ ngang tới nội dung bên dưới
  const GAP_CARD = 30;       // giữa hai thẻ liên tiếp
  const GAP_AFTER_CARDS = 36;   // từ thẻ cuối tới nút "xem mẫu"
  const SECTION_PAD_BOTTOM = 16;

  // Mỗi thẻ: group (khung ngoài), sizers (các phần tử cần chỉnh chiều cao
  // theo thẻ: hộp nền/viền và group lồng bên trong), badge (tem "50% OFF"),
  // items: các phần tử xếp từ trên xuống, kèm khoảng cách phía trên mỗi phần tử.
  // Phần tử nằm ngoài group (vd HEADLINE95, HEADLINE85) vẫn được xếp vào thẻ,
  // toạ độ sẽ tự đổi sang toạ độ của section.
  const CARDS = [
    { // Gói 1
      group: 'GROUP43', sizers: ['GROUP36', 'BOX12'], badge: 'IMAGE10',
      items: [['GROUP25', PAD_TOP], ['HEADLINE66', 0], ['HEADLINE25', 0], ['LINE3', GAP_BEFORE_LINE], ['HEADLINE82', GAP_AFTER_LINE]],
    },
    { // Gói 2
      group: 'GROUP44', sizers: ['GROUP45', 'BOX25'], badge: 'IMAGE11',
      items: [['GROUP46', PAD_TOP], ['HEADLINE89', 0], ['HEADLINE88', 0], ['LINE11', GAP_BEFORE_LINE], ['HEADLINE90', GAP_AFTER_LINE]],
    },
    { // Gói 3
      group: 'GROUP48', sizers: ['BOX26'], badge: 'IMAGE12',
      items: [['GROUP49', PAD_TOP], ['HEADLINE94', 0], ['HEADLINE93', 0], ['LINE12', GAP_BEFORE_LINE], ['HEADLINE95', GAP_AFTER_LINE]],
    },
    { // Gói VIP
      group: 'GROUP41', sizers: ['BOX24'], badge: 'IMAGE13',
      items: [['HEADLINE81', 10], ['HEADLINE80', 0], ['LINE10', GAP_BEFORE_LINE], ['HEADLINE79', GAP_AFTER_LINE], ['HEADLINE85', 6]],
    },
  ];

  // Các phần tử nằm dưới thẻ cuối cùng, dồn theo thẻ.
  const AFTER_CARDS = [['GROUP35', GAP_AFTER_CARDS]];

  let firstCardTop = null;

  function byId(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error(`[pricing-layout] Không tìm thấy phần tử #${id}`);
    return el;
  }

  function px(value) {
    return `${Math.round(value * 100) / 100}px`;
  }

  function reflow() {
    try {
      const section = byId(SECTION_ID);
      const firstGroup = byId(CARDS[0].group);
      if (firstCardTop === null) {
        firstCardTop = parseFloat(root.getComputedStyle(firstGroup).top) || 0;
      }

      let cursor = firstCardTop;
      CARDS.forEach((card) => {
        const group = byId(card.group);
        const cardTop = cursor;
        let y = 0;
        card.items.forEach(([id, gap]) => {
          const el = byId(id);
          y += gap;
          // Phần tử nằm trong group thì toạ độ tính từ mép thẻ,
          // nằm ngoài (trực tiếp trong section) thì cộng thêm vị trí thẻ.
          el.style.top = px(group.contains(el) ? y : cardTop + y);
          y += el.offsetHeight;
        });
        const height = y + PAD_BOTTOM;
        group.style.top = px(cardTop);
        group.style.height = px(height);
        card.sizers.forEach((id) => { byId(id).style.height = px(height); });
        if (card.badge) byId(card.badge).style.top = px(cardTop);
        cursor = cardTop + height + GAP_CARD;
      });
      cursor -= GAP_CARD;

      AFTER_CARDS.forEach(([id, gap]) => {
        const el = byId(id);
        cursor += gap;
        el.style.top = px(cursor);
        cursor += el.offsetHeight;
      });

      section.style.height = px(cursor + SECTION_PAD_BOTTOM);
    } catch (err) {
      console.warn(err && err.message ? err.message : err);
    }
  }

  let resizeTimer = null;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(reflow, 100);
  }

  function boot() {
    reflow();
    // Đo lại sau khi font chữ tuỳ chỉnh tải xong vì chiều cao dòng thay đổi.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(reflow);
    root.addEventListener('load', reflow);
    root.addEventListener('resize', onResize);
  }

  root.PricingLayout = { reflow };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
