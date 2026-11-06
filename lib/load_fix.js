// 배포판 음원 불러오기 (webMUSHRA 1.4.3 수정): 화면마다 그 화면의 음원만 받는다.
// - 시작할 때 음원을 전부 받지 않고 바로 첫 화면을 보여 준다.
// - 평가 화면(mushra)의 음원은 그 화면에 들어가기 직전에 받고, 받은 뒤에 그 화면을 준비(init)한다.
//   원본은 시작할 때 모든 화면을 init하는데, init이 음원을 쓰기 때문에 늦춰야 한다.
// - 기다림을 줄이려고 지금 화면 다음의 평가 화면 LOOKAHEAD개를 미리 받아 둔다.
// - 같은 주소는 한 번만 받고, 동시에 CONC개까지, 실패하면 RETRY번까지 다시 시도한다.
// 음원 내용·순서·화면 구성은 바꾸지 않는다.
(function () {
  var CONC = 6, RETRY = 3, LOOKAHEAD = 2;
  var cache = {};      // url -> Promise<AudioBuffer>
  var byPage = {};     // page index -> [{url, callback, arg}]
  var ctx = null;

  function status(t) {
    var el = document.getElementById('load_fix_status');
    if (!el) {
      el = document.createElement('div');
      el.id = 'load_fix_status';
      el.style.cssText = 'position:fixed;left:0;right:0;bottom:16px;text-align:center;font:14px sans-serif;color:#333;z-index:99999;pointer-events:none';
      document.body.appendChild(el);
    }
    el.innerHTML = t;
    el.style.pointerEvents = /button/.test(t) ? 'auto' : 'none';
  }

  function fetchBuf(url, tries) {
    return fetch(url, { cache: 'force-cache' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.arrayBuffer();
    }).catch(function (e) {
      if (tries > 1) return new Promise(function (ok) { setTimeout(ok, 1500); }).then(function () { return fetchBuf(url, tries - 1); });
      throw new Error(url + ': ' + e.message);
    });
  }

  // 동시 요청 제한 큐
  var queue = [], active = 0;
  function pump() {
    while (active < CONC && queue.length) {
      var job = queue.shift(); active++;
      job.run().then(job.ok, job.bad).then(function () { active--; pump(); });
    }
  }
  function load(url, urgent) {
    if (cache[url]) return cache[url];
    cache[url] = new Promise(function (ok, bad) {
      var job = {
        url: url, ok: ok, bad: bad,
        run: function () {
          return fetchBuf(url, RETRY).then(function (ab) {
            return new Promise(function (res, rej) { ctx.decodeAudioData(ab, res, rej); });
          });
        }
      };
      urgent ? queue.unshift(job) : queue.push(job);
      pump();
    });
    cache[url].catch(function () { delete cache[url]; }); // 실패하면 다음에 다시 받을 수 있게
    return cache[url];
  }

  function pageFiles(i) { return byPage[i] || []; }
  function isAudioPage(pm, i) { return pageFiles(i).length > 0; }

  function ensurePage(pm, i, urgent) {
    var fs = pageFiles(i);
    return Promise.all(fs.map(function (f) {
      return load(f.url, urgent).then(function (buf) { f.callback(buf, f.arg); });
    }));
  }

  function prefetchAfter(pm, i) {
    var n = 0;
    for (var j = i + 1; j < pm.pages.length && n < LOOKAHEAD; j++) {
      if (isAudioPage(pm, j)) { ensurePage(pm, j, false).catch(function () {}); n++; }
    }
  }

  // 1) 파일 등록: 어느 화면 것인지 기록 (MushraPage는 addPage 전에 addFile을 부르므로 pages.length = 그 화면 번호)
  AudioFileLoader.prototype.addFile = function (url, callback, arg) {
    var i = window.pageManager ? window.pageManager.pages.length : 0;
    (byPage[i] = byPage[i] || []).push({ url: url, callback: callback, arg: arg });
  };

  // 2) 시작: 음원을 기다리지 않고 바로 시작, 첫 평가 화면들만 미리 받기 시작
  AudioFileLoader.prototype.startLoading = function (done) {
    ctx = this.audioContext;
    this.callbackSuccess = done;
    done();
  };

  // 3) 시작 시 init: 음원이 필요한 화면은 나중에(화면에 들어가기 직전) init
  var origStart = PageManager.prototype.start;
  PageManager.prototype.start = function () {
    var pm = this;
    pm.pages.forEach(function (p, i) {
      if (isAudioPage(pm, i) && p.init) { p.__lazyInit = p.init; p.init = undefined; }
    });
    origStart.call(pm);
    pm.pages.forEach(function (p) {
      if (p.__lazyInit) { p.init = p.__lazyInit; }
    });
    prefetchAfter(pm, pm.pagesIndex);
  };

  // 4) 다음 화면: 그 화면 음원이 준비될 때까지 기다린 뒤 init하고 넘어감
  var origNext = PageManager.prototype.nextPage, busy = false;
  PageManager.prototype.nextPage = function () {
    var pm = this, i = pm.pagesIndex + 1, page = pm.pages[i];
    if (busy) return;
    if (!page || !isAudioPage(pm, i)) { origNext.call(pm); prefetchAfter(pm, pm.pagesIndex); return; }
    busy = true;
    var btn = document.getElementById('__button_next');
    if (btn) btn.disabled = true;
    var shown = false, t = setTimeout(function () { shown = true; status('음원 불러오는 중…'); }, 300);
    ensurePage(pm, i, true).then(function () {
      clearTimeout(t); if (shown) status('');
      if (page.__lazyInit) { page.__lazyInit(); page.__lazyInit = null; page.init = undefined; }
      busy = false;
      origNext.call(pm);
      prefetchAfter(pm, pm.pagesIndex);
    }).catch(function (e) {
      clearTimeout(t); busy = false;
      if (btn) btn.disabled = false;
      console.log(e);
      status('<b style="color:#c00">음원을 불러오지 못했습니다.</b> 인터넷 연결을 확인하고 <b>Next</b>를 다시 눌러 주세요.<br><small>' + String(e.message || e) + '</small>');
    });
  };
})();
