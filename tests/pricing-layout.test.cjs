const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const script = fs.readFileSync('js/pricing-layout.js', 'utf8');

// DOM giả tối thiểu: mỗi phần tử có offsetHeight, style và quan hệ cha/con.
function fakeDom(heights, tree) {
  const nodes = new Map();
  const node = (id) => {
    if (!nodes.has(id)) {
      nodes.set(id, {
        id,
        offsetHeight: heights[id] ?? 0,
        style: {},
        children: [],
        contains(other) {
          if (other === this) return true;
          return this.children.some((child) => child.contains(other));
        },
      });
    }
    return nodes.get(id);
  };
  Object.entries(tree).forEach(([parent, children]) => {
    children.forEach((child) => node(parent).children.push(node(child)));
  });
  const listeners = {};
  const document = {
    readyState: 'complete',
    fonts: { ready: { then() {} } },
    getElementById: (id) => (nodes.has(id) || id in heights ? node(id) : null),
    addEventListener() {},
  };
  const window = {
    document,
    getComputedStyle: () => ({ top: '157px' }),
    addEventListener(name, fn) { listeners[name] = fn; },
    console,
    setTimeout, clearTimeout,
  };
  window.window = window;
  return { window, node, listeners };
}

const TREE = {
  GROUP43: ['GROUP36', 'HEADLINE82'],
  GROUP36: ['BOX12', 'GROUP25', 'LINE3', 'HEADLINE25', 'HEADLINE66'],
  GROUP44: ['GROUP45', 'HEADLINE90'],
  GROUP45: ['BOX25', 'GROUP46', 'LINE11', 'HEADLINE88', 'HEADLINE89'],
  GROUP48: ['BOX26', 'GROUP49', 'LINE12', 'HEADLINE93', 'HEADLINE94'],
  GROUP41: ['BOX24', 'HEADLINE79', 'LINE10', 'HEADLINE80', 'HEADLINE81'],
};

const HEIGHTS = {
  SECTION3: 0, GROUP35: 57,
  IMAGE10: 95, IMAGE11: 95, IMAGE12: 95, IMAGE13: 95,
  GROUP25: 29, HEADLINE66: 51, HEADLINE25: 26, LINE3: 20, HEADLINE82: 115,
  GROUP46: 29, HEADLINE89: 51, HEADLINE88: 51, LINE11: 20, HEADLINE90: 115,
  GROUP49: 29, HEADLINE94: 51, HEADLINE93: 51, LINE12: 20, HEADLINE95: 115,
  HEADLINE81: 51, HEADLINE80: 91, LINE10: 20, HEADLINE79: 32, HEADLINE85: 24,
};

function run(heights) {
  const dom = fakeDom(heights, TREE);
  const ctx = vm.createContext(dom.window);
  vm.runInContext(script, ctx);
  return dom;
}

test('xếp các phần tử trong thẻ từ trên xuống, không đè lên nhau', () => {
  const { node } = run(HEIGHTS);
  // Gói VIP: tiêu đề -> mô tả (3 dòng) -> đường kẻ -> giá -> ghi chú
  const top = (id) => parseFloat(node(id).style.top);
  assert.equal(top('HEADLINE81'), 10);
  assert.equal(top('HEADLINE80'), 10 + 51);
  assert.equal(top('LINE10'), 10 + 51 + 91 + 8);
  assert.equal(top('HEADLINE79'), top('LINE10') + 20 + 4);
  // Giá phải nằm hoàn toàn dưới mô tả.
  assert.ok(top('HEADLINE79') >= top('HEADLINE80') + HEIGHTS.HEADLINE80);
  // Chiều cao thẻ = nội dung + lề dưới, áp cho cả khung viền.
  const vipHeight = top('HEADLINE79') + 32 + 6 + 24 + 26;
  assert.equal(parseFloat(node('GROUP41').style.height), vipHeight);
  assert.equal(parseFloat(node('BOX24').style.height), vipHeight);
});

test('phần tử nằm ngoài group được đặt theo toạ độ section', () => {
  const { node } = run(HEIGHTS);
  const cardTop = parseFloat(node('GROUP48').style.top);
  const lineTop = parseFloat(node('LINE12').style.top);
  // HEADLINE95 (mô tả gói 3) là con trực tiếp của section nên cộng thêm vị trí thẻ.
  assert.equal(parseFloat(node('HEADLINE95').style.top), cardTop + lineTop + 20 + 4);
  // Ghi chú gói VIP cũng vậy.
  const vipTop = parseFloat(node('GROUP41').style.top);
  assert.equal(parseFloat(node('HEADLINE85').style.top), vipTop + parseFloat(node('HEADLINE79').style.top) + 32 + 6);
});

test('các thẻ, tem giảm giá, nút và section dồn theo chiều cao thật', () => {
  const { node } = run(HEIGHTS);
  const h = (id) => parseFloat(node(id).style.height);
  const top = (id) => parseFloat(node(id).style.top);
  assert.equal(top('GROUP43'), 157);
  assert.equal(top('GROUP44'), 157 + h('GROUP43') + 30);
  assert.equal(top('GROUP48'), top('GROUP44') + h('GROUP44') + 30);
  assert.equal(top('GROUP41'), top('GROUP48') + h('GROUP48') + 30);
  assert.equal(top('IMAGE13'), top('GROUP41'));
  assert.equal(top('GROUP35'), top('GROUP41') + h('GROUP41') + 36);
  assert.equal(h('SECTION3'), top('GROUP35') + 57 + 16);
});

test('nội dung ngắn hơn thì thẻ co lại', () => {
  const short = { ...HEIGHTS, HEADLINE80: 30 };
  const tall = run(HEIGHTS).node('GROUP41');
  const small = run(short).node('GROUP41');
  assert.equal(parseFloat(tall.style.height) - parseFloat(small.style.height), 91 - 30);
});

test('thiếu phần tử thì bỏ qua, không ném lỗi', () => {
  const { GROUP35, ...missing } = HEIGHTS;
  const warned = [];
  const dom = fakeDom(missing, TREE);
  dom.window.console = { warn: (msg) => warned.push(msg), log() {} };
  const ctx = vm.createContext(dom.window);
  assert.doesNotThrow(() => vm.runInContext(script, ctx));
  assert.match(warned.join('\n'), /GROUP35/);
});
