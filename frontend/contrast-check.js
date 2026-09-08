function luminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const [R, G, B] = [r, g, b].map(c =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrast(fg, bg) {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const pairs = [
  ['#f8fafc', '#0f1419', 'primary text on surface-background'],
  ['#f1f5f9', '#0f1419', 'headings on surface-background'],
  ['#f8fafc', '#1a2027', 'primary text on surface-card'],
  ['#cbd5e1', '#1a2027', 'label text (neutral-600) on surface-card'],
  ['#94a3b8', '#1a2027', 'secondary text (neutral-500) on surface-card'],
  ['#22d3ee', '#0f1419', 'brand primary on surface-background'],
  ['#22d3ee', '#1a2027', 'brand primary on surface-card'],
  ['#6ee7b7', '#064e3b', 'success-text on success-bg'],
  ['#fcd34d', '#451a03', 'warning-text on warning-bg'],
  ['#fca5a5', '#450a0a', 'error-text on error-bg'],
  ['#93c5fd', '#1e3a5f', 'info-text on info-bg'],
  ['#34d399', '#1a2027', 'success base on surface-card'],
  ['#f87171', '#1a2027', 'error base on surface-card'],
  ['#60a5fa', '#1a2027', 'info base on surface-card'],
  ['#fbbf24', '#1a2027', 'warning base on surface-card'],
  ['#e2e8f0', '#1a2027', 'body text (neutral-700) on surface-card'],
  ['#a78bfa', '#1a2027', 'secondary accent on surface-card'],
];

let allPass = true;
pairs.forEach(([fg, bg, desc]) => {
  const r = contrast(fg, bg);
  const pass = r >= 4.5;
  if (!pass) allPass = false;
  console.log(`${r.toFixed(2)}:1 ${pass ? 'PASS' : 'FAIL'} - ${desc} (${fg} on ${bg})`);
});

console.log(allPass ? '\nAll pairs PASS WCAG AA (4.5:1)' : '\nSome pairs FAIL - needs adjustment');
