// The links and GET form also work without JavaScript.
const menu = document.querySelector<HTMLElement>('.start-menu');
const panel = document.querySelector<HTMLDetailsElement>('#join-panel');
const code = document.querySelector<HTMLInputElement>('#code-input');

panel.addEventListener('toggle', () => { if (panel.open) code.focus(); });
panel.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    panel.open = false;
    panel.querySelector('summary').focus();
  }
});

// Up and down step through the menu like an arcade cursor, wrapping at the ends.
function menuStops(): HTMLElement[] {
  const stops = [document.querySelector<HTMLElement>('#create-button'), panel.querySelector('summary')];
  if (panel.open) stops.push(code, document.querySelector<HTMLElement>('#join-button'));
  return stops;
}

document.addEventListener('keydown', event => {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  const stops = menuStops();
  const active = document.activeElement as HTMLElement;
  if (active !== document.body && !menu.contains(active)) return;
  const step = event.key === 'ArrowDown' ? 1 : -1;
  const at = stops.indexOf(active);
  const next = at === -1 ? (step === 1 ? 0 : stops.length - 1) : (at + step + stops.length) % stops.length;
  event.preventDefault();
  stops[next].focus();
});
