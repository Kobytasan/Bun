// Плавна поява карток та дрібні UI-поліпшення
document.addEventListener('DOMContentLoaded', () => {
  const cards = document.querySelectorAll('.product-card, .category-card, .stat-card, .info-card');
  cards.forEach((c, i) => {
    c.style.opacity = '0';
    c.style.transform = 'translateY(8px)';
    c.style.transition = `opacity .35s ease ${i * 40}ms, transform .35s ease ${i * 40}ms`;
    requestAnimationFrame(() => {
      c.style.opacity = '1';
      c.style.transform = 'translateY(0)';
    });
  });
});
