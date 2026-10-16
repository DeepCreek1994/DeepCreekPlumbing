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
  var desktopQuery = window.matchMedia('(min-width: 1280px)');
  desktopQuery.addEventListener('change', function (e) {
    if (e.matches) closeMenu();
  });
})();

// Desktop "Services" dropdown: opens on hover (CSS) or click/keyboard (here).
(function () {
  document.querySelectorAll('.has-dropdown').forEach(function (item) {
    var toggle = item.querySelector('.dropdown-toggle');
    if (!toggle) return;

    function setOpen(open) {
      item.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    toggle.addEventListener('click', function () {
      setOpen(!item.classList.contains('open'));
    });

    // Close when focus or a click moves outside, or on Escape.
    item.addEventListener('focusout', function (e) {
      if (!item.contains(e.relatedTarget)) setOpen(false);
    });
    document.addEventListener('click', function (e) {
      if (!item.contains(e.target)) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && item.classList.contains('open')) {
        setOpen(false);
        toggle.focus();
      }
    });
  });
})();

// Conversion tracking (GA4): phone_click on tagged tel: links, cta_click on [data-cta].
// Never blocks or delays the click; does nothing if gtag is unavailable.
(function () {
  document.addEventListener('click', function (e) {
    if (typeof window.gtag !== 'function' || !e.target.closest) return;

    var tel = e.target.closest('a[href^="tel:"][data-location]');
    if (tel) {
      window.gtag('event', 'phone_click', {
        phone_number: tel.getAttribute('href').replace(/\D/g, ''),
        location: tel.getAttribute('data-location')
      });
    }

    var cta = e.target.closest('[data-cta]');
    if (cta) {
      window.gtag('event', 'cta_click', {
        cta_name: cta.getAttribute('data-cta'),
        location: cta.getAttribute('data-location')
      });
    }
  }, true);
})();
