(() => {
  const $ = (id) => document.getElementById(id);
  let pinMode = 'desktop';

  const map = L.map('map', { zoomControl: false, attributionControl: false }).setView([20, 112], 4);
  L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}', { subdomains: '1234', maxZoom: 18 }).addTo(map);

  const shipLayer = L.layerGroup().addTo(map);

  function sColor(sog) {
    if (sog == null) return '#7f8ea6';
    if (sog < 2) return '#4aa3ff';
    if (sog < 12) return '#37d0a0';
    if (sog < 20) return '#f5a623';
    return '#ff5a4b';
  }

  const TYPE_NAMES = [
    [70, 79, '货轮', '#f59220'], [80, 89, '油轮', '#ff5a4b'], [60, 69, '客轮', '#37d0a0'],
    [30, 39, '渔船', '#c084fc'], [50, 59, '引航/拖带', '#4aa3ff'],
  ];
  function tInfo(t) {
    t = Number(t) || 0;
    for (const [a, b, n, c] of TYPE_NAMES) if (t >= a && t <= b) return { n, c };
    return { n: '其他', c: '#8b9aa8' };
  }

  function shipIcon(color, sog, cog) {
    const sz = (sog != null && sog > 1) ? 22 : 16; // 在航稍大
    return L.divIcon({
      className: 'ship-ico',
      html: `<div class="ship" style="width:${sz}px;height:${sz}px;transform:rotate(${cog || 0}deg);color:${color}">
        <svg viewBox="0 0 24 24"><path d="M12 2 L16.5 13 L7.5 13 Z" fill="currentColor"/>
        <path d="M4 14 L20 14 L16 20.5 L8 20.5 Z" fill="currentColor" fill-opacity="0.85"/></svg></div>`,
      iconSize: [sz, sz], iconAnchor: [sz / 2, sz / 2],
    });
  }

  function drawShips(ships) {
    shipLayer.clearLayers();
    let moving = 0, fastest = null;
    ships.slice(0, 900).forEach((s) => {
      const ti = tInfo(s.type);
      if (s.sog != null) { if (s.sog > 1) moving++; if (!fastest || s.sog > fastest.sog) fastest = s; }
      const nm = s.name || s.callsign || s.mmsi;
      const pop = `<b>⛴ ${nm}</b><br>${ti.n} · ${s.sog != null ? s.sog.toFixed(1) + ' kn' : '—'}` +
        `${s.callsign ? '<br>呼号 ' + s.callsign : ''}${s.dest ? '<br>目的港 ' + s.dest : ''}` +
        `${s.cog != null ? '<br>航向 ' + Math.round(s.cog) + '°' : ''}` +
        `<br><a href="#" data-mmsi="${s.mmsi}">查看详情 ›</a>`;
      const m = L.marker([s.lat, s.lon], { icon: shipIcon(ti.c, s.sog, s.cog) }).bindPopup(pop).addTo(shipLayer);
      m.on('popupopen', () => {
        setTimeout(() => {
          const a = document.querySelector('.leaflet-popup [data-mmsi]');
          if (a) a.onclick = (e) => { e.preventDefault(); window.ss.open('https://www.marinetraffic.com/en/ais/details/ships/mmsi:' + a.dataset.mmsi); };
        }, 50);
      });
    });
    // 亮点栏
    let hl = '-- 海里暂无船';
    if (ships.length) {
      const fs = fastest;
      hl = `🚢 ${ships.length} 艘 · ▶ 航行 ${moving} · ⚡ 最快 ${fs ? (fs.name || fs.mmsi) + ' ' + fs.sog.toFixed(0) + 'kn' : '—'}`;
    }
    const lg = TYPE_NAMES.map(([,, n, c]) => `<span class="lg"><i class="dot" style="background:${c}"></i>${n}</span>`).join('');
    $('stats').innerHTML = lg + `<span class="hl">${hl}</span>`;
  }

  function bbox() { const b = map.getBounds(); return { s: b.getSouth(), w: b.getWest(), n: b.getNorth(), e: b.getEast() }; }

  async function pollShips() {
    const r = await window.ss.getShips();
    if (r) { drawShips(r); $('counts').textContent = '⛴ ' + shipLayer.getLayers().length; }
  }

  let moveT = null;
  map.on('moveend', () => {
    clearTimeout(moveT);
    moveT = setTimeout(() => {
      const b = bbox();
      window.ss.setShipBox([[b.s, b.w], [b.n, b.e]]);
    }, 500);
  });

  window.ss.getConfig().then((cfg) => { pinMode = cfg.pin || 'desktop'; applyPin(); });
  function applyPin() { $('pin').textContent = pinMode === 'top' ? '📍' : '📌'; }
  $('pin').addEventListener('click', () => { pinMode = pinMode === 'top' ? 'desktop' : 'top'; applyPin(); window.ss.setPin(pinMode); });
  $('close').addEventListener('click', () => window.ss.close());

  const ib = bbox();
  window.ss.setShipBox([[ib.s, ib.w], [ib.n, ib.e]]);
  setInterval(pollShips, 8000);
  pollShips();
})();