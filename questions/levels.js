// 关卡配置，建议最多 6 关。type 可选：mul-2x1、mul-2x2、div-3x1、div-3x2、science、english、collection
// 所有关卡自由选择，无需按顺序解锁。直接双击打开也能用，不需要服务器。
window.QUESTION_DATA = window.QUESTION_DATA || {};
window.QUESTION_DATA.levels = [
  {
    "type": "mul-2x1",
    "name": "第 1 关 · 乘法起步"
  },
  {
    "type": "mul-2x2",
    "name": "第 2 关 · 两位数乘法"
  },
  {
    "type": "div-3x2",
    "name": "第 3 关 · 两位数除法"
  },
  {
    "type": "science",
    "name": "第 4 关 · 科学常识"
  },
  {
    "type": "english",
    "name": "第 5 关 · 英语单词"
  },
  {
    "type": "collection",
    "name": "第 6 关 · 好词好句收集"
  }
];
