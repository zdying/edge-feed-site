(() => {
  let $ = document.querySelector.bind(document);
  let $$ = document.querySelectorAll.bind(document);

  let $faq = $('#js-faq-list');

  $faq.addEventListener('click', (e) => {
    let { target } = e;
    let next = null;

    if (target.classList.contains('title')) {
      next = target.nextElementSibling;

      if (next.classList.contains('active')) {
        // 收起
        next.classList.remove('active');
      } else {
        // 展开
        $faq.querySelectorAll('.desc.active').forEach((el) => {
          el.classList.remove('active');
        });
        next.classList.add('active');
      }

      $faq.querySelectorAll('.title').forEach((el) => {
        if (el !== target) {
          el.classList.remove('active');
        }
      });

      target.classList.toggle('active');

      target.scrollIntoView({ behavior: 'smooth', block: 'start' });

      e.stopPropagation();
    }
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