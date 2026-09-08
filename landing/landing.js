(() => {
  const data = JSON.parse(document.querySelector('#landing-data').textContent)[0];
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const storedTheme = localStorage.getItem('bitwardenagents-landing-theme');
  const preferredDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  let locale = localStorage.getItem('bitwardenagents-landing-locale') || (navigator.language.startsWith('zh') ? 'zh' : 'en');

  const t = (path) => path.split('.').reduce((v, k) => v?.[k], data[locale]);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

  function el(tag, cls, html) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html != null) node.innerHTML = html;
    return node;
  }

  /* ---------------- theme / language ---------------- */

  function setTheme(theme) {
    root.dataset.theme = theme;
    localStorage.setItem('bitwardenagents-landing-theme', theme);
  }

  function renderLanguage() {
    root.lang = locale === 'zh' ? 'zh-CN' : 'en';
    document.title = data[locale].meta.title;
    document.querySelector('meta[name="description"]').content = data[locale].meta.description;
    document.querySelectorAll('[data-copy]').forEach((node) => {
      const value = t(node.dataset.copy);
      if (value != null && typeof value !== 'object') node.textContent = value;
    });
    document.querySelectorAll('[data-copy-label]').forEach((button) => {
      button.textContent = t(button.dataset.copyLabel);
    });
    document.querySelector('#language-toggle').textContent = locale === 'zh' ? 'EN' : '中';
    document.querySelector('#language-toggle').setAttribute('aria-label', data[locale].nav.language);
    document.querySelector('#theme-toggle').setAttribute('aria-label', data[locale].nav.theme);
    renderVault();
    if (vaultPlayed || reduced) vaultFinalState();
    renderFlow();
    renderPanels();
    renderChips();
    theaterMode = 'dry';
    syncTheaterControls();
    theaterRun(true);
    playgroundRun(activeGroup, { instant: true });
  }

  setTheme(storedTheme || (preferredDark ? 'dark' : 'light'));

  document.querySelector('#theme-toggle').addEventListener('click', () => {
    setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  document.querySelector('#language-toggle').addEventListener('click', () => {
    locale = locale === 'zh' ? 'en' : 'zh';
    localStorage.setItem('bitwardenagents-landing-locale', locale);
    renderLanguage();
  });

  document.querySelectorAll('[data-copy-command]').forEach((button) => {
    button.addEventListener('click', async () => {
      const text = button.dataset.copyCommand;
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.append(area);
        area.select();
        document.execCommand('copy');
        area.remove();
      }
      button.textContent = t(button.dataset.copyDone);
      button.classList.add('done');
      window.setTimeout(() => {
        button.textContent = t(button.dataset.copyLabel);
        button.classList.remove('done');
      }, 1400);
    });
  });

  /* ---------------- scroll progress + reveal ---------------- */

  const progressFill = document.querySelector('#scroll-progress-fill');
  const onScroll = () => {
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    progressFill.style.transform = `scaleX(${max > 0 ? doc.scrollTop / max : 0})`;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if (!reduced && 'IntersectionObserver' in window) {
    root.classList.add('motion-ready');
    const revealIO = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          revealIO.unobserve(entry.target);
        }
      }
    }, { threshold: 0.12 });
    document.querySelectorAll('[data-reveal]').forEach((node) => revealIO.observe(node));
  }

  /* ---------------- vault window (hero) ---------------- */

  const RING_R = 21;
  const RING_C = 2 * Math.PI * RING_R;
  const HEALTH_SCORE = 87;
  let vaultGen = 0;
  let vaultVisible = false;
  let vaultPlayed = false;

  function renderVault() {
    const w = t('heroWindow');
    const host = document.querySelector('#vault-window');
    if (!host) return;
    host.innerHTML = '';

    const bar = el('div', 'vault-titlebar');
    bar.append(el('span'), el('span'), el('span'), el('strong', null, esc(w.windowTitle)), el('em', 'vault-demo-badge', esc(w.demoBadge)));

    const side = el('aside', 'vault-sidebar');
    side.append(el('p', 'vault-sidebar-title', esc(w.sidebarTitle)));
    w.folders.forEach((folder, i) => {
      const node = el('div', 'vault-folder' + (i === 0 ? ' active' : ''));
      node.style.setProperty('--f', i);
      node.innerHTML = `<span>${esc(folder.name)}</span><em>${folder.count}</em>`;
      side.append(node);
    });

    const main = el('div', 'vault-main');
    const health = el('div', 'vault-health');
    health.innerHTML = `
      <svg class="health-ring" viewBox="0 0 52 52" aria-hidden="true">
        <circle class="track" cx="26" cy="26" r="${RING_R}" fill="none" stroke-width="4"/>
        <circle class="fill" cx="26" cy="26" r="${RING_R}" fill="none" stroke-width="4"
          stroke-dasharray="${RING_C}" stroke-dashoffset="${RING_C}"/>
      </svg>
      <div class="health-copy">
        <strong>${esc(w.healthLabel)} <span class="score-num">0</span>/100</strong>
        <small>${esc(w.healthCmd)}</small>
      </div>`;

    const list = el('ul', 'vault-list');
    w.items.forEach((item, i) => {
      const row = el('li', 'vault-row');
      row.style.setProperty('--i', i);
      if (item.flag) row.dataset.flag = item.flag;
      row.innerHTML = `
        <span class="vault-avatar">${esc(item.site[0].toUpperCase())}</span>
        <span class="vault-id"><strong>${esc(item.site)}</strong><span>${esc(item.user)}</span></span>
        ${item.flag ? `<em class="vault-flag">${esc(w.flags[item.flag])}</em>` : '<span class="vault-mask">••••••••</span>'}`;
      list.append(row);
    });

    const status = el('div', 'vault-status');
    status.innerHTML = `
      <span class="state"><span class="status-dot"></span><span class="status-text">${esc(w.scanScanning)}</span></span>
      <span class="note">${esc(w.maskNote)}</span>`;

    main.append(health, list, status);
    const body = el('div', 'vault-body');
    body.append(side, main);
    host.append(bar, body);
  }

  function vaultFinalState() {
    const host = document.querySelector('#vault-window');
    const fill = host.querySelector('.health-ring .fill');
    const rows = [...host.querySelectorAll('.vault-row')];
    host.querySelector('.score-num').textContent = HEALTH_SCORE;
    fill.style.strokeDashoffset = RING_C * (1 - HEALTH_SCORE / 100);
    const dupes = rows.filter((r) => r.dataset.flag === 'dupe');
    dupes.forEach((row) => row.classList.add('dupe'));
    const status = host.querySelector('.vault-status');
    status.querySelector('.status-text').textContent = t('heroWindow.scanReady');
    status.querySelector('.status-dot').classList.add('ready');
  }

  async function vaultLoop() {
    const gen = ++vaultGen;
    const w = t('heroWindow');
    const host = document.querySelector('#vault-window');
    const fill = host.querySelector('.health-ring .fill');
    const score = host.querySelector('.score-num');
    const statusText = host.querySelector('.status-text');
    const dot = host.querySelector('.status-dot');
    const rows = [...host.querySelectorAll('.vault-row')];
    const dupes = rows.filter((r) => r.dataset.flag === 'dupe');

    if (gen === vaultGen && host.isConnected && vaultVisible) {
      rows.forEach((r) => r.classList.remove('scanned', 'dupe', 'kept', 'merging'));
      dot.classList.remove('ok', 'ready');
      statusText.textContent = w.scanScanning;
      fill.style.strokeDashoffset = RING_C;
      score.textContent = '0';
      await sleep(700);
      if (gen !== vaultGen) return;

      const start = performance.now();
      const dur = reduced ? 0 : 1400;
      await new Promise((resolve) => {
        const tick = (now) => {
          if (gen !== vaultGen) return resolve();
          const p = dur === 0 ? 1 : Math.min(1, (now - start) / dur);
          const eased = 1 - Math.pow(1 - p, 3);
          score.textContent = Math.round(HEALTH_SCORE * eased);
          fill.style.strokeDashoffset = RING_C * (1 - (HEALTH_SCORE / 100) * eased);
          if (p < 1) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
      if (gen !== vaultGen) return;

      statusText.textContent = w.scanScanning;
      for (const row of rows) {
        if (gen !== vaultGen) return;
        row.classList.add('scanned');
        await sleep(reduced ? 0 : 300);
        row.classList.remove('scanned');
        await sleep(reduced ? 0 : 90);
      }

      await sleep(260);
      if (gen !== vaultGen) return;
      dupes.forEach((r) => r.classList.add('dupe'));
      statusText.textContent = w.scanFound;
      await sleep(reduced ? 0 : 900);
      if (gen !== vaultGen) return;
      statusText.textContent = w.scanReady;
      dot.classList.add('ready');
    }
  }

  function watchVault() {
    const host = document.querySelector('#vault-frame');
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const was = vaultVisible;
        vaultVisible = entry.isIntersecting;
        if (vaultVisible && !was && !vaultPlayed) {
          vaultPlayed = true;
          vaultLoop();
        }
      }
    }, { threshold: 0.25 });
    io.observe(host);
  }

  /* ---------------- theater (guardrails terminal) ---------------- */

  let theaterGen = 0;
  let theaterMode = 'dry';
  let theaterSkip = false;
  let theaterStarted = false;

  const gates = () => [...document.querySelectorAll('.gate')];

  function lightGate(index) {
    gates()[index]?.classList.add('lit');
    const rail = document.querySelector('#rail-progress');
    if (rail) rail.style.transform = `scaleX(${(index + 1) / 4})`;
  }

  function syncTheaterControls() {
    const applyBtn = document.querySelector('#theater-apply');
    const mode = document.querySelector('#theater-mode');
    if (!applyBtn) return;
    if (theaterMode === 'dry') {
      applyBtn.textContent = t('theater.applyOn');
      mode.textContent = t('theater.modeDry');
      mode.classList.remove('apply');
    } else {
      applyBtn.textContent = t('theater.applyOff');
      mode.textContent = t('theater.modeApply');
      mode.classList.add('apply');
    }
  }

  async function typeInto(line, text, gen, withPrompt) {
    const target = el('span', 'typed');
    const cursor = el('span', 'tl-cursor');
    if (withPrompt) line.append(el('span', 'prompt', '$ '), target, cursor);
    else line.append(target, cursor);
    line.classList.add('show');
    if (reduced || theaterSkip) {
      target.textContent = text;
      cursor.remove();
      return;
    }
    for (const char of text) {
      if (gen !== theaterGen || theaterSkip) {
        target.textContent = text;
        break;
      }
      target.textContent += char;
      await sleep(13);
    }
    cursor.remove();
  }

  async function runBar(line, max, gen) {
    const fill = line.querySelector('.bar i');
    const count = line.querySelector('em');
    const dur = reduced ? 0 : 900;
    const start = performance.now();
    await new Promise((resolve) => {
      const tick = (now) => {
        if (gen !== theaterGen) return resolve();
        const p = dur === 0 ? 1 : Math.min(1, (now - start) / dur);
        fill.style.transform = `scaleX(${p})`;
        count.textContent = `${Math.round(max * p)}/${max}`;
        if (p < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
  }

  async function theaterRun(instant) {
    const gen = ++theaterGen;
    theaterSkip = !!instant;
    const body = document.querySelector('#theater-body');
    const steps = t('theater')[theaterMode] || [];
    body.innerHTML = '';
    gates().forEach((g) => g.classList.remove('lit'));
    const rail = document.querySelector('#rail-progress');
    if (rail) rail.style.transform = 'scaleX(0)';
    syncTheaterControls();

    for (const step of steps) {
      if (gen !== theaterGen) return;
      if (step.t === 'cmd') {
        const line = el('span', 'tl tl-cmd');
        body.append(line);
        await typeInto(line, step.text, gen, true);
      } else if (step.t === 'key') {
        const line = el('span', 'tl tl-dim', esc(step.text));
        body.append(line);
        await sleep(reduced || theaterSkip ? 0 : 220);
        line.classList.add('show');
      } else if (step.t === 'bar') {
        const line = el('span', 'tl tl-bar');
        line.innerHTML = `<span>${esc(step.label)}</span><span class="bar"><i></i></span><em>0/${step.max}</em>`;
        body.append(line);
        line.classList.add('show');
        await runBar(line, step.max, gen);
      } else if (step.t === 'kv') {
        const line = el('span', 'tl tl-kv');
        line.innerHTML = step.rows.map(([k, v]) => `<b>${esc(k)}</b><i>${esc(v)}</i>`).join('');
        body.append(line);
        await sleep(reduced || theaterSkip ? 0 : 60);
        line.classList.add('show');
      } else {
        const line = el('span', `tl tl-${step.cls || ''}`);
        line.textContent = step.text;
        body.append(line);
        await sleep(reduced || theaterSkip ? 0 : 90);
        line.classList.add('show');
      }
      if (step.gate != null) lightGate(step.gate);
      await sleep(reduced || theaterSkip ? 0 : 380);
    }
    if (gen !== theaterGen) return;
    theaterSkip = false;
    const cursorLine = el('span', 'tl');
    cursorLine.append(el('span', 'tl-cursor'));
    body.append(cursorLine);
    cursorLine.classList.add('show');
  }

  function watchTheater() {
    const host = document.querySelector('#theater');
    if (!reduced) {
      const io = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !theaterStarted) {
            theaterStarted = true;
            theaterRun();
            io.disconnect();
          }
        }
      }, { threshold: 0.3 });
      io.observe(host);
    }

    document.querySelector('#theater-replay').addEventListener('click', () => theaterRun());
    document.querySelector('#theater-apply').addEventListener('click', () => {
      theaterMode = theaterMode === 'dry' ? 'apply' : 'dry';
      theaterRun();
    });
    document.querySelector('#theater-body').addEventListener('click', () => {
      theaterSkip = true;
    });
    gates().forEach((gate) => {
      gate.addEventListener('click', () => theaterRun());
      gate.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          theaterRun();
        }
      });
    });
  }

  /* ---------------- cli playground ---------------- */

  let activeGroup = 'auth';
  let playgroundGen = 0;
  let playgroundStarted = false;

  function renderChips() {
    const host = document.querySelector('#playground-chips');
    host.innerHTML = '';
    t('cli.groups').forEach((group) => {
      const chip = el('button', 'chip' + (group.name === activeGroup ? ' active' : ''));
      chip.type = 'button';
      chip.setAttribute('role', 'tab');
      chip.setAttribute('aria-selected', String(group.name === activeGroup));
      chip.tabIndex = group.name === activeGroup ? 0 : -1;
      chip.textContent = group.name;
      chip.addEventListener('click', () => {
        activeGroup = group.name;
        host.querySelectorAll('.chip').forEach((c) => {
          c.classList.remove('active');
          c.setAttribute('aria-selected', 'false');
          c.tabIndex = -1;
        });
        chip.classList.add('active');
        chip.setAttribute('aria-selected', 'true');
        chip.tabIndex = 0;
        playgroundRun(group.name);
      });
      host.append(chip);
    });
  }

  async function playgroundRun(group) {
    const gen = ++playgroundGen;
    const body = document.querySelector('#playground-body');
    const runs = t('cli.runs') || {};
    const desc = t('cli.groups').find((g) => g.name === group)?.description || '';
    body.innerHTML = '';

    const cmd = el('span', 'tl tl-cmd');
    body.append(cmd);
    const typed = el('span', 'typed');
    const cursor = el('span', 'tl-cursor');
    cmd.append(el('span', 'prompt', '$ '), typed, cursor);
    cmd.classList.add('show');
    const command = `bwvault ${group} --help`;
    typed.textContent = command;
    cursor.remove();

    const descLine = el('span', 'tl tl-dim', esc(`# ${desc}`));
    body.append(descLine);
    if (gen !== playgroundGen) return;
    descLine.classList.add('show');

    for (const line of runs[group] || []) {
      if (gen !== playgroundGen) return;
      const node = el('span', 'tl', esc(line));
      body.append(node);
      node.classList.add('show');
    }
    if (gen !== playgroundGen) return;
    const cursorLine = el('span', 'tl');
    cursorLine.append(el('span', 'tl-cursor'));
    body.append(cursorLine);
    cursorLine.classList.add('show');
  }

  function watchPlayground() {
    const host = document.querySelector('.playground');
    document.querySelector('#playground-chips').addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      const tabs = [...document.querySelectorAll('#playground-chips [role="tab"]')];
      const current = tabs.indexOf(document.activeElement);
      if (current < 0) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
        : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      tabs[next].click();
      tabs[next].focus();
    });
    if (reduced) return;
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && !playgroundStarted) {
          playgroundStarted = true;
          playgroundRun(activeGroup);
          io.disconnect();
        }
      }
    }, { threshold: 0.3 });
    io.observe(host);
  }

  /* ---------------- product mini panels ---------------- */

  let healthBarsSet = false;

  function renderPanels() {
    const p = t('product');

    const health = document.querySelector('#panel-health');
    health.innerHTML = `<span class="panel-cmd">${esc(p.healthCmd)}</span>` + p.healthBars.map((bar, i) => {
      const tone = i === 0 ? ' danger' : i === 1 ? ' warn' : '';
      return `<div class="hbar${tone}" data-value="${bar.value}">
        <div class="hbar-head"><span>${esc(bar.label)}</span><b>${bar.value}</b></div>
        <div class="track"><div class="fill"></div></div>
      </div>`;
    }).join('');

    const d = p.dedupe;
    document.querySelector('#panel-dedupe').innerHTML = `
      <span class="panel-cmd">${esc(p.dedupeCmd)}</span>
      <div class="dedupe-stage">
        <div class="dupe-card a"><span>${esc(d.cardA)}</span><span class="pill">${esc(d.keep)}</span></div>
        <div class="dupe-card b"><span>${esc(d.cardB)}</span><span class="pill">${esc(d.merge)}</span></div>
        <div class="dupe-result">${esc(d.result)}</div>
      </div>`;

    document.querySelector('#panel-alias').innerHTML = `
      <div class="alias-term">
        <span class="cmd-line"><span class="prompt">$ </span><span class="typed"></span><span class="tl-cursor"></span></span>
      </div>`;
    startAliasLoop();
  }

  let aliasGen = 0;
  let aliasVisible = false;

  async function startAliasLoop() {
    const gen = ++aliasGen;
    const p = t('product.alias');
    const term = document.querySelector('#panel-alias .alias-term');
    if (!term) return;

    while (gen === aliasGen && term.isConnected && (aliasVisible || reduced)) {
      term.querySelectorAll('.row, .note').forEach((n) => n.remove());
      const typed = term.querySelector('.typed');
      const cursor = term.querySelector('.tl-cursor');
      typed.textContent = '';
      if (reduced) {
        typed.textContent = p.cmd;
        cursor.remove();
        appendAliasRows(term, p);
        return;
      }
      for (const char of p.cmd) {
        if (gen !== aliasGen) return;
        typed.textContent += char;
        await sleep(26);
      }
      cursor.remove();
      appendAliasRows(term, p);
      await sleep(4200);
      const fresh = el('span', 'tl-cursor');
      term.querySelector('.cmd-line').append(fresh);
    }
  }

  function appendAliasRows(term, p) {
    p.rows.forEach((row, i) => {
      const node = el('span', 'row');
      node.style.opacity = '0';
      node.style.transition = 'opacity .4s ease';
      node.innerHTML = `<b>${esc(row[0])}</b>  ${esc(row[1])}  ${esc(row[2])}  <span class="mask">${esc(p.masked)}</span>`;
      term.append(node);
      setTimeout(() => { node.style.opacity = '1'; }, reduced ? 0 : 300 + i * 260);
    });
    const note = el('span', 'note', esc(p.note));
    note.style.opacity = '0';
    note.style.transition = 'opacity .4s ease';
    term.append(note);
    setTimeout(() => { note.style.opacity = '1'; }, reduced ? 0 : 300 + p.rows.length * 260);
  }

  function watchPanels() {
    const health = document.querySelector('#panel-health');
    const ioHealth = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && !healthBarsSet) {
          healthBarsSet = true;
          const max = Math.max(...health.querySelectorAll('.hbar').length
            ? [...health.querySelectorAll('.hbar')].map((b) => Number(b.dataset.value)) : [1]);
          health.querySelectorAll('.hbar').forEach((bar) => {
            bar.querySelector('.fill').style.width = `${(Number(bar.dataset.value) / max) * 100}%`;
          });
          ioHealth.disconnect();
        }
      }
    }, { threshold: 0.4 });
    ioHealth.observe(health);

    const alias = document.querySelector('#panel-alias');
    const ioAlias = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const was = aliasVisible;
        aliasVisible = entry.isIntersecting;
        if (aliasVisible && !was) startAliasLoop();
      }
    }, { threshold: 0.35 });
    ioAlias.observe(alias);
  }

  /* ---------------- boundary flow ---------------- */

  function renderFlow() {
    const b = t('boundary');
    const host = document.querySelector('#boundary-flow');
    host.innerHTML = '';
    b.nodes.forEach((node, i) => {
      const n = el('div', 'flow-node' + (i === 1 ? ' proxy' : ''));
      const badge = i === 0 ? `<span class="flow-badge">${esc(b.browserBadge)}</span>`
        : i === 1 ? `<span class="flow-badge">${esc(b.proxyBadge)}</span>` : '';
      const decode = i === 0 ? '<span class="flow-decode">▓▓▓▓▓▓▓▓</span>' : '';
      n.innerHTML = `<strong>${esc(node.name)}</strong><span>${esc(node.detail)}</span>${badge}${decode}`;
      host.append(n);
      if (i < b.nodes.length - 1) {
        const link = el('div', 'flow-link');
        link.setAttribute('aria-hidden', 'true');
        link.innerHTML = `
          <span class="lane top"></span><span class="lane bottom"></span>
          <span class="packet top">▓▓▓</span>
          <span class="packet top d2">▓▓▓</span>
          <span class="packet bottom">▓▓▓</span>
          <span class="packet bottom d2">▓▓▓</span>`;
        host.append(link);
      }
    });
    startDecode();
  }

  let decodeTimer = null;
  function startDecode() {
    clearTimeout(decodeTimer);
    const node = document.querySelector('.flow-decode');
    if (!node) return;
    const values = ['boss@itycon.cn ✓', 'api.cloudflare.com ✓', 'ssh://nas ✓'];
    if (reduced) {
      node.textContent = values[0];
      return;
    }
    const target = values[0];
    const chars = '▓░#%&@$';
    decodeTimer = setTimeout(() => {
      let frame = 0;
      const iv = setInterval(() => {
        node.textContent = target.split('').map((c, i) => (frame > i * 1.5 ? c : chars[Math.random() * chars.length | 0])).join('');
        frame += 1;
        if (frame > target.length * 1.5 + 2) {
          clearInterval(iv);
          node.textContent = target;
        }
      }, 42);
    }, 650);
  }

  /* ---------------- boot ---------------- */

  renderLanguage();
  if (!reduced) watchVault();
  watchTheater();
  watchPlayground();
  watchPanels();

  if (reduced) {
    vaultFinalState();
    document.querySelectorAll('.gate').forEach((gate) => gate.classList.add('lit'));
  }
})();
