// Toshkent namoz vaqtlari — islom.uz bilan bir xil hisoblash usuli
// (adhan kutubxonasi: tong/xufton 15.5°, asr Hanafiy, shom = quyosh botishi + 4 daqiqa).
// Har bir namoz vaqti kirishidan 3 daqiqa oldin Telegram guruhga xabar yuboradi.
//
// Ishlatish:  node namoz.mjs <bomdod|peshin|asr|shom|xufton|jadval>
// Muhit o'zgaruvchilari: BOT_TOKEN, CHAT_ID, TZ=Asia/Tashkent, DRY_RUN=1 (sinov uchun)

import { Coordinates, CalculationMethod, PrayerTimes, Madhab } from 'adhan';

const COORDS = new Coordinates(41.300872, 69.241813); // islom.uz: Toshkent (id 27)
const OLDIN_DAQIQA = 3;
const TZ = 'Asia/Tashkent';

const NOMLAR = {
  bomdod: 'Bomdod',
  peshin: 'Peshin',
  asr: 'Asr',
  shom: 'Shom',
  xufton: 'Xufton',
};

function params() {
  const p = CalculationMethod.Other();
  p.fajrAngle = 15.5;
  p.ishaAngle = 15.5;
  p.madhab = Madhab.Hanafi;
  return p;
}

// Toshkent bo'yicha bugungi sana (server qaysi vaqt zonasida bo'lishidan qat'i nazar)
function toshkentSana(d = new Date()) {
  const [y, m, day] = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(d).split('-').map(Number);
  return new Date(y, m - 1, day, 12, 0, 0);
}

export function vaqtlar(sana = toshkentSana()) {
  const t = new PrayerTimes(COORDS, sana, params());
  return {
    bomdod: t.fajr,
    quyosh: t.sunrise,
    peshin: t.dhuhr,
    asr: t.asr,
    shom: new Date(t.maghrib.getTime() + 4 * 60000),
    xufton: t.isha,
  };
}

const hhmm = (d) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);

const OYLAR = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
function sanaMatn(d) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric' })
    .formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.day}-${OYLAR[Number(p.month) - 1]}, ${p.year}`;
}

function jadvalMatn(v) {
  return [
    `🗓 ${sanaMatn(v.bomdod)} — Toshkent`,
    ``,
    `Bomdod — ${hhmm(v.bomdod)}`,
    `Quyosh — ${hhmm(v.quyosh)}`,
    `Peshin — ${hhmm(v.peshin)}`,
    `Asr — ${hhmm(v.asr)}`,
    `Shom — ${hhmm(v.shom)}`,
    `Xufton — ${hhmm(v.xufton)}`,
  ].join('\n');
}

function xabarMatn(namoz, v) {
  const nom = NOMLAR[namoz];
  let matn = `🕌 ${nom} namozi vaqti kirishiga ${OLDIN_DAQIQA} daqiqa qoldi.\n⏰ ${nom}: ${hhmm(v[namoz])} (Toshkent)`;
  if (namoz === 'bomdod') matn += `\n\n${jadvalMatn(v)}`;
  return matn;
}

async function yubor(matn) {
  if (process.env.DRY_RUN) {
    console.log('--- DRY_RUN ---\n' + matn);
    return;
  }
  const { BOT_TOKEN, CHAT_ID } = process.env;
  if (!BOT_TOKEN || !CHAT_ID) throw new Error('BOT_TOKEN yoki CHAT_ID berilmagan');
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text: matn }),
  });
  const j = await r.json();
  if (!j.ok) throw new Error('Telegram xatosi: ' + JSON.stringify(j));
  console.log('Yuborildi.');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const arg = (process.argv[2] || '').toLowerCase();
  const v = vaqtlar();

  if (arg === 'jadval') {
    await yubor(jadvalMatn(v));
    return;
  }
  if (!NOMLAR[arg]) {
    console.error('Namoz nomi kerak: bomdod | peshin | asr | shom | xufton | jadval');
    process.exit(1);
  }

  const maqsad = v[arg].getTime() - OLDIN_DAQIQA * 60000;
  const kutish = maqsad - Date.now();
  console.log(`${NOMLAR[arg]}: ${hhmm(v[arg])}, xabar vaqti: ${hhmm(new Date(maqsad))}, kutish: ${Math.round(kutish / 60000)} daqiqa`);

  if (process.env.NOW) {
    // qo'lda sinov: kutmasdan darhol yuborish
  } else if (kutish < -10 * 60000) {
    console.log('Vaqt o\'tib ketgan, xabar yuborilmadi.');
    return;
  } else if (kutish > 0) {
    await sleep(kutish);
  }
  await yubor(xabarMatn(arg, v));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
