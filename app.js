const STORAGE_KEY_SETTINGS = 'showing_diary_settings';
    const STORAGE_KEY_PROPERTIES = 'showing_diary_properties';
    const STORAGE_KEY_SHOWINGS = 'showing_diary_showings';
    const STORAGE_KEY_SESSIONS = 'showing_diary_sessions';
    const STORAGE_KEY_SNAPSHOTS = 'showing_diary_snapshots';
    const MAX_FREE_PROPERTIES = 100; // 개인 무료 플랜 최대 보관 매물 한도

    let settings = { pin: '0000', dongs: [], baseDistrict: '' };
    let properties = [];
    let showings = [];
    let showingSessions = []; // 손님별 쇼잉 세션 (날짜 + 전화번호 + 태그 매핑 + 피드백)
    let activeSessionId = null; // 현재 선택된 쇼잉 세션 (장바구니 모드)
    let isFilteringSessionOnly = false; // true: 손님에게 담긴 집만 보기, false: 전체 매물 보면서 장바구니에 담기
    let currentDongFilter = 'ALL';
    let currentSortBy = 'schedule'; // 기본: 일정 빠른순!
    let enteredPin = '';

    function setSortBy(mode) {
      currentSortBy = mode;
      renderApp();
      checkInitialPinBanner();
    }

    window.addEventListener('DOMContentLoaded', () => {
      loadData();
      checkVaultRecoveryOnStartup();
      initDefaultDataIfEmpty();
      migrateLegacyShowingsToSessions(); // 기존 매물 아래 쇼잉 ➜ 새 손님 세션으로 100% 자동 이전
      renderApp();
      checkInitialPinBanner();
      if (sessionStorage.getItem('unlocked') === 'true') {
        document.getElementById('lockScreen').style.display = 'none';
      }
    });

    function loadData() {
      try {
        const s = localStorage.getItem(STORAGE_KEY_SETTINGS); if (s) settings = JSON.parse(s);
        const p = localStorage.getItem(STORAGE_KEY_PROPERTIES);
        if (p) {
          // Schema healing & backward compatibility
          properties = JSON.parse(p).map(item => ({
            id: item.id || 'prop-' + Date.now(),
            dong: item.dong || (settings.dongs && settings.dongs[0]) || '',
            jibun: item.jibun || '',
            ho: item.ho || '',
            building: item.building || item.buildingName || '',
            bDong: (item.bDong && item.bDong.trim() !== '') ? item.bDong.trim() : '0',
            doorPw: item.doorPw || '',
            commonPw: item.commonPw || '',
            ownerName: item.ownerName || '',
            ownerPhone: item.ownerPhone || '',
            tenantName: item.tenantName || '',
            tenantPhone: item.tenantPhone || '',
            propMemo: item.propMemo || ''
          }));
        }
        const sh = localStorage.getItem(STORAGE_KEY_SHOWINGS);
        if (sh) {
          showings = JSON.parse(sh).map(item => ({
            id: item.id || 's-' + Date.now(),
            propertyId: item.propertyId,
            date: item.date || getTodayString(),
            time: item.time || '14:00',
            clientPhone: item.clientPhone || '',
            clientName: item.clientName || '손님',
            memo: item.memo || '',
            feedback: item.feedback || '',
            status: item.status || 'pending'
          }));
        }
        const ss = localStorage.getItem(STORAGE_KEY_SESSIONS);
        if (ss) {
          showingSessions = JSON.parse(ss).map(item => ({
            id: item.id || 'sess-' + Date.now(),
            date: item.date || getTodayString(),
            time: item.time || '14:00',
            phone: item.phone || '',
            clientName: item.clientName || '',
            memo: item.memo || '',
            propertyIds: Array.isArray(item.propertyIds) ? item.propertyIds : [],
            feedbackMap: item.feedbackMap || {}, // { [propId]: feedbackText }
            status: item.status || 'active' // 'active' or 'finished'
          }));
        }
      } catch(e){}
    }

    /* 전화번호 포맷 헬퍼 */
    function formatPhone(raw) {
      if (!raw) return '';
      const clean = String(raw).replace(/[^0-9]/g, '');
      if (clean.length === 11) {
        return clean.replace(/^(\d{3})(\d{4})(\d{4})$/, '$1-$2-$3');
      } else if (clean.length === 10) {
        if (clean.startsWith('02')) {
          return clean.replace(/^(\d{2})(\d{4})(\d{4})$/, '$1-$2-$3');
        } else {
          return clean.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3');
        }
      } else if (clean.length === 9 && clean.startsWith('02')) {
        return clean.replace(/^(\d{2})(\d{3})(\d{4})$/, '$1-$2-$3');
      } else if (clean.length === 4) {
        return clean; // 뒷 4자리만 입력한 경우
      }
      return raw.trim();
    }

    /* 기존 매물에 붙어있던 구버전 showings ➜ 새로운 손님 세션으로 100% 안전 자동 이전 */
    function migrateLegacyShowingsToSessions() {
      try {
        if (!showings || showings.length === 0) return;
        let hasMigrated = false;

        showings.forEach(s => {
          const rawPhone = s.clientPhone || '';
          const phone = rawPhone ? formatPhone(rawPhone) : (s.clientName || '손님');
          
          // 이미 동일 손님/날짜 세션이 있는지 확인
          let existingSession = showingSessions.find(sess => 
            (sess.phone === phone || (rawPhone && sess.phone.includes(rawPhone.slice(-4)))) &&
            sess.date === s.date
          );

          if (!existingSession) {
            existingSession = {
              id: 'sess-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
              date: s.date || getTodayString(),
              time: s.time || '14:00',
              phone: phone,
              clientName: s.clientName || '손님',
              memo: s.memo || '',
              propertyIds: [],
              feedbackMap: {},
              status: 'active'
            };
            showingSessions.push(existingSession);
            hasMigrated = true;
          }

          if (s.propertyId && !existingSession.propertyIds.includes(s.propertyId)) {
            existingSession.propertyIds.push(s.propertyId);
            hasMigrated = true;
          }

          if (s.feedback && s.propertyId) {
            if (!existingSession.feedbackMap) existingSession.feedbackMap = {};
            if (!existingSession.feedbackMap[s.propertyId]) {
              existingSession.feedbackMap[s.propertyId] = s.feedback;
              hasMigrated = true;
            }
          }
        });

        if (hasMigrated) {
          saveData(false);
        }
      } catch(err) {
        console.error('Migration error:', err);
      }
    }

    function pushSnapshot() {
      try {
        const snaps = JSON.parse(localStorage.getItem(STORAGE_KEY_SNAPSHOTS) || '[]');
        snaps.unshift({
          timestamp: new Date().toISOString(),
          properties: properties,
          showings: showings,
          showingSessions: showingSessions
        });
        if (snaps.length > 5) snaps.length = 5;
        localStorage.setItem(STORAGE_KEY_SNAPSHOTS, JSON.stringify(snaps));
      } catch(e){}
    }

    function restoreLatestSnapshot() {
      try {
        const snaps = JSON.parse(localStorage.getItem(STORAGE_KEY_SNAPSHOTS) || '[]');
        if (snaps.length < 2) {
          alert('되돌릴 수 있는 이전 저장 기록이 아직 없습니다.');
          return;
        }
        if (!confirm('직전 저장 상태로 데이터를 되돌리시겠습니까?')) return;
        const target = snaps[1]; // previous state
        properties = target.properties || [];
        showings = target.showings || [];
        showingSessions = target.showingSessions || [];
        saveData(false);
        renderApp();
        closeModal('settingsModal');
        showToast('🔄 직전 저장 상태로 복구되었습니다!');
      } catch(e){ alert('복구 중 오류가 발생했습니다.'); }
    }

    function saveData(createSnapshot = true) {
      if (createSnapshot) pushSnapshot();
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
      localStorage.setItem(STORAGE_KEY_PROPERTIES, JSON.stringify(properties));
      localStorage.setItem(STORAGE_KEY_SHOWINGS, JSON.stringify(showings));
      localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(showingSessions));
      syncVaultToNative();
    }

    /* --- AES-256 Web Crypto Vault Engine (앱 삭제 대비 영구 보존) --- */
    async function deriveVaultKey(pin, salt) {
      const enc = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        "raw", enc.encode(pin), { name: "PBKDF2" }, false, ["deriveKey"]
      );
      return crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
      );
    }

    function u8ToBase64(u8) {
      let s = '';
      for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
      return btoa(s);
    }

    function base64ToU8(b64) {
      const s = atob(b64);
      const u8 = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
      return u8;
    }

    async function encryptVault(dataObj, pin) {
      const enc = new TextEncoder();
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const key = await deriveVaultKey(pin, salt);
      const cipher = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        enc.encode(JSON.stringify(dataObj))
      );
      return JSON.stringify({
        type: "showing_note_encrypted_vault",
        v: "1.2.0",
        salt: u8ToBase64(salt),
        iv: u8ToBase64(iv),
        data: u8ToBase64(new Uint8Array(cipher)),
        savedAt: new Date().toISOString()
      });
    }

    async function decryptVault(bundleStr, pin) {
      const bundle = typeof bundleStr === 'string' ? JSON.parse(bundleStr) : bundleStr;
      if (bundle.type !== "showing_note_encrypted_vault") {
        throw new Error("올바른 암호화 금고 파일 형식이 아닙니다.");
      }
      const salt = base64ToU8(bundle.salt);
      const iv = base64ToU8(bundle.iv);
      const cipher = base64ToU8(bundle.data);
      const key = await deriveVaultKey(pin, salt);
      const decBuf = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        cipher
      );
      const dec = new TextDecoder();
      return JSON.parse(dec.decode(decBuf));
    }

    async function syncVaultToNative() {
      try {
        const payload = { settings, properties, showings, showingSessions, time: new Date().toISOString() };
        const encStr = await encryptVault(payload, settings.pin);
        localStorage.setItem('showing_note_encrypted_vault', encStr);
        if (window.AndroidBridge && window.AndroidBridge.saveEncryptedVault) {
          window.AndroidBridge.saveEncryptedVault(encStr);
        }
      } catch(e){}
    }

    async function exportEncryptedVaultFile() {
      try {
        const payload = { settings, properties, showings, showingSessions };
        const encStr = await encryptVault(payload, settings.pin);
        const blob = new Blob([encStr], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `중개사_쇼잉수첩_보안금고_${getTodayString()}.enc`;
        a.click();
        showToast('🔐 암호화 금고 파일이 안전하게 다운로드되었습니다');
      } catch(e) { alert('암호화 중 오류가 발생했습니다.'); }
    }

    function importEncryptedVaultFile(e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const pin = prompt('이 암호화 금고를 생성할 때 사용한 비밀번호(PIN)를 입력하세요:');
          if (!pin) return;
          const restored = await decryptVault(evt.target.result, pin);
          if (restored.properties) {
            settings = restored.settings || settings;
            properties = restored.properties || [];
            showings = restored.showings || [];
            showingSessions = restored.showingSessions || [];
            saveData(false);
            renderApp();
            showToast('🎉 암호화 금고에서 데이터가 100% 복원되었습니다!');
          }
        } catch(err) {
          alert('비밀번호가 맞지 않거나 손상된 파일입니다.');
        }
      };
      reader.readAsText(file);
    }

    async function checkVaultRecoveryOnStartup() {
      if (properties.length === 0) {
        let vaultStr = '';
        if (window.AndroidBridge && window.AndroidBridge.hasEncryptedVault && window.AndroidBridge.hasEncryptedVault()) {
          vaultStr = window.AndroidBridge.loadEncryptedVault();
        } else {
          vaultStr = localStorage.getItem('showing_note_encrypted_vault') || '';
        }

        if (vaultStr) {
          window._pendingVaultStr = vaultStr;
          setTimeout(() => openModal('vaultRecoveryModal'), 400);
        }
      }
    }

    async function submitVaultRecovery() {
      const pin = document.getElementById('vaultRecoveryPinInput').value.trim();
      if (!pin) return alert('비밀번호를 입력하세요.');
      try {
        const restored = await decryptVault(window._pendingVaultStr, pin);
        if (restored.properties) {
          settings = restored.settings || settings;
          properties = restored.properties || [];
          showings = restored.showings || [];
          showingSessions = restored.showingSessions || [];
          saveData(false);
          closeModal('vaultRecoveryModal');
          renderApp();
          showToast('🎉 이전 장부 데이터가 100% 복원되었습니다!');
        }
      } catch(err) {
        alert('비밀번호가 일치하지 않습니다.');
      }
    }

    function initDefaultDataIfEmpty() {
      // 신규 사용자를 위해 기본 샘플 매물은 생성하지 않고 비워둡니다.
      if (false && properties.length === 0) {
        properties = [
          {
            id: 'prop-1',
            dong: '성산동',
            jibun: '234-12',
            ho: '201호',
            building: '성산아트빌',
            doorPw: '1357*',
            commonPw: '#1234*',
            ownerName: '임대인',
            ownerPhone: '010-3456-7890'
          },
          {
            id: 'prop-2',
            dong: '중동',
            jibun: '65-4',
            ho: '302호',
            building: '대우베스트',
            doorPw: '0089#',
            commonPw: '종0101',
            ownerName: '관리소장',
            ownerPhone: '010-9876-1234'
          }
        ];
        const today = getTodayString();
        showings = [
          {
            id: 's-1',
            propertyId: 'prop-1',
            date: today,
            time: '14:00',
            clientName: '직방 (5678)',
            clientPhone: '010-1234-5678',
            memo: '전세 2억3천선, 주차 확인 희망',
            feedback: ''
          },
          {
            id: 's-2',
            propertyId: 'prop-1',
            date: '2026-10-18',
            time: '11:00',
            clientName: 'LH/버팀목 (3321)',
            clientPhone: '010-5555-3321',
            memo: '',
            feedback: '채광 좋다고 마음에 들어함. 대출 한도 조회 후 재연락 주기로 함'
          },
          {
            id: 's-3',
            propertyId: 'prop-2',
            date: today,
            time: '16:30',
            clientName: '신혼부부 (8899)',
            clientPhone: '010-7777-8899',
            memo: '즉시입주 가능여부 체크',
            feedback: ''
          }
        ];
        saveData();
      }
    }

    /* RENDER CORE: ADDRESS FIRST, INDENTED SHOWINGS */
    
    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/\n/g, '<br>');
    }

    function onSearchInputChanged() {
      const input = document.getElementById('searchInput');
      const clearBtn = document.getElementById('btnSearchClear');
      if (clearBtn) {
        clearBtn.style.display = input.value.trim().length > 0 ? 'inline-flex' : 'none';
      }
      renderApp();
    }

    function clearSearchInput() {
      const input = document.getElementById('searchInput');
      const clearBtn = document.getElementById('btnSearchClear');
      input.value = '';
      if (clearBtn) clearBtn.style.display = 'none';
      input.focus();
      renderApp();
    }

    function renderApp() {
      renderDongPills();
      renderShowingSessionBar();
      renderShowingActiveBanner();

      const container = document.getElementById('addressCardsList');
      const searchWord = document.getElementById('searchInput').value.trim().toLowerCase();
      const today = getTodayString();

      const currentSession = activeSessionId ? showingSessions.find(s => s.id === activeSessionId) : null;

      // Filter properties
      let list = properties.filter(p => {
        // 특정 손님이 선택되어 있고 '담긴 집만 보기' 모드일 때만 필터링
        if (currentSession && isFilteringSessionOnly) {
          if (!currentSession.propertyIds.includes(p.id)) return false;
        }

        if (currentDongFilter === 'ARCHIVED') {
          if (!p.isArchived) return false;
        } else {
          if (p.isArchived) return false;
          if (currentDongFilter !== 'ALL' && p.dong !== currentDongFilter) return false;
        }

        if (searchWord) {
          const matchAddr = `${p.dong} ${p.jibun} ${p.bDong || ''} ${p.ho || ''} ${p.building || ''} ${p.tenantName || ''} ${p.tenantPhone || ''} ${p.propMemo || ''}`.toLowerCase();
          if (matchAddr.includes(searchWord)) return true;
          const pShows = showings.filter(s => s.propertyId === p.id);
          const matchClient = pShows.some(s => (s.clientName || '').toLowerCase().includes(searchWord) || (s.clientPhone || '').includes(searchWord));
          return matchClient;
        }
        return true;
      });

      if (list.length === 0) {
        const activeCount = properties.filter(p => !p.isArchived).length;
        const countEl = document.getElementById('propCount');
        if (currentSession && isFilteringSessionOnly) {
          countEl.innerHTML = `🛒 <b style="color:#2563eb;">${escapeHtml(currentSession.phone)}</b> 손님 바구니: <b>0곳 담김</b>`;
          container.innerHTML = `
            <div style="text-align:center; padding: 36px 16px; background:#eff6ff; border-radius:16px; border:1.5px dashed #93c5fd; margin-top:8px;">
              <div style="font-size:36px; margin-bottom:8px;">🛒</div>
              <h3 style="font-size:16px; font-weight:800; color:#1e40af; margin-bottom:6px;">
                [${escapeHtml(currentSession.phone)}] 손님 장바구니가 아직 비어 있습니다
              </h3>
              <p style="font-size:13px; color:#475569; line-height:1.5; margin-bottom:16px;">
                아래 <b>[전체 매물 둘러보며 담기]</b> 버튼을 누르면, 모든 집 카드 옆에 <b>[🛒 담기]</b> 버튼이 표시됩니다!
              </p>
              <button type="button" onclick="toggleSessionFilterMode(false)" style="background:#2563eb; color:white; border:none; padding:11px 20px; border-radius:10px; font-size:14px; font-weight:800; cursor:pointer; box-shadow:0 3px 8px rgba(37,99,235,0.25);">
                🛒 전체 매물 둘러보며 담기
              </button>
            </div>
          `;
          return;
        }
        if (currentDongFilter === 'ARCHIVED') {
          countEl.innerHTML = `📦 보관된 매물: <b style="color:#64748b;">0개</b>`;
        } else {
          countEl.innerHTML = `📦 보관함: <b style="color:#2563eb;">${activeCount}</b> / ${MAX_FREE_PROPERTIES}개 <span style="font-size:11px; color:#64748b; font-weight:normal;">(무료 플랜)</span>`;
        }
        if (!settings.dongs || settings.dongs.length === 0) {
          container.innerHTML = `
            <div style="text-align:center; padding: 36px 20px; background:#ffffff; border-radius:14px; border:1.5px dashed #cbd5e1; margin-top:10px;">
              <div style="font-size:38px; margin-bottom:8px;">📍</div>
              <h3 style="font-size:16px; font-weight:800; color:#1e293b; margin-bottom:6px;">활동 지역(동)을 먼저 설정해 주세요</h3>
              <p style="font-size:13px; color:#64748b; line-height:1.5; margin-bottom:16px;">
                현재 등록된 활동 동이 없습니다.<br>
                자주 활동하시는 구/동을 등록하시면 매물 관리와 주소 입력이 훨씬 편리해집니다.
              </p>
              <button type="button" onclick="openSettingsModal()" style="background:#1d4ed8; color:white; border:none; padding:10px 18px; border-radius:8px; font-size:13.5px; font-weight:800; cursor:pointer;">
                ⚙️ 활동 지역 설정하러 가기
              </button>
            </div>
          `;
        } else {
          const rawSearchWord = document.getElementById('searchInput').value.trim();
          const targetDong = (currentDongFilter !== 'ALL' && currentDongFilter !== 'ARCHIVED') ? currentDongFilter : (settings.dongs[0] || '');
          const escapedSearchWord = escapeHtml(rawSearchWord);
          
          if (rawSearchWord) {
            container.innerHTML = `
              <div style="text-align:center; padding: 40px 16px; background:#ffffff; border-radius:16px; border:1.5px dashed #cbd5e1; margin-top:8px; box-shadow:0 2px 8px rgba(0,0,0,0.03);">
                <div style="font-size:38px; margin-bottom:10px;">🔍</div>
                <h3 style="font-size:16px; font-weight:800; color:#1e293b; margin-bottom:6px;">
                  '<span style="color:#2563eb;">${escapedSearchWord}</span>' 등록 매물이 없습니다
                </h3>
                <p style="font-size:13px; color:#64748b; line-height:1.5; margin-bottom:18px;">
                  새로운 매물인가요? 입력하신 주소로 바로 등록할 수 있습니다.
                </p>
                <button type="button" onclick="openNewPropertyModal('${targetDong}', '${escapedSearchWord}')" style="
                  width: 100%;
                  max-width: 320px;
                  background: #2563eb;
                  color: #ffffff;
                  border: none;
                  padding: 13px 18px;
                  border-radius: 10px;
                  font-size: 14.5px;
                  font-weight: 800;
                  cursor: pointer;
                  display: inline-flex;
                  align-items: center;
                  justify-content: center;
                  gap: 8px;
                  box-shadow: 0 4px 12px rgba(37,99,235,0.25);
                ">
                  <span>➕</span>
                  <span>'${escapedSearchWord}' 새 매물 바로 등록</span>
                </button>
              </div>
            `;
          } else {
            container.innerHTML = `
              <div style="text-align:center; padding: 40px 16px; background:#ffffff; border-radius:16px; border:1.5px dashed #cbd5e1; margin-top:8px;">
                <div style="font-size:38px; margin-bottom:10px;">🏡</div>
                <h3 style="font-size:16px; font-weight:800; color:#1e293b; margin-bottom:6px;">등록된 집이 없습니다</h3>
                <p style="font-size:13px; color:#64748b; line-height:1.5; margin-bottom:18px;">
                  첫 번째 매물 주소를 등록하고 현장 쇼잉을 관리해보세요.
                </p>
                <button type="button" onclick="openNewPropertyModal('${targetDong}', '')" style="
                  width: 100%;
                  max-width: 280px;
                  background: #2563eb;
                  color: #ffffff;
                  border: none;
                  padding: 13px 18px;
                  border-radius: 10px;
                  font-size: 14.5px;
                  font-weight: 800;
                  cursor: pointer;
                  display: inline-flex;
                  align-items: center;
                  justify-content: center;
                  gap: 8px;
                  box-shadow: 0 4px 12px rgba(37,99,235,0.25);
                ">
                  <span>➕</span>
                  <span>새 매물 등록하기</span>
                </button>
              </div>
            `;
          }
        }
        return;
      }

      // Sort Bar UI Update
      document.getElementById('sortScheduleBtn').classList.toggle('active', currentSortBy === 'schedule');
      document.getElementById('sortAddrBtn').classList.toggle('active', currentSortBy === 'address');
      // Active properties count (excluding archived ones)
      const activeCount = properties.filter(p => !p.isArchived).length;
      const countEl = document.getElementById('propCount');
      if (currentSession) {
        const basketCount = currentSession.propertyIds ? currentSession.propertyIds.length : 0;
        if (isFilteringSessionOnly) {
          countEl.innerHTML = `🛒 <b style="color:#2563eb;">${escapeHtml(currentSession.phone)}</b> 손님 바구니: <b style="color:#1d4ed8;">${basketCount}곳</b> 담김`;
        } else {
          countEl.innerHTML = `🛒 <b style="color:#2563eb;">${escapeHtml(currentSession.phone)}</b> 손님 장바구니 담는 중 (${basketCount}곳 담김)`;
        }
      } else if (currentDongFilter === 'ARCHIVED') {
        countEl.innerHTML = `📦 보관된 매물: <b style="color:#64748b;">${list.length}개</b>`;
      } else {
        let countColor = '#2563eb';
        if (activeCount >= MAX_FREE_PROPERTIES) countColor = '#dc2626';
        else if (activeCount >= 80) countColor = '#d97706';
        countEl.innerHTML = `📦 보관함: <b style="color:${countColor};">${activeCount}</b> / ${MAX_FREE_PROPERTIES}개 <span style="font-size:11px; color:#64748b; font-weight:normal;">(무료 플랜)</span>`;
      }

      // GROUPING LOGIC: Group by (dong + '___' + jibun)
      const complexMap = new Map();
      list.forEach(p => {
        const key = `${p.dong}___${p.jibun}`;
        if (!complexMap.has(key)) {
          complexMap.set(key, {
            dong: p.dong,
            jibun: p.jibun,
            building: p.building || '',
            props: []
          });
        }
        const group = complexMap.get(key);
        if (!group.building && p.building) {
          group.building = p.building;
        }
        group.props.push(p);
      });

      const complexList = Array.from(complexMap.values());

      // Helper to find nearest upcoming showing for any prop in complex
      function getNearestUpcomingShowing(props) {
        const allShows = [];
        props.forEach(p => {
          showings.filter(s => s.propertyId === p.id && s.date >= today).forEach(s => {
            allShows.push({ s, prop: p });
          });
        });
        if (allShows.length === 0) return null;
        allShows.sort((a, b) => (a.s.date + a.s.time).localeCompare(b.s.date + b.s.time));
        return allShows[0];
      }

      // Sort Complex List
      complexList.sort((a, b) => {
        if (currentSortBy === 'schedule') {
          const aUp = getNearestUpcomingShowing(a.props);
          const bUp = getNearestUpcomingShowing(b.props);
          if (aUp && bUp) {
            return (aUp.s.date + aUp.s.time).localeCompare(bUp.s.date + bUp.s.time);
          }
          if (aUp && !bUp) return -1;
          if (!aUp && bUp) return 1;
        }
        return `${a.dong} ${a.jibun}`.localeCompare(`${b.dong} ${b.jibun}`, 'ko');
      });

      // RENDER ALL COMPLEXES
      let html = '';
      complexList.forEach(complex => {
        const fullAddr = `${settings.baseDistrict} ${complex.dong} ${complex.jibun}`;
        const naverUrl = `https://m.map.naver.com/search2/search.naver?query=${encodeURIComponent(fullAddr)}`;
        
        // Nearest showing badge for the whole complex (if any)
        const nearestComplexShow = getNearestUpcomingShowing(complex.props);
        const complexBadge = nearestComplexShow ? `
          <span style="display:inline-flex; align-items:center; gap:4px; background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; font-size:12px; font-weight:800; padding:2px 8px; border-radius:6px; margin-left:4px;">
            ⏰ ${formatDateLabel(nearestComplexShow.s.date)} ${nearestComplexShow.s.time} (${nearestComplexShow.prop.bDong && nearestComplexShow.prop.bDong !== '0' ? nearestComplexShow.prop.bDong + ' ' : ''}${nearestComplexShow.prop.ho || ''})
          </span>
        ` : '';

        // Group props by building Dong (bDong)
        // bDong: '0' means general villa/single building without specific dong name
        const dongMap = new Map();
        complex.props.forEach(p => {
          const bDong = (p.bDong && p.bDong.trim() !== '') ? p.bDong.trim() : '0';
          if (!dongMap.has(bDong)) {
            dongMap.set(bDong, []);
          }
          dongMap.get(bDong).push(p);
        });

        // Sort dongs: '0' first, or alphanumerical (101동, 102동)
        const sortedDongs = Array.from(dongMap.keys()).sort((a, b) => {
          if (a === '0') return -1;
          if (b === '0') return 1;
          return a.localeCompare(b, undefined, { numeric: true });
        });

        // Common building name or fallback
        const complexBuildingName = complex.building || (complex.props.find(p => p.building)?.building || '');

        html += `
          <div class="complex-card">
            <!-- Complex Top Header (주소 + 건물명 한 줄 통합 & 주소 클릭 시 지도 연동) -->
            <div class="complex-header">
              <div class="complex-top-row">
                <div class="complex-addr-title">
                  <span class="star-bullet">★</span>
                  <a href="${naverUrl}" target="_blank" class="complex-addr-link" title="터치하면 네이버 지도로 열립니다">
                    <span class="addr-dong-badge">${complex.dong}</span>
                    <span style="text-decoration: underline; text-underline-offset: 3px; text-decoration-color: #94a3b8;">${complex.jibun}</span>
                    ${complexBuildingName ? `<span style="font-size: 15px; font-weight: 800; color: #3b82f6; margin-left: 2px;">(${escapeHtml(complexBuildingName)})</span>` : ''}
                  </a>
                  ${complexBadge}
                </div>
              </div>
            </div>

            <!-- Building Dong Groups -->
            <div class="complex-dongs-container">
        `;

        sortedDongs.forEach(bDong => {
          const allPropsInDong = dongMap.get(bDong);
          // Common password for this dong (shared among units)
          const dongCommonPw = allPropsInDong.find(p => p.commonPw && p.commonPw.trim() !== '')?.commonPw || '';
          const isRealDong = (bDong !== '0');

          // 진짜 호수(유닛) 매물만 필터링 (호수가 있는 매물이 1개라도 있으면, 호수 없는 껍데기 카드는 목록에서 자동 숨김)
          const realUnitProps = allPropsInDong.filter(p => p.ho && p.ho.trim() !== '');
          const propsInDong = realUnitProps.length > 0 ? realUnitProps : allPropsInDong;

          html += `
            <div class="dong-group-section">
              <!-- Dong Header (If apartment/multi-dong: show dong name; if villa: show clean common-pw line) -->
              <div class="dong-group-header">
                <div style="display:flex; align-items:center; gap:6px;">
                  ${isRealDong ? `
                    <span class="dong-group-badge">🏢 ${escapeHtml(bDong)}</span>
                    <span style="font-size:12px; color:#64748b;">(매물 ${propsInDong.length}건)</span>
                  ` : `
                    <span style="font-size:13px; font-weight:800; color:#334155;">🏠 매물 ${propsInDong.length}건</span>
                  `}
                  <button type="button" onclick="openNewPropertyModal('${complex.dong}', '${complex.jibun}', '${isRealDong ? escapeHtml(bDong) : ''}', '${escapeHtml(complexBuildingName)}', '${dongCommonPw}')" style="background:#ffffff; border:1px solid #93c5fd; color:#2563eb; font-size:11px; font-weight:800; padding:2px 7px; border-radius:5px; cursor:pointer;">
                    ➕ 호수 추가
                  </button>
                </div>
                <div class="dong-common-pw-badge" style="cursor:pointer;" onclick="promptEditDongCommonPw('${complex.dong}', '${complex.jibun}', '${bDong}', '${dongCommonPw}')" title="클릭하여 공동현관 비번 수정">
                  🔑 공동: <span>${dongCommonPw || '없음'}</span> <span style="font-size:10px; color:#64748b; margin-left:2px;">✏️</span>
                </div>
              </div>

              <!-- Units inside this Dong -->
              <div class="dong-units-list">
          `;

          // Sort units by ho (e.g. 101호, 201호, 302호)
          propsInDong.sort((a, b) => (a.ho || '').localeCompare(b.ho || '', undefined, { numeric: true }));

          propsInDong.forEach(p => {
            // Unit showings
            const pShows = showings.filter(s => s.propertyId === p.id);
            const upcomingShows = pShows
              .filter(s => s.date >= today)
              .sort((a,b) => (a.date + a.time).localeCompare(b.date + b.time));
            const pastShows = pShows
              .filter(s => s.date < today)
              .sort((a,b) => (b.date + b.time).localeCompare(a.date + a.time));

            const nearestShowing = upcomingShows[0];
            const unitScheduleBadge = nearestShowing ? `
              <span style="display:inline-flex; align-items:center; gap:3px; background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; font-size:11.5px; font-weight:800; padding:2px 7px; border-radius:5px;">
                ⏰ ${formatDateLabel(nearestShowing.date)} ${nearestShowing.time}
              </span>
            ` : '';

            html += `
              <div class="unit-card-item">
                <!-- Unit Header Row (Ho, Door PW, Schedule badge) -->
                <div class="unit-header-row">
                  <div style="display:flex; align-items:center; gap:6px;">
                    <span class="unit-ho-tag" style="${p.ho ? '' : 'background:#eff6ff; color:#1e40af; border-color:#bfdbfe;'}">${p.ho ? `🚪 ${escapeHtml(p.ho)}` : (isRealDong ? `🏢 ${escapeHtml(bDong)}` : '🏢 건물')}</span>
                    ${unitScheduleBadge}
                    ${renderUnitShowingBasketBtn(p.id)}
                  </div>
                  <div class="unit-door-pw">
                    ${p.ho ? '세대 도어락' : '🔑 공동현관'}: <span>${p.ho ? (p.doorPw || '미등록') : (p.commonPw || p.doorPw || '미등록')}</span>
                  </div>
                </div>

                <!-- 쇼잉 투어 모드일 때 매물 피드백 빠른 입력창 -->
                ${renderUnitFeedbackInSession(p.id)}

                <!-- Slim Accordion Toggle Button: 기본 상태는 깔끔하게 접어두고 필요시만 펼치기 -->
                <button type="button" class="btn-unit-toggle" id="toggleBtn_${p.id}" onclick="toggleUnitDetail('${p.id}')">
                  <span>📋 상세 정보 & 연락처</span>
                  <span id="toggleArrow_${p.id}" style="font-size:11px; color:#64748b;">▼ 펼치기</span>
                </button>

                <!-- Collapsible Detailed Area -->
                <div class="unit-collapsible-detail" id="unitDetail_${p.id}">
                  <!-- Unit Contacts Row (Tenant & Owner Call Buttons) -->
                  <div class="unit-contacts-row">
                    ${p.tenantPhone ? `
                      <a href="tel:${p.tenantPhone}" class="btn-tenant-call" style="background:#e0f2fe; border:1px solid #bae6fd; border-radius:6px; padding:5px 10px; font-size:12px; font-weight:800; color:#0369a1; text-decoration:none;">📞 세입자(${escapeHtml(p.tenantName || '거주자')}) 통화</a>
                    ` : ''}
                    ${p.ownerPhone ? `
                      <a href="tel:${p.ownerPhone}" class="btn-owner-call" style="background:#fef3c7; border:1px solid #fde68a; border-radius:6px; padding:5px 10px; font-size:12px; font-weight:800; color:#92400e; text-decoration:none;">📞 ${escapeHtml(p.ownerName || '임대인')} 통화</a>
                    ` : ''}
                    ${!p.tenantPhone && !p.ownerPhone ? `<span style="font-size:12px; color:#94a3b8;">등록된 세입자/임대인 연락처 없음</span>` : ''}
                  </div>

                  <!-- Unit Special Memo (if any) -->
                  ${p.propMemo ? `
                    <div class="unit-memo-box">
                      <span style="font-size:14px; line-height:1;">💡</span>
                      <span style="flex:1; line-height:1.4;">${escapeHtml(p.propMemo)}</span>
                    </div>
                  ` : ''}

                  <!-- Unit Actions Row: 수정/정리 버튼을 깔끔하게 배치 -->
                  <div class="unit-actions-row" style="justify-content: flex-end;">
                    <div style="display:flex; gap:6px; align-items:center;">
                      <button class="btn-mini-act" onclick="openEditPropertyModal('${p.id}')">✏️ 호수 정보/비번 수정</button>
                      ${p.isArchived ? `
                        <button class="btn-mini-act" onclick="restoreProperty('${p.id}')" style="color:#047857; background:#dcfce7; border:1px solid #86efac; font-size:12px; font-weight:800; padding:3px 9px; border-radius:6px;">♻️ 메인으로 살리기</button>
                        <button class="btn-mini-act" onclick="openOrganizeModal('${p.id}')" style="color:#dc2626; border:1px solid #fecaca; font-size:11px; padding:3px 7px; border-radius:6px; background:#fff;">완전삭제</button>
                      ` : `
                        <button class="btn-mini-act" onclick="openOrganizeModal('${p.id}')" style="color:#64748b; border:1px solid #cbd5e1; font-size:11.5px; font-weight:700; padding:3px 8px; border-radius:6px; background:#fff;">📦 보관/삭제</button>
                      `}
                    </div>
                  </div>
                </div> <!-- .unit-collapsible-detail -->
              </div>
            `;
          });

          html += `
              </div> <!-- .dong-units-list -->
            </div> <!-- .dong-group-section -->
          `;
        });

        html += `
            </div> <!-- .complex-dongs-container -->
          </div> <!-- .complex-card -->
        `;
      });

      container.innerHTML = html;
    }

    /* ==========================================================================
       SHOWING SESSION & TAG ENGINE (손님별 쇼잉 바구니 및 투어 코스 로직)
       ========================================================================== */

    function openNewShowingSessionModal() {
      document.getElementById('sessionDate').value = getTodayString();
      document.getElementById('sessionTime').value = '14:00';
      document.getElementById('sessionPhone').value = '';
      document.getElementById('sessionClientName').value = '';
      document.getElementById('sessionMemo').value = '';
      openModal('newShowingSessionModal');
    }

    function createNewShowingSession(e) {
      if (e) e.preventDefault();
      const date = document.getElementById('sessionDate').value || getTodayString();
      const time = document.getElementById('sessionTime').value || '14:00';
      const rawPhone = document.getElementById('sessionPhone').value.trim();
      let clientName = document.getElementById('sessionClientName').value.trim();
      const memo = document.getElementById('sessionMemo').value.trim();

      if (!rawPhone) {
        alert('손님 전화번호(또는 뒷4자리)를 입력해 주세요.');
        return;
      }

      const phone = formatPhone(rawPhone);
      if (!clientName) clientName = '손님';

      const newSession = {
        id: 'sess-' + Date.now(),
        date: date,
        time: time,
        phone: phone,
        clientName: clientName,
        memo: memo,
        propertyIds: [],
        feedbackMap: {},
        status: 'active'
      };

      showingSessions.unshift(newSession);
      activeSessionId = newSession.id;
      saveData();
      closeModal('newShowingSessionModal');
      renderApp();
      showToast(`🏷️ [${phone} 손님] 쇼잉이 생성되었습니다! 보여줄 매물의 [+담기]를 누르세요.`);
    }

    function setActiveSession(sessionId, pushHistory = true) {
      if (sessionId === activeSessionId) return;
      activeSessionId = sessionId;
      // 손님을 새로 선택하면 처음에는 그 손님에게 담긴 집 보기 상태로 시작 (원하면 전체 보기로 둘러보며 담기 가능)
      if (sessionId) {
        const sess = showingSessions.find(s => s.id === sessionId);
        // 담긴 집이 없으면 바로 전체 매물 보면서 담기 모드로 전환
        if (!sess || !sess.propertyIds || sess.propertyIds.length === 0) {
          isFilteringSessionOnly = false;
        } else {
          isFilteringSessionOnly = true;
        }
      } else {
        isFilteringSessionOnly = false;
      }
      if (pushHistory) {
        history.pushState({ sessionId: sessionId, isFilteringSessionOnly: isFilteringSessionOnly }, '');
      }
      renderApp();
    }

    function toggleSessionFilterMode(onlySession) {
      isFilteringSessionOnly = onlySession;
      history.pushState({ sessionId: activeSessionId, isFilteringSessionOnly: isFilteringSessionOnly }, '');
      renderApp();
    }

    function renderShowingSessionBar() {
      const barEl = document.getElementById('showingSessionBar');
      if (!barEl) return;

      const activeSessions = showingSessions.filter(s => s.status === 'active');

      let optionsHtml = `<option value="">🏠 전체 매물 보기 (손님 미선택)</option>`;
      if (activeSessions.length > 0) {
        activeSessions.forEach(s => {
          const dateShort = s.date ? s.date.slice(5).replace('-', '/') : '';
          const phoneShort = s.phone.length > 4 ? s.phone.slice(-4) : s.phone;
          const namePart = (s.clientName && s.clientName !== '손님') ? ` [${s.clientName}]` : '';
          const count = s.propertyIds ? s.propertyIds.length : 0;
          const isSelected = (s.id === activeSessionId) ? 'selected' : '';
          optionsHtml += `
            <option value="${s.id}" ${isSelected}>
              👤 ${dateShort} ${s.time || '14:00'} - ${phoneShort}${namePart} (${count}곳 담김)
            </option>
          `;
        });
      }

      const isActive = !!activeSessionId;

      barEl.innerHTML = `
        <div class="showing-select-wrap">
          <select class="showing-dropdown-select ${isActive ? 'is-active-session' : ''}" onchange="onSessionSelectChange(this.value)">
            ${optionsHtml}
          </select>
          <span class="showing-select-arrow">▼</span>
        </div>
        <button type="button" class="btn-new-showing-tag" onclick="openNewShowingSessionModal()" title="새로운 손님 등록">
          <span>👤➕</span>
          <span>손님 등록</span>
        </button>
      `;
    }

    function onSessionSelectChange(val) {
      if (!val) {
        setActiveSession(null);
      } else {
        setActiveSession(val);
      }
    }

    function renderShowingActiveBanner() {
      const container = document.getElementById('showingActiveBannerContainer');
      if (!container) return;

      if (!activeSessionId) {
        container.innerHTML = '';
        return;
      }

      const session = showingSessions.find(s => s.id === activeSessionId);
      if (!session) {
        activeSessionId = null;
        container.innerHTML = '';
        return;
      }

      const count = session.propertyIds ? session.propertyIds.length : 0;

      container.innerHTML = `
        <div class="showing-active-banner">
          <div class="showing-active-banner-top">
            <div class="showing-active-banner-title">
              <span>🛒</span>
              <span><b>${escapeHtml(session.phone)}</b> 손님 장바구니 (${count}곳 담김)</span>
            </div>
            <div style="display:flex; gap:6px;">
              ${isFilteringSessionOnly ? `
                <button type="button" class="btn-exit-showing" onclick="toggleSessionFilterMode(false)" style="background:#ffffff; color:#1d4ed8; font-weight:800; border:none;">
                  ➕ 전체 보며 담기
                </button>
              ` : `
                <button type="button" class="btn-exit-showing" onclick="toggleSessionFilterMode(true)" style="background:#2563eb; color:#ffffff; font-weight:800; border:1px solid #93c5fd;">
                  📋 담긴 집만 보기 (${count})
                </button>
              `}
              <button type="button" class="btn-exit-showing" onclick="setActiveSession(null)" title="손님 선택 해제">✕ 해제</button>
            </div>
          </div>
          ${session.memo ? `<div style="font-size:12.5px; opacity:0.95; margin-top:4px;">📝 희망조건: ${escapeHtml(session.memo)}</div>` : ''}
          
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.25);">
            <div style="font-size:12.5px; font-weight:700;">
              ${isFilteringSessionOnly ? `현재 <b>담긴 집 ${count}곳</b>만 표시 중` : `<b>전체 매물</b> 둘러보는 중 (매물 카드에서 담기/빼기)`}
            </div>
            <div style="display:flex; gap:6px;">
              <button type="button" class="btn-finish-showing" onclick="finishShowingSession('${session.id}')">
                🏁 안내 완료 및 보관
              </button>
              <button type="button" class="btn-exit-showing" style="color:#fecaca; border-color:rgba(254,202,202,0.4);" onclick="deleteShowingSession('${session.id}')">
                삭제
              </button>
            </div>
          </div>
        </div>
      `;
    }

    function togglePropertyInActiveSession(propId) {
      if (!activeSessionId) {
        // 활성화된 세션이 없을 경우, 가장 최근 활성 세션이 있는지 확인하거나 새로 만들도록 유도
        const activeSessions = showingSessions.filter(s => s.status === 'active');
        if (activeSessions.length === 1) {
          activeSessionId = activeSessions[0].id;
        } else if (activeSessions.length > 1) {
          alert('상단에서 집을 보여줄 [손님]을 먼저 선택해 주세요!');
          return;
        } else {
          if (confirm('아직 등록된 손님이 없습니다.\n새 손님을 먼저 등록하시겠습니까?')) {
            openNewShowingSessionModal();
          }
          return;
        }
      }

      const session = showingSessions.find(s => s.id === activeSessionId);
      if (!session) return;

      if (!session.propertyIds) session.propertyIds = [];
      const idx = session.propertyIds.indexOf(propId);

      if (idx > -1) {
        session.propertyIds.splice(idx, 1);
        if (session.feedbackMap && session.feedbackMap[propId]) {
          delete session.feedbackMap[propId];
        }
        showToast(`[${session.phone}] 손님 목록에서 매물을 뺐습니다.`);
      } else {
        session.propertyIds.push(propId);
        showToast(`[${session.phone}] 손님에게 보여줄 집으로 담았습니다! (총 ${session.propertyIds.length}곳)`);
      }

      saveData();
      renderApp();
    }

    function renderUnitShowingBasketBtn(propId) {
      if (!activeSessionId) return '';

      const session = showingSessions.find(s => s.id === activeSessionId);
      if (!session) return '';

      const isIn = session.propertyIds && session.propertyIds.includes(propId);
      const phoneShort = session.phone && session.phone.length > 4 ? session.phone.slice(-4) : session.phone;

      return `
        <button type="button" class="showing-basket-btn ${isIn ? 'in-basket' : ''}" onclick="togglePropertyInActiveSession('${propId}')" title="${isIn ? '장바구니에서 빼기' : '이 손님 장바구니에 담기'}">
          <span>${isIn ? '✔️ 담김' : `🛒 ${phoneShort}에 담기`}</span>
        </button>
      `;
    }

    function renderUnitFeedbackInSession(propId) {
      if (!activeSessionId) return '';
      const session = showingSessions.find(s => s.id === activeSessionId);
      if (!session || !session.propertyIds.includes(propId)) return '';

      const feedback = (session.feedbackMap && session.feedbackMap[propId]) || '';

      return `
        <div class="showing-feedback-wrap">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:12px; font-weight:800; color:#1d4ed8;">💬 [${escapeHtml(session.phone)}] 손님 현장 반응/메모:</span>
            <button type="button" onclick="togglePropertyInActiveSession('${propId}')" style="background:none; border:none; color:#ef4444; font-size:11px; font-weight:800; cursor:pointer;">✕ 이 집 빼기</button>
          </div>
          <input type="text" class="showing-feedback-input" placeholder="예: 햇빛 잘 든다고 흡족해함, 보증금 500 조율 시 계약 의사 있음" value="${escapeHtml(feedback)}" oninput="updateSessionFeedback('${session.id}', '${propId}', this.value)">
        </div>
      `;
    }

    function updateSessionFeedback(sessionId, propId, text) {
      const session = showingSessions.find(s => s.id === sessionId);
      if (!session) return;
      if (!session.feedbackMap) session.feedbackMap = {};
      session.feedbackMap[propId] = text;
      saveData(false); // 입력 중 매 타이핑마다 스냅샷은 안 만들고 데이터만 가볍게 저장
    }

    function finishShowingSession(sessionId) {
      const session = showingSessions.find(s => s.id === sessionId);
      if (!session) return;

      const propCount = session.propertyIds ? session.propertyIds.length : 0;
      if (!confirm(`[${session.phone} 손님]의 집 안내를 완료 처리하시겠습니까?\n\n• 매물 목록에서 손님 선택이 해제됩니다.\n• 상담 내용과 현장 반응 메모는 기록 보관함에 안전하게 보관됩니다.`)) {
        return;
      }

      session.status = 'finished';
      session.finishedAt = new Date().toISOString();
      activeSessionId = null;
      saveData();
      renderApp();
      showToast(`🏁 [${session.phone} 손님] (${propCount}곳) 안내가 완료되어 안전하게 보관되었습니다!`);
    }

    function deleteShowingSession(sessionId) {
      const session = showingSessions.find(s => s.id === sessionId);
      if (!session) return;

      if (!confirm(`[${session.phone} 손님]을 정말 삭제하시겠습니까? (매물 원본은 전혀 삭제되지 않습니다)`)) {
        return;
      }

      showingSessions = showingSessions.filter(s => s.id !== sessionId);
      if (activeSessionId === sessionId) activeSessionId = null;
      saveData();
      renderApp();
      showToast('손님이 목록에서 삭제되었습니다.');
    }

    /* Modal: 지난 손님 안내/방문 기록 보관함 렌더링 */
    function openSessionHistoryModal() {
      const container = document.getElementById('sessionHistoryList');
      if (!container) return;

      const finishedSessions = showingSessions.filter(s => s.status === 'finished');

      if (finishedSessions.length === 0) {
        container.innerHTML = `
          <div style="text-align:center; padding:30px 10px; color:#64748b;">
            <div style="font-size:32px; margin-bottom:6px;">🗂️</div>
            <div style="font-size:14px; font-weight:800; color:#334155;">완료된 손님 안내 기록이 아직 없습니다</div>
            <div style="font-size:12px; margin-top:4px;">손님 안내가 끝나고 [안내 완료 및 기록 보관]을 누르면 여기에 안전하게 보관됩니다.</div>
          </div>
        `;
      } else {
        container.innerHTML = finishedSessions.map(s => {
          const matchedProps = properties.filter(p => s.propertyIds && s.propertyIds.includes(p.id));
          return `
            <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:10px; padding:12px 14px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <span style="font-size:14px; font-weight:800; color:#1e40af;">
                  👤 ${s.date} - <b>${escapeHtml(s.phone)}</b> 손님 (${escapeHtml(s.clientName || '손님')})
                </span>
                <span style="font-size:11.5px; color:#64748b; background:#e2e8f0; padding:2px 7px; border-radius:10px;">
                  매물 ${matchedProps.length}곳
                </span>
              </div>
              ${s.memo ? `<div style="font-size:12px; color:#475569; margin-bottom:8px;">💡 메모: ${escapeHtml(s.memo)}</div>` : ''}
              
              <div style="display:flex; flex-direction:column; gap:6px; margin-top:6px; border-top:1px dashed #cbd5e1; padding-top:6px;">
                ${matchedProps.length === 0 ? `<div style="font-size:12px; color:#94a3b8;">(연결된 매물이 삭제되었거나 없음)</div>` : matchedProps.map(p => {
                  const fb = (s.feedbackMap && s.feedbackMap[p.id]) || '피드백 없음';
                  return `
                    <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:6px; padding:6px 10px; font-size:12px;">
                      <div style="font-weight:800; color:#1e293b;">
                        📍 ${p.dong} ${p.jibun} ${p.bDong && p.bDong !== '0' ? p.bDong + ' ' : ''}${p.ho ? p.ho : ''} ${p.building ? '('+escapeHtml(p.building)+')' : ''}
                      </div>
                      <div style="color:#2563eb; margin-top:2px;">
                        💬 손님 반응: <span style="color:#334155;">${escapeHtml(fb)}</span>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>

              <div style="display:flex; justify-content:flex-end; gap:6px; margin-top:8px;">
                <button type="button" class="btn-mini-act" style="color:#2563eb; border-color:#93c5fd;" onclick="reopenSession('${s.id}')">🔄 다시 손님 목록으로 살리기</button>
                <button type="button" class="btn-mini-act" style="color:#ef4444; border-color:#fca5a5;" onclick="deleteShowingSession('${s.id}'); openSessionHistoryModal();">삭제</button>
              </div>
            </div>
          `;
        }).join('');
      }

      openModal('sessionHistoryModal');
    }

    function reopenSession(sessionId) {
      const session = showingSessions.find(s => s.id === sessionId);
      if (!session) return;
      session.status = 'active';
      activeSessionId = session.id;
      saveData();
      closeModal('sessionHistoryModal');
      renderApp();
      showToast(`🔄 [${session.phone} 손님]이 다시 활성화되었습니다!`);
    }

    /* Unit Detail Accordion Toggle Function */
    function toggleUnitDetail(propId) {
      const detailEl = document.getElementById(`unitDetail_${propId}`);
      const btnEl = document.getElementById(`toggleBtn_${propId}`);
      const arrowEl = document.getElementById(`toggleArrow_${propId}`);
      if (!detailEl) return;

      const isOpen = detailEl.classList.contains('open');
      if (isOpen) {
        detailEl.classList.remove('open');
        btnEl?.classList.remove('active');
        if (arrowEl) arrowEl.textContent = '▼ 펼치기';
      } else {
        detailEl.classList.add('open');
        btnEl?.classList.add('active');
        if (arrowEl) arrowEl.textContent = '▲ 접기';
      }
    }

    function renderDongPills() {
        const container = document.getElementById('dongPills');
        const hiddenCount = properties.filter(p => p.isArchived).length;
        
        if (!settings.dongs || settings.dongs.length === 0) {
          container.innerHTML = `<button class="dong-pill active" onclick="openSettingsModal()" style="background:#eff6ff; color:#1d4ed8; border:1.5px dashed #93c5fd; font-weight:800;">📍 활동 지역(동) 설정 필요 +</button>`;
          return;
        }

        let html = `<button class="dong-pill ${currentDongFilter === 'ALL' ? 'active' : ''}" onclick="setDongFilter('ALL')">전체 동</button>`;
        settings.dongs.forEach(d => {
          html += `<button class="dong-pill ${currentDongFilter === d ? 'active' : ''}" onclick="setDongFilter('${d}')">${d}</button>`;
        });
        
        // 숨김/보관 필터 칩 (숨긴 매물이 있을 때 또는 선택 중일 때 노출)
        if (hiddenCount > 0 || currentDongFilter === 'ARCHIVED') {
          html += `<button class="dong-pill ${currentDongFilter === 'ARCHIVED' ? 'active' : ''}" style="background:${currentDongFilter === 'ARCHIVED' ? '#1e293b' : '#f1f5f9'}; color:${currentDongFilter === 'ARCHIVED' ? '#fff' : '#475569'}; border-color:${currentDongFilter === 'ARCHIVED' ? '#0f172a' : '#cbd5e1'}; font-weight:800;" onclick="setDongFilter('ARCHIVED')">📦 보관·숨김 (${hiddenCount})</button>`;
        }

        container.innerHTML = html;
      }

    function setDongFilter(d) {
      currentDongFilter = d;
      renderApp();
    }

    /* Modal Handlers */
    function openNewPropertyModal(presetDong, presetJibun, presetBDong, presetBuilding, presetCommonPw) {
      if (!settings.dongs || settings.dongs.length === 0) {
        if (confirm('📍 등록된 활동 지역(동)이 없습니다.\n먼저 [설정]에서 활동하시는 동(예: 역삼동, 판교동 등)을 등록하시겠습니까?')) {
          openSettingsModal();
        }
        return;
      }
      // 신규 등록 시 무료 플랜 100개 한도 검사
      const activeCount = properties.filter(p => !p.isArchived).length;
      if (activeCount >= MAX_FREE_PROPERTIES) {
        openModal('limitModal');
        return;
      }

      document.getElementById('editPropId').value = '';
      document.getElementById('propModalTitle').textContent = '🏡 새 매물 등록';
      document.getElementById('propSubmitBtn').textContent = '새 매물 저장 완료';
      document.getElementById('propModalShowingSection').style.display = 'block';

      const initialDong = presetDong || settings.dongs[0] || '';
      renderModalDongChips(initialDong);
      document.getElementById('propForm').reset();
      document.getElementById('formDong').value = initialDong;
      document.getElementById('formJibun').value = presetJibun || '';
      document.getElementById('formBDong').value = (presetBDong && presetBDong !== '0') ? presetBDong : '';
      document.getElementById('formBuilding').value = presetBuilding || '';
      document.getElementById('formCommonPw').value = presetCommonPw || '';
      document.getElementById('formTenantName').value = '';
      document.getElementById('formTenantPhone').value = '';
      document.getElementById('formPropMemo').value = '';
      document.getElementById('formDate').value = '';
      document.getElementById('formTime').value = '';
      document.getElementById('formClientPhone').value = '';
      document.getElementById('formClientName').value = '';
      
      window._forceShowCommonPw = false;
      // 만약 지번/동이 미리 채워져 있다면 공동비번 자동완성 시도
      if (presetJibun && !presetCommonPw) {
        onJibunOrDongChanged();
      }
      updatePasswordFieldsVisibility();
      openModal('propModal');
    }

    function toggleForceShowCommonPw() {
      window._forceShowCommonPw = true;
      updatePasswordFieldsVisibility();
      document.getElementById('formCommonPw').focus();
    }

    function promptEditDongCommonPw(dong, jibun, bDong, currentPw) {
      const dongTitle = (bDong && bDong !== '0') ? `${jibun} (${bDong})` : `${jibun} 건물`;
      const newPw = prompt(`🔑 [${dong} ${dongTitle}] 공동현관 비밀번호 수정:`, currentPw || '');
      if (newPw === null) return; // 취소됨
      const trimmed = newPw.trim();
      properties.forEach(p => {
        if (p.dong === dong && p.jibun === jibun && ((p.bDong || '0') === bDong)) {
          p.commonPw = trimmed;
        }
      });
      saveData();
      renderApp();
      showToast('🔑 공동현관 비밀번호가 업데이트되었습니다!');
    }

    // 호수 유무 및 기존 건물/동 공동비번 존재 여부에 따라 공동현관 입력칸 자동 숨김/표시
    function updatePasswordFieldsVisibility() {
      const dong = document.getElementById('formDong').value.trim();
      const jibun = document.getElementById('formJibun').value.trim();
      let bDong = document.getElementById('formBDong').value.trim();
      if (!bDong) bDong = '0';
      const ho = document.getElementById('formHo').value.trim();
      const editId = document.getElementById('editPropId').value;

      // 현재 건물/동에 이미 등록된 다른 매물이 있는지 확인
      const existingInDong = properties.filter(p => 
        p.dong === dong && p.jibun === jibun && ((p.bDong || '0') === bDong)
      );
      const existingCommonPw = existingInDong.find(p => p.commonPw && p.commonPw.trim() !== '')?.commonPw || document.getElementById('formCommonPw').value.trim();

      const commonPwGroup = document.getElementById('commonPwGroup');
      const pwRowContainer = document.getElementById('pwRowContainer');
      const noticeBar = document.getElementById('commonPwNoticeBar');
      const noticeVal = document.getElementById('commonPwNoticeVal');
      const doorPwLabel = document.getElementById('doorPwLabel');

      // 호수가 입력되어 있거나(개별 호수 수정/등록), 이미 해당 동에 매물이 있는 상태에서 호수를 추가할 때는
      // 호수별 정보에 굳이 공동현관 비번 입력칸을 중복 노출하지 않음!
      const isUnitMode = (ho !== '') || (editId !== '' && ho !== '') || (existingInDong.length > 0 && !window._forceShowCommonPw);

      if (isUnitMode && !window._forceShowCommonPw) {
        commonPwGroup.style.display = 'none';
        pwRowContainer.style.gridTemplateColumns = '1fr';
        noticeBar.style.display = 'flex';
        noticeVal.textContent = existingCommonPw || '미등록';
        doorPwLabel.textContent = ho ? `🚪 ${ho} 세대 도어락 비번` : '세대 도어락 비번';
      } else {
        commonPwGroup.style.display = 'block';
        pwRowContainer.style.gridTemplateColumns = '1fr 1fr';
        noticeBar.style.display = 'none';
        doorPwLabel.textContent = ho ? '세대 도어락 비번' : '세대 도어락 (호수 있을 때)';
      }
    }

    // 같은 지번 및 동 입력 시 기존 공동현관 비번 및 건물명 자동 완성
    function onJibunOrDongChanged() {
      const dong = document.getElementById('formDong').value.trim();
      const jibun = document.getElementById('formJibun').value.trim();
      let bDong = document.getElementById('formBDong').value.trim();
      if (!bDong) bDong = '0';

      if (jibun) {
        const matched = properties.find(p => 
          p.dong === dong && 
          p.jibun === jibun && 
          ((p.bDong || '0') === bDong)
        );

        if (matched) {
          const commInput = document.getElementById('formCommonPw');
          const bldgInput = document.getElementById('formBuilding');
          if (!commInput.value && matched.commonPw) {
            commInput.value = matched.commonPw;
          }
          if (!bldgInput.value && matched.building) {
            bldgInput.value = matched.building;
          }
        }
      }
      updatePasswordFieldsVisibility();
    }

    function openEditPropertyModal(propId) {
      const p = properties.find(item => item.id === propId);
      if (!p) return;

      window._forceShowCommonPw = false;
      document.getElementById('editPropId').value = p.id;
      document.getElementById('propModalTitle').textContent = `✏️ 물건지 정보/비번 수정`;
      document.getElementById('propSubmitBtn').textContent = '수정 내용 저장';
      document.getElementById('propModalShowingSection').style.display = 'none'; // 수정 시에는 일정 입력창 숨김

      renderModalDongChips(p.dong || settings.dongs[0]);
      document.getElementById('formDong').value = p.dong || settings.dongs[0];
      document.getElementById('formJibun').value = p.jibun || '';
      document.getElementById('formBDong').value = (p.bDong && p.bDong !== '0') ? p.bDong : '';
      document.getElementById('formHo').value = p.ho || '';
      document.getElementById('formBuilding').value = p.building || '';
      document.getElementById('formCommonPw').value = p.commonPw || '';
      document.getElementById('formDoorPw').value = p.doorPw || '';
      document.getElementById('formOwnerName').value = p.ownerName || '';
      document.getElementById('formOwnerPhone').value = p.ownerPhone || '';
      document.getElementById('formTenantName').value = p.tenantName || '';
      document.getElementById('formTenantPhone').value = p.tenantPhone || '';
      document.getElementById('formPropMemo').value = p.propMemo || '';

      updatePasswordFieldsVisibility();
      openModal('propModal');
    }

    function renderModalDongChips(selected) {
      const c = document.getElementById('modalDongChips');
      c.innerHTML = settings.dongs.map(d => `
        <button type="button" class="chip ${d === selected ? 'active' : ''}" onclick="selectModalDong('${d}')">${d}</button>
      `).join('');
      document.getElementById('formDong').value = selected;
    }

    function selectModalDong(d) {
      renderModalDongChips(d);
    }

    function onPhoneInput(val) {
      const nameInput = document.getElementById('formClientName');
      if (!nameInput.value || nameInput.value.startsWith('손님 (')) {
        const digits = val.replace(/\D/g, '');
        if (digits.length >= 4) {
          nameInput.value = `손님 (${digits.slice(-4)})`;
        }
      }
    }

    function quickTag(tag) {
      const phone = document.getElementById('formClientPhone').value;
      const digits = phone.replace(/\D/g, '');
      const suffix = digits.length >= 4 ? ` (${digits.slice(-4)})` : '';
      document.getElementById('formClientName').value = `${tag}${suffix}`;
    }

    function savePropertyAndShowing(e) {
      e.preventDefault();
      const editId = document.getElementById('editPropId').value;
      if (!editId) {
        const activeCount = properties.filter(p => !p.isArchived).length;
        if (activeCount >= MAX_FREE_PROPERTIES) {
          closeModal('propModal');
          openModal('limitModal');
          return;
        }
      }
      const dong = document.getElementById('formDong').value.trim();
      const jibun = document.getElementById('formJibun').value.trim();
      let bDong = document.getElementById('formBDong').value.trim();
      if (!bDong) bDong = '0'; // 가상의 0동 (빌라 또는 동 없는 단일 건물)
      const ho = document.getElementById('formHo').value.trim();
      const building = document.getElementById('formBuilding').value.trim();
      const commonPw = document.getElementById('formCommonPw').value.trim();
      const doorPw = document.getElementById('formDoorPw').value.trim();
      const ownerName = document.getElementById('formOwnerName').value.trim();
      const ownerPhone = document.getElementById('formOwnerPhone').value.trim();
      const tenantName = document.getElementById('formTenantName').value.trim();
      const tenantPhone = document.getElementById('formTenantPhone').value.trim();
      const propMemo = document.getElementById('formPropMemo').value.trim();

      if (editId) {
        // 기존 물건지 수정
        const p = properties.find(item => item.id === editId);
        if (p) {
          p.dong = dong;
          p.jibun = jibun;
          p.bDong = bDong;
          p.ho = ho;
          p.building = building;
          p.commonPw = commonPw;
          p.doorPw = doorPw;
          p.ownerName = ownerName;
          p.ownerPhone = ownerPhone;
          p.tenantName = tenantName;
          p.tenantPhone = tenantPhone;
          p.propMemo = propMemo;

          // 만약 공동현관 비번이나 건물명을 수정했다면, 같은 지번+동의 다른 호수들에도 동기화 제안/적용
          if (commonPw || building) {
            properties.forEach(other => {
              if (other.id !== p.id && other.dong === dong && other.jibun === jibun && (other.bDong || '0') === bDong) {
                if (commonPw) other.commonPw = commonPw;
                if (building) other.building = building;
              }
            });
          }
          saveData();
          closeModal('propModal');
          renderApp();
          showToast('✅ 물건지 정보가 성공적으로 수정되었습니다!');
          return;
        }
      }

      // 신규 물건지 등록
      const newProp = {
        id: 'prop-' + Date.now(),
        dong, jibun, bDong, ho, building, commonPw, doorPw, ownerName, ownerPhone, tenantName, tenantPhone, propMemo
      };
      
      // 같은 지번+동의 다른 호수들이 있으면 공동비번/건물명 자동 동기화
      if (commonPw || building) {
        properties.forEach(other => {
          if (other.dong === dong && other.jibun === jibun && (other.bDong || '0') === bDong) {
            if (commonPw && !other.commonPw) other.commonPw = commonPw;
            if (building && !other.building) other.building = building;
          }
        });
      }
      properties.unshift(newProp); // add to top

      // 손님 연락처나 손님명이 입력된 경우에만 쇼잉 약속 생성
      const sDate = document.getElementById('formDate').value;
      const sTime = document.getElementById('formTime').value;
      const cPhone = document.getElementById('formClientPhone').value.trim();
      let cName = document.getElementById('formClientName').value.trim();

      if (sDate && sTime && (cPhone || cName)) {
        if (!cName) {
          const digits = cPhone.replace(/\D/g, '');
          cName = digits.length >= 4 ? `손님 (${digits.slice(-4)})` : '방문 손님';
        }
        showings.push({
          id: 's-' + Date.now(),
          propertyId: newProp.id,
          date: sDate,
          time: sTime,
          clientPhone: cPhone,
          clientName: cName,
          memo: '',
          feedback: ''
        });
      }

      saveData();
      closeModal('propModal');
      renderApp();
      showToast('✅ 새 주소가 등록되었습니다');
    }

    /* Add Showing to existing property */
    function openAddShowingModal(propId, title) {
      document.getElementById('targetPropId').value = propId;
      document.getElementById('addShowingPropTitle').textContent = `🗓️ ${title} 약속 잡기`;
      document.getElementById('addDate').value = getTodayString();
      document.getElementById('addClientPhone').value = '';
      document.getElementById('addClientName').value = '';
      document.getElementById('addMemo').value = '';
      openModal('addShowingModal');
    }

    function onAddPhoneInput(val) {
      const nameInput = document.getElementById('addClientName');
      if (!nameInput.value || nameInput.value.startsWith('손님 (')) {
        const digits = val.replace(/\D/g, '');
        if (digits.length >= 4) {
          nameInput.value = `손님 (${digits.slice(-4)})`;
        }
      }
    }

    function quickAddTag(tag) {
      const phone = document.getElementById('addClientPhone').value;
      const digits = phone.replace(/\D/g, '');
      const suffix = digits.length >= 4 ? ` (${digits.slice(-4)})` : '';
      document.getElementById('addClientName').value = `${tag}${suffix}`;
    }

    function saveNewShowingToProp(e) {
      e.preventDefault();
      const propId = document.getElementById('targetPropId').value;
      const date = document.getElementById('addDate').value;
      const time = document.getElementById('addTime').value;
      const clientPhone = document.getElementById('addClientPhone').value.trim();
      let clientName = document.getElementById('addClientName').value.trim();
      const memo = document.getElementById('addMemo').value.trim();

      if (!clientName) {
        const digits = clientPhone.replace(/\D/g, '');
        clientName = digits.length >= 4 ? `손님 (${digits.slice(-4)})` : '방문 손님';
      }

      showings.push({
        id: 's-' + Date.now(),
        propertyId: propId,
        date, time, clientPhone, clientName, memo, feedback: ''
      });

      saveData();
      closeModal('addShowingModal');
      renderApp();
      showToast('✅ 약속이 등록되었습니다');
    }

    /* Feedback Modal */
    function openFeedbackModal(showingId) {
      const s = showings.find(item => item.id === showingId);
      if (!s) return;
      document.getElementById('feedbackShowingId').value = showingId;
      document.getElementById('feedbackText').value = s.feedback || '';
      openModal('feedbackModal');
    }

    function saveFeedback() {
      const id = document.getElementById('feedbackShowingId').value;
      const text = document.getElementById('feedbackText').value.trim();
      const s = showings.find(item => item.id === id);
      if (s) {
        s.feedback = text;
        saveData();
        closeModal('feedbackModal');
        renderApp();
        showToast('📝 반응 메모가 저장되었습니다');
      }
    }

    function deleteShowing(id) {
      if (!confirm('이 일정을 삭제하시겠습니까?')) return;
      showings = showings.filter(s => s.id !== id);
      saveData();
      renderApp();
      showToast('삭제되었습니다');
    }

    
    function openOrganizeModal(propId) {
      const p = properties.find(item => item.id === propId);
      if (!p) return;
      document.getElementById('targetOrganizePropId').value = propId;
      document.getElementById('targetOrganizePropName').textContent = `${p.dong} ${p.jibun} ${p.ho ? p.ho + ' ' : ''}(${p.building || '건물명 미입력'})`;
      openModal('organizeModal');
    }

    function archiveCurrentProperty() {
      const id = document.getElementById('targetOrganizePropId').value;
      const p = properties.find(item => item.id === id);
      if (!p) return;

      p.isArchived = true;
      p.archivedAt = getTodayString();
      saveData();
      closeModal('organizeModal');
      renderApp();
      showToast('📦 매물이 안전하게 보관되었습니다! 언제든 다시 살릴 수 있습니다.');
    }

    function restoreProperty(id) {
      const p = properties.find(item => item.id === id);
      if (!p) return;

      p.isArchived = false;
      saveData();

      // 만약 더 이상 보관된 매물이 없으면 기본 '전체 동' 필터로 자동 전환
      const remainArchived = properties.filter(item => item.isArchived).length;
      if (remainArchived === 0) {
        currentDongFilter = 'ALL';
      }

      renderApp();
      showToast('🎉 매물이 메인 목록으로 다시 복원되었습니다!');
    }

    function permanentlyDeleteCurrentProperty() {
      const id = document.getElementById('targetOrganizePropId').value;
      if (!confirm('경고: 정말로 이 매물과 관련된 모든 비밀번호, 약속 기록을 영구히 삭제하시겠습니까?\n(삭제 후에는 절대 복원할 수 없습니다!)')) {
        return;
      }

      properties = properties.filter(p => p.id !== id);
      showings = showings.filter(s => s.propertyId !== id);
      saveData();
      closeModal('organizeModal');
      renderApp();
      showToast('매물이 영구히 삭제되었습니다.');
    }

    function deleteProperty(id) {
      openOrganizeModal(id);
    }



    /* Settings */
    function openTeamPreviewModal() {
      openModal('teamPreviewModal');
    }

    function openSettingsModal() {
      renderSettingsDongs();
      const dist = document.getElementById('baseDistrict');
      if (dist) dist.value = settings.baseDistrict || '';
      openModal('settingsModal');
    }

    function renderSettingsDongs() {
      const c = document.getElementById('settingsDongChips');
      if (!c) return;
      if (!settings.dongs || settings.dongs.length === 0) {
        c.innerHTML = '<span style="font-size:12.5px; color:#94a3b8; font-style:italic;">등록된 동이 없습니다. 아래에서 동 이름을 추가해 주세요.</span>';
        return;
      }
      c.innerHTML = settings.dongs.map(d => `
        <span class="chip" style="display:inline-flex; align-items:center; gap:5px;">
          ${d} <span onclick="removeDong('${d}')" style="color:red; cursor:pointer;">✕</span>
        </span>
      `).join('');
    }

    function addDong() {
      const v = document.getElementById('newDongText').value.trim();
      if (!v) return;
      if (!settings.dongs.includes(v)) {
        settings.dongs.push(v);
        saveData();
        renderSettingsDongs();
        renderDongPills();
        document.getElementById('newDongText').value = '';
      }
    }

    function removeDong(d) {
      settings.dongs = settings.dongs.filter(item => item !== d);
      saveData();
      renderSettingsDongs();
      renderDongPills();
    }

    
    function checkInitialPinBanner() {
      const isInitial = (!settings.pin || settings.pin === '0000');
      const lockHint = document.getElementById('lockInitialPinHint');
      if (lockHint) {
        lockHint.style.display = isInitial ? 'inline-flex' : 'none';
      }
      const banner = document.getElementById('initialPinBanner');
      if (!banner) return;
      banner.style.display = isInitial ? 'flex' : 'none';
      if (isInitial) {
        document.body.classList.remove('no-banner');
      } else {
        document.body.classList.add('no-banner');
      }
    }

    function updatePin() {
      const p1 = document.getElementById('newPinInput').value.trim();
      const p2 = document.getElementById('confirmPinInput').value.trim();

      if (!/^\d{4}$/.test(p1)) {
        return alert('새 암호는 숫자 4자리여야 합니다.');
      }
      if (p1 !== p2) {
        return alert('입력하신 두 암호가 일치하지 않습니다.\n다시 확인해 주세요.');
      }
      if (p1 === '0000') {
        if (!confirm('초기 암호인 0000으로 설정하시겠습니까?')) return;
      } else {
        if (!confirm('새 비밀번호 [' + p1 + '] 로 변경하시겠습니까?\n(분실 시 복구가 어려우니 꼭 기억해 주세요!)')) {
          return;
        }
      }

      settings.pin = p1;
      saveData();
      document.getElementById('newPinInput').value = '';
      document.getElementById('confirmPinInput').value = '';
      checkInitialPinBanner();
      showToast('🎉 암호가 안전하게 변경되었습니다');
    }

    function exportData() {
      const blob = new Blob([JSON.stringify({settings, properties, showings}, null, 2)], {type:'application/json'});
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `쇼잉수첩_백업_${getTodayString()}.json`; a.click();
    }

    function importData(e) {
      const file = e.target.files[0]; if (!file) return;
      const r = new FileReader();
      r.onload = (evt) => {
        try {
          const d = JSON.parse(evt.target.result);
          if (d.properties) {
            settings = d.settings || settings;
            properties = d.properties;
            showings = d.showings || [];
            saveData();
            renderApp();
            showToast('데이터가 복원되었습니다');
          }
        } catch(err){ alert('파일 형식 오류'); }
      };
      r.readAsText(file);
    }

    /* PIN Functions */
    
    /* PC 키보드 숫자 입력 지원 (숫자 0-9, Backspace, Enter, Esc) */
    window.addEventListener('keydown', (e) => {
      const lock = document.getElementById('lockScreen');
      if (!lock || lock.style.display === 'none') return;

      // 모달이 열려있지 않을 때만 키패드 입력 처리
      if (e.key >= '0' && e.key <= '9') {
        pressPin(e.key);
      } else if (e.key === 'Backspace') {
        backspacePin();
      } else if (e.key === 'Escape') {
        clearPin();
      }
    });

    function pressPin(n) {
      if (typeof n !== 'string') n = String(n);
      if (enteredPin.length < 4) {
        enteredPin += n;
        updateDots();
        if (enteredPin.length === 4) {
          setTimeout(verifyPin, 80);
        }
      }
    }
    function clearPin() { enteredPin = ''; updateDots(); }
    function backspacePin() { enteredPin = enteredPin.slice(0, -1); updateDots(); }
    function updateDots() {
      for (let i = 0; i < 4; i++) {
        const dot = document.getElementById('dot' + i);
        if (i < enteredPin.length) dot.classList.add('filled');
        else dot.classList.remove('filled');
      }
    }
    function verifyPin() {
      if (enteredPin === settings.pin) {
        const lock = document.getElementById('lockScreen');
        if (lock) lock.style.display = 'none';
        sessionStorage.setItem('unlocked', 'true');
        checkInitialPinBanner();
        clearPin();
      } else {
        showToast('비밀번호가 일치하지 않습니다.');
        clearPin();
      }
    }

    
    function exitOrCloseApp() {
      // 안드로이드 앱이면 앱 완전 종료
      if (window.AndroidBridge && window.AndroidBridge.exitApp) {
        window.AndroidBridge.exitApp();
      } else {
        // 웹 브라우저면 탭 닫기 시도 또는 종료 안내
        window.close();
        document.body.innerHTML = '<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; background:#0f172a; color:white; font-family:sans-serif; text-align:center; padding:20px;">' +
          '<div style="font-size:48px; margin-bottom:16px;">👋</div>' +
          '<h2 style="font-size:20px; margin-bottom:8px;">안전하게 로그아웃되었습니다</h2>' +
          '<p style="font-size:14px; color:#94a3b8;">브라우저 창(탭)을 닫아주세요.</p>' +
          '</div>';
      }
    }

    function lockApp() {
      if (!confirm('중개노트를 종료(로그아웃)하시겠습니까?')) return;
      sessionStorage.removeItem('unlocked');
      clearPin();

      // 안드로이드 앱에서는 즉시 종료 실행
      if (window.AndroidBridge && window.AndroidBridge.exitApp) {
        window.AndroidBridge.exitApp();
        return;
      }

      // PC 웹 브라우저 환경에서는 잠금 화면 대신 '안전하게 로그아웃되었습니다 (창 닫기)' 화면 제공
      exitOrCloseApp();
    }

    /* Helpers & Android Back-Key Handling */
    window.addEventListener('popstate', (e) => {
      // 1. 열려 있는 모달이 있으면 모달부터 닫기
      const openModals = document.querySelectorAll('.modal-overlay.open');
      if (openModals.length > 0) {
        openModals.forEach(m => m.classList.remove('open'));
        return;
      }

      // 2. 모달이 없고 history state에 sessionId 정보가 있다면 해당 세션 상태 복원
      if (e.state && e.state.sessionId !== undefined) {
        setActiveSession(e.state.sessionId, false);
      } else {
        // history state가 없는 초기 진입 상태로 뒤로 온 경우
        if (activeSessionId !== null) {
          setActiveSession(null, false);
        }
      }
    });

    function openModal(id) {
      history.pushState({ modalId: id }, '');
      document.getElementById(id).classList.add('open');
    }

    function closeModal(id) {
      document.getElementById(id).classList.remove('open');
      if (history.state && history.state.modalId) {
        history.back();
      }
    }
    function copyDonationAccountInApp() {
      const accountText = '카카오뱅크 3333-33-8298898 (조항준)';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(accountText).then(() => {
          showToast('✓ 계좌번호가 복사되었습니다. 감사합니다! 🙏');
        }).catch(() => {
          fallbackCopyInApp(accountText);
        });
      } else {
        fallbackCopyInApp(accountText);
      }
    }

    function fallbackCopyInApp(text) {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        showToast('✓ 계좌번호가 복사되었습니다. 감사합니다! 🙏');
      } catch (err) {
        alert('후원 계좌: ' + text);
      }
      document.body.removeChild(textArea);
    }

    function showToast(msg) {
      const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 2000);
    }
    function getTodayString() {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }
    function formatDateLabel(dStr) {
      const today = getTodayString();
      if (dStr === today) return '오늘';
      const parts = dStr.split('-');
      return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
    }