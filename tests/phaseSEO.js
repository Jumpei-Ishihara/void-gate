/* SEO/SNS メタ情報 受け入れテスト → window.__PSEORESULTS */
(async ()=>{
  const R = [];
  const t = (id, pass, detail='') => R.push({id, pass: !!pass, detail: String(detail)});
  const m = (sel, attr='content')=>{ const e = document.querySelector(sel); return e ? e.getAttribute(attr) : null; };
  const BASE = 'https://jumpei-ishihara.github.io/void-gate/';

  // ---- 基本SEO ----
  const title = document.title;
  t('SEO-01 title', title.includes('VOID GATE') && title.length >= 20 && title.length <= 60,
    `${title.length}字: ${title}`);
  const desc = m('meta[name="description"]');
  t('SEO-02 description', !!desc && desc.length >= 80 && desc.length <= 160, `${desc ? desc.length : 0}字`);
  t('SEO-03 canonical', m('link[rel="canonical"]', 'href') === BASE);
  t('SEO-04 robots', (m('meta[name="robots"]')||'').includes('index'));
  t('SEO-05 lang属性', document.documentElement.lang === 'ja');
  t('SEO-06 theme-color', m('meta[name="theme-color"]') === '#030014');

  // ---- OGP ----
  const og = k=>m(`meta[property="og:${k}"]`);
  t('OG-01 必須4種', ['type','title','description','image'].every(k=>!!og(k)),
    ['type','title','description','image'].map(k=>k+':'+(og(k)?'o':'x')).join(' '));
  t('OG-02 画像は絶対URL', (og('image')||'').startsWith('https://'), og('image'));
  t('OG-03 画像サイズ指定', og('image:width') === '1200' && og('image:height') === '630');
  t('OG-04 url/site_name/locale', og('url') === BASE && !!og('site_name') && og('locale') === 'ja_JP');
  t('OG-05 image:alt', !!og('image:alt'));

  // ---- Twitter Card ----
  t('TW-01 card種別', m('meta[name="twitter:card"]') === 'summary_large_image');
  t('TW-02 title/desc/image', ['title','description','image'].every(k=>!!m(`meta[name="twitter:${k}"]`)));

  // ---- アイコン / PWA ----
  t('ICON-01 favicon(SVG+PNG)', !!m('link[rel="icon"][type="image/svg+xml"]', 'href')
    && !!m('link[rel="icon"][type="image/png"]', 'href'));
  t('ICON-02 apple-touch-icon', !!m('link[rel="apple-touch-icon"]', 'href'));
  t('ICON-03 manifest', !!m('link[rel="manifest"]', 'href'));

  // ---- 構造化データ ----
  const ld = document.querySelector('script[type="application/ld+json"]');
  let json = null, ldErr = '';
  try{ json = JSON.parse(ld.textContent); }catch(e){ ldErr = e.message; }
  t('LD-01 JSON-LDが妥当', !!json, ldErr || 'ok');
  if(json){
    const types = (json['@graph']||[]).map(n=>n['@type']);
    t('LD-02 WebSite/VideoGame', types.includes('WebSite') && types.includes('VideoGame'), types.join(','));
    const game = (json['@graph']||[]).find(n=>n['@type'] === 'VideoGame');
    t('LD-03 ゲーム情報', !!game && !!game.name && !!game.image && !!game.offers, game ? game.name : 'なし');
  }

  // ---- 実ファイルの到達性 ----
  const assets = ['assets/og.png', 'assets/icon.svg', 'assets/favicon-32.png',
    'assets/apple-touch-icon.png', 'assets/icon-192.png', 'assets/icon-512.png',
    'site.webmanifest', 'robots.txt', 'sitemap.xml'];
  const results = await Promise.all(assets.map(a =>
    fetch('/void-gate/' + a, {cache:'no-store'}).then(r=>({a, ok:r.ok, s:r.status})).catch(()=>({a, ok:false, s:0}))));
  const ng = results.filter(r=>!r.ok);
  t('FILE-01 全アセット到達', ng.length === 0, ng.length ? ng.map(r=>`${r.a}:${r.s}`).join(' ') : `${results.length}件OK`);

  // manifestの中身
  try{
    const mf = await fetch('/void-gate/site.webmanifest', {cache:'no-store'}).then(r=>r.json());
    t('FILE-02 manifest妥当', !!mf.name && !!mf.icons && mf.icons.length >= 2 && !!mf.theme_color,
      `icons=${mf.icons.length}`);
  }catch(e){ t('FILE-02 manifest妥当', false, e.message); }

  // OGP画像の実寸(1200x630)
  const dim = await new Promise(res=>{
    const im = new Image();
    im.onload = ()=>res(`${im.naturalWidth}x${im.naturalHeight}`);
    im.onerror = ()=>res('load error');
    im.src = '/void-gate/assets/og.png?seo=' + Date.now();
  });
  t('FILE-03 OGP画像1200x630', dim === '1200x630', dim);

  window.__PSEORESULTS = R;
  const bad = R.filter(x=>!x.pass);
  console.info(`[SEO] ${R.length-bad.length}/${R.length} pass`, bad.length?bad:'ALL GREEN');
  console.table(R);
  return R;
})();
