// The links and GET form also work without JavaScript.
const panel = document.querySelector<HTMLDetailsElement>('#join-panel');
const code = document.querySelector<HTMLInputElement>('#code-input');

panel.addEventListener('toggle', () => { if (panel.open) code.focus(); });
panel.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    panel.open = false;
    panel.querySelector('summary').focus();
  }
});
