# 공간 음향 유사도 청취 평가 (main_v3)

webMUSHRA 1.4.3 기반 청취 평가 사이트입니다. 접속하면 `?config=main_v3.yaml`로 바로 시작합니다.

## 결과 저장
이 사이트는 서버가 없습니다. 마지막 화면에서 **Send Results**를 누르면 결과가
`main_v3_<참가자코드>_<시각>.json` 파일로 참가자 컴퓨터의 다운로드 폴더에 저장됩니다
(같은 내용이 브라우저 localStorage에도 백업됨). 아무 데이터도 외부로 전송되지 않습니다.

## 자극 음원 출처와 라이선스
`configs/resources/audio/v3/`의 음원은 아래 자료를 컨볼루션·필터링해 만든 파생물입니다.

- 음원: Beethoven Symphony No. 8 op. 93, multi-channel anechoic orchestra recording (TU Berlin) — CC BY 4.0
- 목표 IR: BRAS – Benchmark for Room Acoustical Simulation, scene CR3 (Konzerthaus Berlin, small hall), DOI [10.14279/depositonce-6726.3](https://doi.org/10.14279/depositonce-6726.3) — CC BY-SA 4.0
- 목표 IR: Detmold SRIR database (Brahmssaal, Sommertheater, Konzerthaus), DOI [10.5281/zenodo.4007388](https://doi.org/10.5281/zenodo.4007388) — CC BY 4.0
- 재생 공간 IR: 지성관 연주홀 자체 측정 (2026-11-04)

CR3 기반 자극은 BRAS의 조건에 따라 **CC BY-SA 4.0**으로 배포합니다. 나머지 자극은 CC BY 4.0입니다.

## 6화면 평가 설정
`configs/six_*.yaml`은 목표 BRAS CR3 MP3 × 음악, 음성, 타악 × P04, P08의 6화면 설정입니다. 화면마다 B, C, D, E, F, 앵커, 숨긴 기준음을 평가합니다.

- `six_listener.yaml`: 청취자용. 방법 이름을 숨기고 순서를 섞습니다. E, F는 자리별 추가 보정 없음.
- `six_review.yaml`: 검토용. 방법 이름을 표시합니다. E, F는 자리별 추가 보정 없음.
- `six_review_seatfit.yaml`: 검토용. E, F를 그 자리에서 기준음 음량에 맞춥니다.

`configs/resources/audio/v6/`의 추가 음원 출처는 다음과 같습니다.

- 음성: ARU Speech Corpus (University of Liverpool), DOI [10.17638/datacat.liverpool.ac.uk/681](https://doi.org/10.17638/datacat.liverpool.ac.uk/681) — CC BY
- 타악: Bang & Olufsen, Music for Archimedes, track 26 (CD B&O 101), © Bang & Olufsen 1992. 연구 청취평가 목적으로 발췌해 사용했습니다. 이 저장소의 라이선스는 `percA_*` 파일에 적용되지 않습니다.

위 CC BY-SA 안내는 `percA_*`를 제외한 CR3 기반 자극에 적용합니다. `lib/audio_fix.js`는 Stop 시 페이드 뒤 정지하는 수정으로, `six_*` 설정에서만 동작합니다.

## 소프트웨어
webMUSHRA (International Audio Laboratories Erlangen / Fraunhofer IIS) — `LICENSE.txt`, `THIRD-PARTY-NOTICES.txt` 참고.
바꾼 점: `lib/save_download.js`(결과를 서버 대신 파일로 저장)와 `lib/load_fix.js`(화면마다 그 화면의 음원만 들어가기 직전에 받고 다음 평가 화면 1개만 미리 받음, 같은 음원은 한 번만, 동시에 6개씩, 실패 시 재시도) 추가, `index.html`에 두 스크립트와 기본 설정 연결 추가, 이 평가에 쓰지 않는 three.js(3D 화면용) 제거.
음원은 로딩 시간을 줄이려고 원본 WAV(24-bit, 48 kHz)를 무손실 FLAC으로 바꿨습니다(269 MB → 49 MB). 85개 모두 원본과 샘플 단위로 같음을 확인했고, `main_v3.yaml`은 확장자만 바뀌었습니다.
