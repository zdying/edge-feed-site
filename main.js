(() => {
  let $ = document.querySelector.bind(document);
  let $$ = document.querySelectorAll.bind(document);

  let $faq = $('#js-faq-list');

  $faq.addEventListener('click', (e) => {
    const title = e.target.closest('.title');
    if (!title) return;

    // Toggle current
    title.classList.toggle('active');

    // Handle description toggle
    const desc = title.nextElementSibling;
    if (desc && desc.classList.contains('desc')) {
      desc.classList.toggle('active');
    }

    // Close others
    if (title.classList.contains('active')) {
      $faq.querySelectorAll('.title.active').forEach((el) => {
        if (el !== title) {
          el.classList.remove('active');
          const siblingDesc = el.nextElementSibling;
          if (siblingDesc) siblingDesc.classList.remove('active');
        }
      });
    }

    e.stopPropagation();

    // Scroll into view with delay for transition
    setTimeout(() => {
      if (title.classList.contains('active')) {
        // sticky header offset calculation
        const yOffset = -80; // Header approx height + padding
        const y = title.getBoundingClientRect().top + window.scrollY + yOffset;

        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }, 300);
  });

  // let total = 5;
  // let current = 1;
  // let $mockup = $('#js-mockup');

  // setInterval(() => {
  //   let $img0 = $mockup.querySelector('[data-opacity="0"]');
  //   let $img1 = $mockup.querySelector('[data-opacity="1"]');

  //   current = current > total ? 1 : current + 1;

  //   $img0.src = `./assets/p${current}.jpg`;
  //   $img0.dataset.opacity = '1';
  //   $img1.dataset.opacity = '0';
  //   $img0.style.setProperty('--curr-opacity', 1);
  //   $img1.style.setProperty('--curr-opacity', 0);
  // }, 5000);

  let $menuTrigger = $('#js-menu-trigger');
  let $menu = $('#js-menu');
  let menuQuery = '(max-width: 992px)';
  let isMenuOpen = false;

  $menuTrigger.addEventListener('click', (e) => {
    let mediaQuery = window.matchMedia(menuQuery);

    if (mediaQuery.matches) {
      $menu.classList.toggle('menu-show');
      isMenuOpen = !isMenuOpen;
    }

    e.stopPropagation();
  });

  $menu.addEventListener('click', (e) => {
    let mediaQuery = window.matchMedia(menuQuery);

    if (mediaQuery.matches) {
      $menu.classList.toggle('menu-show');
      isMenuOpen = !isMenuOpen;
    }

    e.stopPropagation();
  });

  document.addEventListener('click', (e) => {
    let mediaQuery = window.matchMedia(menuQuery);

    if (mediaQuery.matches && isMenuOpen) {
      $menu.classList.remove('menu-show');
      isMenuOpen = !isMenuOpen;
    }
  });
})();