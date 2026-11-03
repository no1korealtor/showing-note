const STORAGE_KEY_SETTINGS = 'showing_diary_settings';
    const STORAGE_KEY_PROPERTIES = 'showing_diary_properties';
    const STORAGE_KEY_SHOWINGS = 'showing_diary_showings';
    const STORAGE_KEY_SNAPSHOTS = 'showing_diary_snapshots';
    const MAX_FREE_PROPERTIES = 100; // 개인 무료 플랜 최대 보관 매물 한도

    let settings = { pin: '0000', dongs: ['성산동', '중동'], baseDistrict: '서울특별시 마포구' };
    let properties = [];
    let showings = [];
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
            dong: item.dong || settings.dongs[0] || '성산동',
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
      } catch(e){}
    }

    function pushSnapshot() {
      try {
        const snaps = JSON.parse(localStorage.getItem(STORAGE_KEY_SNAPSHOTS) || '[]');
        snaps.unshift({
          timestamp: new Date().toISOString(),
          properties: properties,
          showings: showings
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
        const payload = { settings, properties, showings, time: new Date().toISOString() };
        const encStr = await encryptVault(payload, settings.pin);
        localStorage.setItem('showing_note_encrypted_vault', encStr);
        if (window.AndroidBridge && window.AndroidBridge.saveEncryptedVault) {
          window.AndroidBridge.saveEncryptedVault(encStr);
        }
      } catch(e){}
    }

    async function exportEncryptedVaultFile() {
      try {
        const payload = { settings, properties, showings };
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
      if (properties.length === 0) {
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
      const container = document.getElementById('addressCardsList');
      const searchWord = document.getElementById('searchInput').value.trim().toLowerCase();
      const today = getTodayString();

      // Filter properties
      let list = properties.filter(p => {
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
        if (currentDongFilter === 'ARCHIVED') {
          countEl.innerHTML = `📦 보관된 매물: <b style="color:#64748b;">0개</b>`;
        } else {
          countEl.innerHTML = `📦 보관함: <b style="color:#2563eb;">${activeCount}</b> / ${MAX_FREE_PROPERTIES}개 <span style="font-size:11px; color:#64748b; font-weight:normal;">(무료 플랜)</span>`;
        }
        container.innerHTML = `
          <div style="text-align:center; padding: 50px 20px; color:#94a3b8;">
            <div style="font-size:36px; margin-bottom:8px;">🏡</div>
            <p style="font-weight:700; color:#475569;">등록된 집이 없습니다</p>
            <p style="font-size:13px; margin-top:4px;">우측 상단 <b>[➕ 새 매물 등록]</b>을 눌러 주소를 추가하세요.</p>
          </div>
        `;
        return;
      }

      // Sort Bar UI Update
      document.getElementById('sortScheduleBtn').classList.toggle('active', currentSortBy === 'schedule');
      document.getElementById('sortAddrBtn').classList.toggle('active', currentSortBy === 'address');
      // Active properties count (excluding archived ones)
      const activeCount = properties.filter(p => !p.isArchived).length;
      const countEl = document.getElementById('propCount');
      if (currentDongFilter === 'ARCHIVED') {
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
            <!-- Complex Top Header (주소 우측 지도열기 + 아래 전폭 신규 동·호수 추가) -->
            <div class="complex-header">
              <div class="complex-top-row">
                <div class="complex-addr-title">
                  <span class="star-bullet">★</span>
                  <span class="addr-dong-badge">${complex.dong}</span>
                  <span>${complex.jibun}</span>
                  ${complexBadge}
                </div>
                <a href="${naverUrl}" target="_blank" class="btn-complex-map">📍 지도열기</a>
              </div>
              ${complexBuildingName ? `<div class="complex-building-title">🏢 ${escapeHtml(complexBuildingName)}</div>` : ''}

              <button type="button" class="btn-complex-add-full" onclick="openNewPropertyModal('${complex.dong}', '${complex.jibun}', '', '${escapeHtml(complexBuildingName)}')">
                <span>➕</span>
                <span>이 지번에 신규 동·호수 추가</span>
              </button>
            </div>

            <!-- Building Dong Groups -->
            <div class="complex-dongs-container">
        `;

        sortedDongs.forEach(bDong => {
          const propsInDong = dongMap.get(bDong);
          // Common password for this dong (shared among units)
          const dongCommonPw = propsInDong.find(p => p.commonPw && p.commonPw.trim() !== '')?.commonPw || '';
          const isRealDong = (bDong !== '0');

          html += `
            <div class="dong-group-section">
              <!-- Dong Header (If apartment/multi-dong: show dong name; if villa: show clean common-pw line) -->
              <div class="dong-group-header">
                <div style="display:flex; align-items:center; gap:6px;">
                  ${isRealDong ? `
                    <span class="dong-group-badge">🏢 ${escapeHtml(bDong)}</span>
                    <span style="font-size:12px; color:#64748b;">(${propsInDong.length}건)</span>
                  ` : `
                    <span style="font-size:13px; font-weight:800; color:#334155;">🏠 건물 매물 (${propsInDong.length}건)</span>
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
                    <span class="unit-ho-tag" style="${p.ho ? '' : 'background:#f1f5f9; color:#475569; border-color:#cbd5e1;'}">${p.ho ? `🚪 ${escapeHtml(p.ho)}` : (isRealDong ? `🏢 ${escapeHtml(bDong)} (호수 미지정)` : '🏢 건물전체')}</span>
                    ${unitScheduleBadge}
                  </div>
                  <div class="unit-door-pw">
                    ${p.ho ? '세대 도어락' : '🔑 공동현관'}: <span>${p.ho ? (p.doorPw || '미등록') : (p.commonPw || p.doorPw || '미등록')}</span>
                  </div>
                </div>

                <!-- Unit Contacts Row (Tenant & Owner Call Buttons) -->
                <div class="unit-contacts-row">
                  ${p.tenantPhone ? `
                    <a href="tel:${p.tenantPhone}" class="btn-tenant-call" style="background:#e0f2fe; border:1px solid #bae6fd; border-radius:6px; padding:5px 10px; font-size:12px; font-weight:800; color:#0369a1; text-decoration:none;">📞 세입자(${escapeHtml(p.tenantName || '거주자')}) 통화</a>
                  ` : ''}
                  ${p.ownerPhone ? `
                    <a href="tel:${p.ownerPhone}" class="btn-owner-call" style="background:#fef3c7; border:1px solid #fde68a; border-radius:6px; padding:5px 10px; font-size:12px; font-weight:800; color:#92400e; text-decoration:none;">📞 ${escapeHtml(p.ownerName || '임대인')} 통화</a>
                  ` : ''}
                  ${!p.tenantPhone && !p.ownerPhone ? `<span style="font-size:12px; color:#94a3b8;">등록된 연락처 없음</span>` : ''}
                </div>

                <!-- Unit Special Memo (if any) -->
                ${p.propMemo ? `
                  <div class="unit-memo-box">
                    <span style="font-size:14px; line-height:1;">💡</span>
                    <span style="flex:1; line-height:1.4;">${escapeHtml(p.propMemo)}</span>
                  </div>
                ` : ''}

                <!-- Indented Showing Tree for this Unit (일정이 있을 때만 표시!) -->
                ${pShows.length > 0 ? `
                  <div class="showing-tree" style="margin-top:10px; border-radius:8px; background:#f8fafc; padding:10px 12px;">
                    <div class="tree-header-row">
                      <span class="tree-header-label">
                        <span>🤝 쇼잉 약속 & 현장 브리핑</span>
                        <span style="font-size:11px; background:#e0e7ff; color:#3730a3; padding:1px 6px; border-radius:10px;">${pShows.length}건</span>
                      </span>
                    </div>

                    <div class="tree-branch-container">
                      ${upcomingShows.length > 0 ? `
                        <div class="tree-section-title title-upcoming">
                          <span>🗓️ 예정된 쇼잉 (${upcomingShows.length})</span>
                        </div>
                        ${upcomingShows.map(s => `
                          <div class="schedule-item-future">
                            <div class="future-head">
                              <span class="future-time">⏰ ${formatDateLabel(s.date)} ${s.time}</span>
                              <span class="future-client">${escapeHtml(s.clientName || '손님')}</span>
                              ${s.clientPhone ? `<a href="tel:${s.clientPhone}" class="btn-call-mini">📞 전화</a>` : ''}
                            </div>
                            ${s.memo ? `<div class="future-memo">📝 ${escapeHtml(s.memo)}</div>` : ''}
                            <div class="future-actions">
                              <button class="btn-mini-act" onclick="openFeedbackModal('${s.id}')">💬 브리핑/피드백</button>
                              <button class="btn-mini-act" onclick="deleteShowing('${s.id}')">삭제</button>
                            </div>
                          </div>
                        `).join('')}
                      ` : ''}

                      ${pastShows.length > 0 ? `
                        <div class="tree-section-title title-past">
                          <span>📋 지난 브리핑 기록 (${pastShows.length})</span>
                        </div>
                        ${pastShows.map(s => `
                          <div class="schedule-item-past">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                              <span class="past-date">${s.date} ${s.time}</span>
                              <span class="past-client">${escapeHtml(s.clientName || '손님')}</span>
                              <button class="btn-mini-act" style="font-size:11px; padding:1px 5px;" onclick="deleteShowing('${s.id}')">✕</button>
                            </div>
                            ${s.feedback ? `<div class="past-feedback">💬 ${escapeHtml(s.feedback)}</div>` : (s.memo ? `<div class="past-feedback" style="color:#64748b;">📝 ${escapeHtml(s.memo)}</div>` : '')}
                          </div>
                        `).join('')}
                      ` : ''}
                    </div>
                  </div>
                ` : ''}

                <!-- Unit Actions Row: [➕ 일정추가] 버튼과 수정/정리 버튼을 한 줄에 깔끔하게 배치! -->
                <div class="unit-actions-row">
                  <div>
                    <button type="button" class="btn-unit-add-showing" onclick="openAddShowingModal('${p.id}')">
                      ➕ 일정 추가
                    </button>
                  </div>
                  <div style="display:flex; gap:6px; align-items:center;">
                    <button class="btn-mini-act" onclick="openEditPropertyModal('${p.id}')">✏️ 호수 정보/비번 수정</button>
                    ${p.isArchived ? `
                      <button class="btn-mini-act" onclick="restoreProperty('${p.id}')" style="color:#047857; background:#dcfce7; border:1px solid #86efac; font-size:12px; font-weight:800; padding:3px 9px; border-radius:6px;">♻️ 메인으로 살리기</button>
                      <button class="btn-mini-act" onclick="openOrganizeModal('${p.id}')" style="color:#dc2626; border:1px solid #fecaca; font-size:11px; padding:3px 7px; border-radius:6px; background:#fff;">완전삭제</button>
                    ` : `
                      <button class="btn-mini-act" onclick="openOrganizeModal('${p.id}')" style="color:#64748b; border:1px solid #cbd5e1; font-size:11.5px; font-weight:700; padding:3px 8px; border-radius:6px; background:#fff;">📁 매물정리</button>
                    `}
                  </div>
                </div>
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

    function renderDongPills() {
        const container = document.getElementById('dongPills');
        const hiddenCount = properties.filter(p => p.isArchived).length;
        
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
      if (dist) dist.value = settings.baseDistrict || '서울특별시 마포구';
      openModal('settingsModal');
    }

    function renderSettingsDongs() {
      const c = document.getElementById('settingsDongChips');
      if (!c) return;
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
      if (settings.dongs.length <= 1) return alert('최소 1개 이상의 동이 필요합니다.');
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
      const openModals = document.querySelectorAll('.modal-overlay.open');
      if (openModals.length > 0) {
        openModals.forEach(m => m.classList.remove('open'));
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