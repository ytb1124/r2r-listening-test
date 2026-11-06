// 배포판 음원 불러오기 수정 (webMUSHRA 1.4.3의 AudioFileLoader.startLoading 대체).
// 원본은 같은 파일을 여러 번(약 170회, 560 MB) 동시에 요청하고, 하나라도 실패·지연되면 끝없이 로딩한다.
// 여기서는 같은 주소는 한 번만 받아 같은 AudioBuffer를 모든 사용처에 넘기고,
// 동시에 6개씩 받으며, 실패하면 3번까지 다시 시도하고, 진행 상황을 화면에 보여 준다.
(function () {
  var CONC = 6, RETRY = 3;
  function status(t) {
    var el = document.getElementById('load_fix_status');
    if (!el) {
      el = document.createElement('div');
      el.id = 'load_fix_status';
      el.style.cssText = 'position:fixed;left:0;right:0;bottom:16px;text-align:center;font:14px sans-serif;color:#333;z-index:99999';
      document.body.appendChild(el);
    }
    el.innerHTML = t;
  }
  function getBuf(url, tries) {
    return fetch(url, { cache: 'force-cache' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.arrayBuffer();
    }).catch(function (e) {
      if (tries > 1) return new Promise(function (ok) { setTimeout(ok, 1500); }).then(function () { return getBuf(url, tries - 1); });
      throw new Error(url + ': ' + e.message);
    });
  }
  AudioFileLoader.prototype.startLoading = function (done) {
    var self = this, files = this.files.slice();
    this.callbackSuccess = done;
    if (files.length === 0) { done(); return; }
    var byUrl = {}, urls = [];
    files.forEach(function (f) {
      if (!byUrl[f.url]) { byUrl[f.url] = []; urls.push(f.url); }
      byUrl[f.url].push(f);
    });
    var next = 0, finished = 0, failed = false;
    status('음원 불러오는 중 0 / ' + urls.length);
    function work() {
      if (failed || next >= urls.length) return Promise.resolve();
      var url = urls[next++];
      return getBuf(url, RETRY).then(function (ab) {
        return new Promise(function (ok, bad) { self.audioContext.decodeAudioData(ab, ok, bad); });
      }).then(function (buf) {
        byUrl[url].forEach(function (f) { f.callback(buf, f.callbackArgument); });
        finished++;
        status('음원 불러오는 중 ' + finished + ' / ' + urls.length);
        return work();
      });
    }
    var workers = [];
    for (var i = 0; i < CONC; i++) workers.push(work());
    Promise.all(workers).then(function () {
      self.files = [];
      status('');
      done();
    }).catch(function (e) {
      failed = true;
      console.log(e);
      status('<b style="color:#c00">음원을 불러오지 못했습니다. 새로고침해 주세요.</b><br><small>' + String(e.message || e) + '</small>');
    });
  };
})();
