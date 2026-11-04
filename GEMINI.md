# 🏠 중개노트 / 임장노트 (showing-note) 작업 규칙

## 🚨 0. 최우선 시스템 안정성 규칙 (서버 재시작 / 깜빡임 원천 방지)
- 이 PC의 D드라이브는 NTFS가 아닌 파일시스템(exFAT 등) 및 한글 경로 특성으로 인해, `run_command` 도구를 `BypassSandbox: false`(기본 샌드박스 모드)로 호출하면 Windows 보안 샌드박스가 충돌하여 내부 서버가 즉시 재시작(`server restart` / 화면 깜빡임)됩니다.
- **절대 파일 조회나 텍스트 수정 용도로 `run_command`(`powershell`, `python`, `Get-ChildItem`, `git` 등)를 호출하지 마세요!**
- 파일 읽기는 반드시 **`read_file`**, 파일 수정은 반드시 **`edit_file`** (또는 **`write_file`**) 도구만 사용하세요. (`read_file`과 `edit_file`은 샌드박스를 거치지 않아 100% 안전하게 작동합니다.)
- 만약 `edit_file`이 줄바꿈/공백 차이로 실패하더라도 절대 터미널 명령어(`run_command`)로 우회하지 말고, `read_file`로 해당 줄을 다시 정확히 읽은 뒤 `edit_file`로 수정하세요.
- 배포 등을 위해 부득이하게 `run_command`를 실행해야 할 때는 첫 시도부터 반드시 **`BypassSandbox: true`** 로 설정하여 호출하세요.


이 폴더(`D:\부동산업무\antigravity\showing-note`)는 **중개노트(임장노트)** 전용 작업 공간입니다.

## 1. 핵심 파일 및 안드로이드 연동 구조
- **`index.html`:** 중개노트 메인 앱 파일 (매물 카드, 단지 그룹핑, 세입자/메모, 비밀번호 잠금 등 모든 기능 포함)
- **`guide.html`:** 사용 설명서 및 안내 페이지
- **안드로이드 앱 동기화 경로:**
  - `index.html` 또는 `guide.html`을 수정한 뒤에는 반드시 안드로이드 앱 에셋 폴더(`D:\부동산업무\antigravity\showing_note_android\app\src\main\assets\`)에도 동일 파일을 복사해 동기화하세요.

## 2. AI 에이전트 필수 주의사항
1. **임시 파이썬/테스트 파일(`check_*.py`, `inspect_*.py`, `verify_*.py`, `.png`) 생성 및 방치 금지:**
   - 폴더가 무거워지면 Antigravity 내부 서버가 재시작(화면 깜빡임)됩니다.
   - 파일 수정은 기본 편집 도구를 사용해 깔끔하게 한 번에 적용하세요.
2. **기존 데이터 구조(`localStorage`) 보존:**
   - 사용자가 저장한 매물·단지 데이터와 호환성이 깨지지 않도록 주의하세요.
