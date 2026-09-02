(function () {
  var menuBtn = document.getElementById('menuBtn');
  var menu = document.getElementById('mobileMenu');
  if (!menuBtn || !menu) return;

  function closeMenu() {
    menu.classList.remove('open');
    menu.setAttribute('aria-hidden', 'true');
    menuBtn.setAttribute('aria-expanded', 'false');
  }

  function openMenu() {
    menu.classList.add('open');
    menu.setAttribute('aria-hidden', 'false');
    menuBtn.setAttribute('aria-expanded', 'true');
  }

  menuBtn.addEventListener('click', function () {
    var isOpen = menu.classList.contains('open');
    if (isOpen) { closeMenu(); } else { openMenu(); }
  });

  // Close the menu whenever a link inside it is used to jump to a section.
  menu.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', closeMenu);
  });

  // Close on escape.
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeMenu();
  });

  // Close the mobile menu automatically if the viewport grows into desktop.
  var desktopQuery = window.matchMedia('(min-width: 900px)');
  desktopQuery.addEventListener('change', function (e) {
    if (e.matches) closeMenu();
  });
})();
