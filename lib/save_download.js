// GitHub Pages용: 서버(service/write.php) 대신 결과를 참가자 컴퓨터에 JSON 파일로 저장한다.
// 저장 내용은 serve_mushra.py가 받던 sessionJSON과 같다(변환은 청취평가_준비/code/json_to_csv.py).
// 같은 내용을 브라우저 localStorage에도 백업한다.
(function () {
  function stamp() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }
  DataSender.prototype.send = function (session) {
    try {
      var pid = 'unknown';
      try {
        var names = session.participant.name, resp = session.participant.response;
        var i = names.indexOf('pid');
        if (i >= 0 && resp[i]) pid = String(resp[i]).replace(/[^\w\-]+/g, '-');
      } catch (e) {}
      var ts = stamp();
      var text = JSON.stringify(session, null, 1);
      var fname = session.testId + '_' + pid + '_' + ts + '.json';
      try { localStorage.setItem('webmushra_' + fname, text); } catch (e) {}
      var blob = new Blob([text], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = fname;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
      alert('결과 파일이 저장되었습니다:\n' + fname + '\n\n연구자에게 알려 주세요.');
      return false; // false = 오류 없음
    } catch (e) {
      console.log(e);
      return true;
    }
  };
})();
