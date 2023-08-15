const joinButton = document.getElementById("join-button");
const codeInput = document.getElementById("code-input") as HTMLInputElement;
const createButton = document.getElementById("create-button");

joinButton.addEventListener('click', function(e) {
  const id = codeInput.value;
  const u = new URL('/game', window.location.href);
  u.searchParams.set('session', id);
  (window as Window).location = u.toString();
});

createButton.addEventListener('click', function(e) {
  const u = new URL('/game', window.location.href);
  (window as Window).location = u.toString();
});

