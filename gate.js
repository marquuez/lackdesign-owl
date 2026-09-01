/*
 * Zugangscode vor der Startseite.
 *
 * Achtung: Das ist eine Sichtsperre, kein Schutz. Der Code steht im
 * Quelltext und alle Dateien sind weiterhin direkt abrufbar. Fuer echten
 * Schutz braucht es eine serverseitige Abfrage (z. B. .htaccess bei STRATO).
 */
(function () {
  'use strict';

  const CODE = '222222';
  const root = document.documentElement;

  if (!root.classList.contains('is-locked')) return;

  const gate = document.createElement('div');
  gate.className = 'gate';
  gate.innerHTML = `
    <div class="gate__inner">
      <p class="gate__brand">Lackdesign - OWL</p>
      <h1 class="gate__title">Zugang</h1>
      <p class="gate__text">Diese Seite ist noch nicht öffentlich. Bitte geben Sie den Zugangscode ein.</p>
      <form class="gate__form" novalidate>
        <input class="gate__input" type="password" inputmode="numeric" autocomplete="off"
               aria-label="Zugangscode" placeholder="Code" required />
        <button class="gate__submit" type="submit">Weiter</button>
      </form>
      <p class="gate__error" role="alert" hidden>Falscher Code.</p>
      <nav class="gate__legal" aria-label="Rechtliches">
        <a href="impressum.html">Impressum</a>
        <a href="datenschutz.html">Datenschutz</a>
      </nav>
    </div>
  `;
  document.body.appendChild(gate);

  const form = gate.querySelector('.gate__form');
  const input = gate.querySelector('.gate__input');
  const error = gate.querySelector('.gate__error');

  input.focus();

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    if (input.value.trim() !== CODE) {
      error.hidden = false;
      gate.classList.add('is-wrong');
      input.select();
      setTimeout(() => gate.classList.remove('is-wrong'), 400);
      return;
    }

    // Bewusst nichts speichern: nach jedem Neuladen wird erneut gefragt.
    gate.remove();
    root.classList.remove('is-locked');
    document.dispatchEvent(new Event('lackdesign:unlock'));
  });
})();
