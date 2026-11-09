// 6화면 설정 전용 재생 수정. main_v3에는 적용되지 않는다.
// 문제: webMUSHRA 원본 stop()은 재생 위치를 즉시 파일 처음(무음)으로 옮겨, 5 ms 페이드가 시작되기 전에 파형이 끊긴다(클릭).
//       다음 화면으로 넘어갈 때도 freeAudio()가 같은 stop() 뒤 바로 연결을 끊는다.
// 수정: 페이드아웃을 먼저 끝낸 뒤 위치를 처음으로 되돌리고, 연결 해제를 페이드 뒤로 미룬다. 자극·점수·순서는 바꾸지 않는다.
(function () {
  if (!/[?&]config=six_/.test(location.search)) return;
  var origProcess = MushraAudioControl.prototype.process;
  MushraAudioControl.prototype.stop = function () {
    if (this.audioPlaying === true) {
      this.__rewindAfterFade = true;
      this.fadeOut(null);
    } else {
      this.audioCurrentPositionRequest = this.audioLoopStart;
    }
    this.sendEvent({ name: 'stopTriggered', conditionLength: this.conditions.length });
    this.sendEvent({ name: 'processUpdate', currentSample: this.audioLoopStart, sampleRate: this.audioSampleRate });
  };
  MushraAudioControl.prototype.process = function (e) {
    origProcess.call(this, e);
    if (this.__rewindAfterFade && this.audioPlaying === false) {
      this.__rewindAfterFade = false;
      this.audioCurrentPosition = this.audioLoopStart;
    }
  };
  MushraAudioControl.prototype.freeAudio = function () {
    this.stop();
    var src = this.dummyBufferSource, node = this.scriptNode;
    this.dummyBufferSource = null; this.scriptNode = null;
    setTimeout(function () {       // 버퍼 2개 + 페이드가 끝날 시간
      src.disconnect(); node.disconnect(); node.onaudioprocess = null;
    }, 400);
  };
})();
