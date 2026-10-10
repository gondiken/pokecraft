export const wait = ms => new Promise(r => setTimeout(r, ms));

// Runs fn(t) with t going 0 -> 1 over ms milliseconds.
export function tween(ms, fn) {
  return new Promise(resolve => {
    const t0 = performance.now();
    const step = now => {
      const t = Math.min(1, (now - t0) / ms);
      fn(t);
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

export const easeOut = t => 1 - (1 - t) * (1 - t);

export function hpColor(frac) {
  return frac > 0.5 ? 'var(--hp-good)' : frac > 0.2 ? 'var(--hp-mid)' : 'var(--hp-low)';
}

export function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return e;
}
