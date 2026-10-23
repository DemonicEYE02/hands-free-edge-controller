(function () {
  'use strict';
  const display = document.getElementById('kb-display');
  let buffer = '';

  document.querySelectorAll('button[data-key]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-key');
      if (key === 'Backspace') {
        buffer = buffer.slice(0, -1);
        window.parent.postMessage({ type: 'keyboard-type', key: 'Backspace' }, '*');
      } else if (key === 'Shift') {
        buffer += ' ';
        window.parent.postMessage({ type: 'keyboard-type', key: ' ' }, '*');
      } else if (key === 'Enter') {
        buffer += '\n';
        window.parent.postMessage({ type: 'keyboard-type', key: 'Enter' }, '*');
      } else if (key === ' ' || key === '.') {
        buffer += key;
        window.parent.postMessage({ type: 'keyboard-type', key: key }, '*');
      } else {
        buffer += key;
        window.parent.postMessage({ type: 'keyboard-type', key: key }, '*');
      }
      display.textContent = buffer;
    });
  });
})();
