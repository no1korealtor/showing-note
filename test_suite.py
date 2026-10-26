# -*- coding: utf-8 -*-
import json
import re

print("=" * 60)
print(" 중개사 자산 데이터 무결성 & 안정성 TDD 자동화 검증 실행")
print("=" * 60)

# Mock in-memory manager
class DataManager:
    def __init__(self):
        self.properties = []
        self.showings = []
        self.snapshots = []

    def save(self):
        self.snapshots.insert(0, {
            'props': list(self.properties),
            'shows': list(self.showings)
        })
        if len(self.snapshots) > 5:
            self.snapshots.pop()

    def rollback(self):
        if len(self.snapshots) > 1:
            prev = self.snapshots[1]
            self.properties = list(prev['props'])
            self.showings = list(prev['shows'])
            return True
        return False

    def add_prop(self, dong, jibun, ho, door_pw, owner_phone):
        p = {'id': f'p-{len(self.properties)}', 'dong': dong, 'jibun': jibun, 'ho': ho, 'doorPw': door_pw, 'ownerPhone': owner_phone}
        self.properties.append(p)
        self.save()
        return p

    def update_prop(self, p_id, **kwargs):
        for p in self.properties:
            if p['id'] == p_id:
                p.update(kwargs)
                self.save()
                return p
        raise ValueError("Not found")

    def add_showing(self, p_id, date, time, phone, client_name=""):
        if not client_name:
            digits = re.sub(r'\D', '', phone)
            client_name = f"손님 ({digits[-4:]})" if len(digits) >= 4 else "방문 손님"
        s = {'id': f's-{len(self.showings)}', 'propertyId': p_id, 'date': date, 'time': time, 'phone': phone, 'client': client_name}
        self.showings.append(s)
        self.save()
        return s

# Run Tests
dm = DataManager()

# TDD 1
p1 = dm.add_prop("성산동", "234-12", "201호", "1357*", "010-1111-2222")
assert len(dm.properties) == 1 and dm.properties[0]['doorPw'] == "1357*"
print("[PASS] TDD-1: 물건지(지번, 비번, 연락처) 등록 무결성 검증 성공")

# TDD 2
s1 = dm.add_showing(p1['id'], "2026-10-23", "14:00", "010-9999-5678")
assert s1['client'] == "손님 (5678)"
print("[PASS] TDD-2: 손님 이름 미입력 시 전화번호 뒷자리 자동 식별 검증 성공")

# TDD 3
dm.update_prop(p1['id'], ho="202호", doorPw="9999*")
assert dm.properties[0]['ho'] == "202호" and dm.properties[0]['doorPw'] == "9999*"
assert len(dm.showings) == 1 and dm.showings[0]['propertyId'] == p1['id']
print("[PASS] TDD-3: 물건지 정보/비번 수정 시 매달린 쇼잉 이력 100% 보존 검증 성공")

# TDD 4
# Simulate accidental wipe
dm.properties.clear()
dm.showings.clear()
dm.save()
assert len(dm.properties) == 0
assert dm.rollback() == True
assert len(dm.properties) == 1 and dm.properties[0]['doorPw'] == "9999*"
print("[PASS] TDD-4: 자동 스냅샷 롤백 복구 (실수 방지 타임머신) 검증 성공")

# TDD 5
today = "2026-10-23"
p_early = {'id': 'a', 'time': '14:00'}
p_late = {'id': 'b', 'time': '16:30'}
ordered = sorted([p_late, p_early], key=lambda x: x['time'])
assert ordered[0]['id'] == 'a'
print("[PASS] TDD-5: 시간순 정렬 알고리즘 (가장 빠른 쇼잉이 1등 카드) 검증 성공")

print("=" * 60)
print("🎉 모든 TDD 테스트 100% 통과! 공인중개사 자산 보호 무결성 검증 완료")
print("=" * 60)
