// Online saves against the REAL Supabase project. Skipped unless both are set:
//   PC_TEST_EMAIL / PC_TEST_PASSWORD  - a confirmed test account (see CLAUDE.md for how to make one)
// Needs network access to *.supabase.co and cdn.jsdelivr.net.
import { openGame, newGame, click, continueGame } from '../helpers.mjs';

export default async function ({ browser, base, t }) {
  const email = process.env.PC_TEST_EMAIL, password = process.env.PC_TEST_PASSWORD;
  if (!email || !password) { console.log('  SKIP  set PC_TEST_EMAIL and PC_TEST_PASSWORD to test online saves'); return; }
  const signIn = async page => {
    await click(page, 'text=Sign in / Create account');
    await page.fill('input[type=email]', email);
    await page.fill('input[type=password]', password);
    await click(page, 'button:has-text("Sign in")');
    await page.waitForFunction(() => /Signed in as/.test(document.getElementById('account').textContent), null, { timeout: 30000 });
    await page.waitForTimeout(2500);
  };
  const d1 = await openGame(browser, base, { online: true });
  await signIn(d1);
  await newGame(d1, 2);
  const marker = 40 + Math.floor(Math.random() * 50);
  await d1.evaluate(m => { window.pokecraft.cubes = m; document.exitPointerLock(); }, marker);
  await d1.waitForTimeout(4000);
  t.ok(/Saved online/.test(await d1.textContent('#cloud-status')), 'pausing saves online');
  const d2 = await openGame(browser, base, { online: true });
  await signIn(d2);
  await continueGame(d2);
  t.ok(await d2.evaluate(m => window.pokecraft.cubes === m, marker), 'a second device continues the same save');
  await d1.context().close(); await d2.context().close();
}
