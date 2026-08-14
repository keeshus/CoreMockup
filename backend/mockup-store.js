const MAX_HISTORY = 20;

export function createMockupStore(initialHtml = '') {
  let html = initialHtml;
  const history = [];

  return {
    get() {
      return html;
    },
    set(next) {
      if (typeof next !== 'string' || next === html) return;
      history.push(html);
      if (history.length > MAX_HISTORY) history.shift();
      html = next;
    },
    undo() {
      if (history.length === 0) return null;
      html = history.pop();
      return html;
    },
    clear() {
      html = '';
      history.length = 0;
    },
    historySize() {
      return history.length;
    },
  };
}
