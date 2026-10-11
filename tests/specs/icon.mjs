// The browser-tab icon (a Capture Cube) and the iPad home-screen icon load.
export default async function ({ base, t }) {
  const html = await (await fetch(base + '/')).text();
  for (const [rel, file, type] of [['icon', 'favicon.svg', 'image/svg+xml'], ['apple-touch-icon', 'apple-touch-icon.png', 'image/png']]) {
    const res = await fetch(`${base}/${file}`);
    t.ok(html.includes(`rel="${rel}" href="${file}"`) && res.ok && res.headers.get('content-type') === type, `${file} is linked and loads`);
  }
}
