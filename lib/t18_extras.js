// 토론 18 예비·본 청취용 추가 기능 (비공개 테스트 사이트 전용, 공개 사이트 미적용).
// 1) 단축키: 기준음 = ` (한글 자판의 ₩ 키, 물리 키 Backquote), 10번 = 0, 11번 = -.
//    원본의 "0 = 기준음"은 해제한다. 1–9, r, space, backspace 등 원본 단축키는 그대로.
//    물리 키 코드(e.code)로 받으므로 한/영 입력 상태와 상관없이 동작한다. 글 입력 칸에서는 동작하지 않는다.
// 2) 세션 기록(BS.1534-3 §5.5 "Recording of test sessions"의 소프트웨어 기록): 평가 화면마다
//    재생(기준음/각 자극), 정지, 반복 구간 변경, 슬라이더 조작을 시각(ms)과 함께 남기고,
//    결과 JSON의 각 trial에 interactions, timeOnPage_ms로 붙인다. 점수·자극·순서는 바꾸지 않는다.
// 이 파일은 webMUSHRA.js, audio_fix.js 다음에 불러야 한다.
(function () {
  if (!/[?&]config=t18_/.test(location.search)) return;   // t18 설정에서만 동작(다른 설정 화면은 그대로)
  // ---------- 0) 설정 파일 캐시 방지 ----------
  // YAML.load가 XHR로 configs/*.yaml을 받는데, Chrome이 이를 캐시해 새로고침해도 예전 설정이 뜰 수 있다.
  // .yaml 요청에만 시각 쿼리를 붙여 항상 새로 받게 한다(음원 요청은 건드리지 않음).
  var origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, url) {
    if (typeof url === 'string' && /\.ya?ml$/i.test(url)) {
      arguments[1] = url + '?nocache=' + Date.now();
    }
    return origOpen.apply(this, arguments);
  };

  // ---------- 2) 세션 기록 ----------
  var LOG = window.__t18log = {};
  var cur = null, t0 = 0;
  function now() { return Math.round(performance.now() - t0); }
  function push(ev) { if (cur === null) return; (LOG[cur] = LOG[cur] || []).push(ev); }
  function loopInfo(ac) {
    return { ls: ac.audioLoopStart, le: ac.audioLoopEnd, sr: ac.audioSampleRate || (ac.audioContext && ac.audioContext.sampleRate) };
  }

  var origLoad = MushraPage.prototype.load;
  MushraPage.prototype.load = function () {
    cur = this.pageConfig.id; t0 = performance.now();
    LOG[cur] = LOG[cur] || [];
    push({ t: 0, e: 'load' });
    var r = origLoad.apply(this, arguments);
    $(document).off('.t18rate').on('slidestop.t18rate change.t18rate', '.scales', function () {
      var arr = LOG[cur] || [], last = arr[arr.length - 1], t = now(), v = Number(this.value);
      // 끌기 중 연속 change는 한 번의 조작으로 합친다(같은 슬라이더, 400 ms 이내)
      if (last && last.e === 'rate' && last.s === this.name && t - last.t2 < 400) { last.v = v; last.t2 = t; }
      else push({ t: t, t2: t, e: 'rate', s: this.name, v: v });
    });
    return r;
  };

  var origRef = MushraAudioControl.prototype.playReference;
  MushraAudioControl.prototype.playReference = function () {
    push(Object.assign({ t: now(), e: 'play', s: 'REF_OPEN' }, loopInfo(this)));
    return origRef.apply(this, arguments);
  };
  var origCond = MushraAudioControl.prototype.playCondition;
  MushraAudioControl.prototype.playCondition = function (i) {
    var c = this.conditions[i];
    push(Object.assign({ t: now(), e: 'play', s: c ? c.id : ('idx' + i), idx: i }, loopInfo(this)));
    return origCond.apply(this, arguments);
  };
  var origStop = MushraAudioControl.prototype.stop;      // audio_fix.js가 바꾼 stop을 감싼다
  MushraAudioControl.prototype.stop = function () { push({ t: now(), e: 'stop' }); return origStop.apply(this, arguments); };
  var origPause = MushraAudioControl.prototype.pause;
  MushraAudioControl.prototype.pause = function () { push({ t: now(), e: 'pause' }); return origPause.apply(this, arguments); };
  var origSetLoop = MushraAudioControl.prototype.setLoop;
  MushraAudioControl.prototype.setLoop = function () {
    var r = origSetLoop.apply(this, arguments);
    push(Object.assign({ t: now(), e: 'loop' }, loopInfo(this)));
    return r;
  };

  var origSave = MushraPage.prototype.save;
  MushraPage.prototype.save = function () {
    push({ t: now(), e: 'leave' });
    var r = origSave.apply(this, arguments);
    cur = null;
    return r;
  };
  var origStore = MushraPage.prototype.store;
  MushraPage.prototype.store = function () {
    origStore.apply(this, arguments);
    var tr = this.session.trials[this.session.trials.length - 1];
    tr.timeOnPage_ms = this.time;
    tr.interactions = LOG[this.pageConfig.id] || [];
  };

  // ---------- 2b) "다음" 누를 때 확인 (2026-11-13 유태빈 요청) ----------
  // 평가 화면에서 한 번도 재생하지 않은 소리(기준음 포함)가 있으면 넘어가지 못하게 하고 번호를 알려 준다.
  // 한 번도 움직이지 않은 슬라이더가 있으면 그 화면에서 한 번만 "그대로 둘까요?"를 묻는다(막지 않음).
  // 확인 결과(막힘·경고)도 세션 기록에 남긴다. 점수·자극·순서는 바꾸지 않는다.
  var askedUntouched = {};
  var origNext = PageManager.prototype.nextPage;
  PageManager.prototype.nextPage = function () {
    var pg = this.pages[this.pagesIndex];
    // 동의 화면: 체크해야 넘어간다. 동의 여부·시각·문안 버전을 세션에 저장(결과 JSON의 consent).
    var box = document.getElementById('t18consent');      // GenericPage는 id를 남기지 않아 체크 칸으로 동의 화면을 알아본다
    if (box) {
      if (!box.checked) { alert('연구 참여에 동의하셔야 평가를 시작할 수 있습니다.\n동의 칸에 체크해 주세요.'); return; }
      var withSession = this.pages.filter(function (p) { return p && p.session; })[0];
      if (withSession) withSession.session.consent = { agreed: true, time: new Date().toISOString(), text_version: '20261113' };
    }
    if (pg instanceof MushraPage && cur !== null && pg.mushraAudioControl) {
      var ev = LOG[cur] || [], conds = pg.mushraAudioControl.conditions || [];
      var played = {}, rated = {};
      ev.forEach(function (e) { if (e.e === 'play') played[e.s] = true; if (e.e === 'rate') rated[e.s] = true; });
      var notPlayed = [], untouched = [];
      if (!played.REF_OPEN) notPlayed.push('기준음');
      conds.forEach(function (c, i) {
        if (!played[c.id]) notPlayed.push((i + 1) + '번');
        if (!rated[c.id]) untouched.push((i + 1) + '번');
      });
      if (notPlayed.length) {
        push({ t: now(), e: 'blocked_unplayed', list: notPlayed.join(',') });
        alert('아직 한 번도 듣지 않은 소리가 있습니다: ' + notPlayed.join(', ') + '\n모든 소리를 한 번 이상 듣고 넘어가 주세요.');
        return;
      }
      if (untouched.length && !askedUntouched[cur]) {
        askedUntouched[cur] = true;
        var ok = confirm('슬라이더를 한 번도 움직이지 않은 소리가 있습니다: ' + untouched.join(', ') +
                         '\n지금 점수 그대로 둘까요?\n[확인] 그대로 넘어가기   [취소] 돌아가서 고치기');
        push({ t: now(), e: 'warned_untouched', list: untouched.join(','), kept: ok });
        if (!ok) return;
      }
    }
    return origNext.apply(this, arguments);
  };

  // ---------- 3) 마지막 설문 화면 정렬 ----------
  // 원본은 가운데 정렬 2열 표(왼쪽 질문, 오른쪽 입력)라 질문 길이에 따라 들쭉날쭉하다.
  // 질문을 위, 입력 칸을 아래에 두는 한 열(폭 640 px, 왼쪽 정렬)로 바꾼다. 질문·입력 id·저장 방식은 그대로.
  var css = document.createElement('style');
  css.textContent =
    'table.t18form{width:640px;max-width:92vw;margin:12px auto 20px auto;border-collapse:collapse}' +
    'table.t18form tr{display:block;margin:0 0 16px 0}' +
    'table.t18form td{display:block;text-align:left;padding:0;width:100%}' +
    'table.t18form td strong{font-weight:600}' +
    'table.t18form .t18hint{display:block;font-weight:400;color:#777;font-size:0.9em;margin-top:2px}' +
    'table.t18form .ui-input-text,table.t18form textarea{margin-top:6px}' +
    'table.t18form textarea{min-height:70px}' +
    // 평가 화면 폭: 원본은 버튼 폭 5.5em(88 px) × 12열 + 좌우 여백 7%라 창 폭 약 1270 px 미만에서 11번이 잘린다.
    // 버튼 폭을 4.3em으로, 좌우 여백을 12 px로 줄여 약 1000 px 창에서도 11개가 다 보이게 한다. 더 좁으면 가로 스크롤.
    '#container{padding-left:12px!important;padding-right:12px!important}' +
    '#page_content{overflow-x:auto!important}' +
    '#mushra_items .audioControlElement{width:4.3em!important;padding-left:2px!important;padding-right:2px!important}' +
    '#mushra_items td{padding-left:0!important;padding-right:0!important}';
  document.head.appendChild(css);
  if (typeof FinishPage !== 'undefined') {
    var origFinishRender = FinishPage.prototype.render;
    FinishPage.prototype.render = function (a) {
      var r = origFinishRender.apply(this, arguments);
      $(a).find('table').first().addClass('t18form');
      return r;
    };
  }

  // ---------- 1) 단축키 ----------
  var origBind = MushraAudioControlInputController.prototype.bind;
  MushraAudioControlInputController.prototype.bind = function () {
    origBind.apply(this, arguments);
    Mousetrap.unbind('0');                       // 원본: 0 = 기준음 → 해제(0은 10번에 씀)
  };
  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (!document.getElementById('buttonReference')) return;   // 평가 화면에서만
    var id = null;
    if (e.code === 'Backquote' || e.key === '₩' || e.key === '`') id = 'buttonReference';
    else if (e.code === 'Digit0' || e.code === 'Numpad0') id = 'buttonConditions9';
    else if (e.code === 'Minus' || e.code === 'NumpadSubtract' || e.key === '-') id = 'buttonConditions10';
    if (id === null) return;
    var el = document.getElementById(id);
    if (!el) return;
    e.preventDefault(); e.stopPropagation();
    $(el).click();
  }, true);
})();
