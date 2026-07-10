// app.js

// ===== 데이터 정규화 유틸 =====
function normalizeMath(raw) {
    if (!raw) return '해당없음';
    let trimmed = raw.trim();
    if (['없음', '해당 없음', '해당없음', '해당없음', '신설', '정보 없음', ''].includes(trimmed)) return '해당없음';
    
    trimmed = trimmed.replace(/미적분/g, '미적')
                     .replace(/확률과\s*통계/g, '확통')
                     .replace(/확률과통계/g, '확통');

    // 수I, 수II만 있고 미적/확통/기하가 없더라도 수리 범위를 나타내도록 그대로 처리 (기존에 해당없음으로 강제 리턴하던 조건 제거)
    
    let result = trimmed.replace(/\(어려움\)/g, '(상)');
    const parts = result.split(',').map(p => p.trim());
    const normalized = parts.map(p => {
        const subject = p.replace(/\([^)]*\)/g, '').trim();
        const hasLevel = /\([^)]+\)/.test(p);
        if (['미적', '확통', '기하'].includes(subject) && !hasLevel) return `${subject}(중)`;
        return p;
    });
    return normalized.join(', ');
}

/**
 * 새 CSV의 "언어논술 제시문 및 답안 유형" 컬럼을 파싱
 * 반환: { present: string, answerType: string, answerLength: string }
 * present: 제시문 종류(통계, 영어, 수리형, 약술형 등)
 * answerType: 장문형/중문형/단문형/자유형/약술형/수리형
 * answerLength: 분량 정보 (국N/수N, 800자 이상, 600~800자 등)
 */
function parseEssayColumn(raw) {
    if (!raw) return { present: '', answerType: '', answerLength: '' };
    const trimmed = raw.trim();
    if (['없음', '해당 없음', '해당없음', '신설', '정보 없음', ''].includes(trimmed)) {
        return { present: '', answerType: '', answerLength: '' };
    }

    let present = '';
    let answerType = '';
    let answerLength = '';

    // 약술형 특수 처리 (국N / 수N)
    const yakSulMatch = raw.match(/약술형\s*\(([^)]+)\)/);
    if (yakSulMatch) {
        answerType = '약술형';
        answerLength = yakSulMatch[1].trim();
    } else if (raw.includes('약술형')) {
        answerType = '약술형';
    }

    // 제시문 유형 파싱
    if (raw.includes('통계')) present += (present ? '+' : '') + '통계';
    if (raw.includes('영어 제시문') || raw.includes('영어')) present += (present ? '+' : '') + '영어';
    if (raw.includes('도표')) present += (present ? '+' : '') + '도표';
    if (raw.includes('수리형') || raw.includes('수리')) present += (present ? '+' : '') + '수리';

    // 답안 유형 파싱 (약술형이 아닌 경우)
    if (!answerType) {
        if (raw.includes('장문형')) answerType = '장문형';
        else if (raw.includes('중문형')) answerType = '중문형';
        else if (raw.includes('단문형')) answerType = '단문형';
        else if (raw.includes('자유형')) answerType = '자유형';
        else if (raw.includes('수리형')) answerType = '수리형';
    }

    // 분량 파싱 (약술형이 아닌 경우)
    if (!answerLength) {
        const lengthMatch = raw.match(/[（(]([^）)]*(?:자|글자)[^）)]*)[）)]/);
        if (lengthMatch) answerLength = lengthMatch[1].trim();
    }

    return { present, answerType, answerLength };
}

function normalizeData(raw) {
    return raw.map((row, idx) => {
        // 새 CSV 컬럼명: '언어논술 제시문 및 답안 유형', '수리논술 범위 및 난이도'
        const essayRaw = row['언어논술 제시문 및 답안 유형'] || '';
        const mathRaw = row['수리논술 범위 및 난이도'] || '';
        const parsed = parseEssayColumn(essayRaw);
        return {
            ...row,
            '_rowIdx': idx,
            '_수리정규화': normalizeMath(mathRaw),
            '_제시문': parsed.present,
            '_답안유형': parsed.answerType,
            '_답안분량': parsed.answerLength,
            '_언어논술원문': essayRaw,
        };
    });
}

function determineTracks(row) {
    const dept = row['모집계열 및 세부 학과'] || '';
    const uName = row['대학명'] || '';
    const ansType = row['_답안유형'] || '';
    const mathNorm = row['_수리정규화'] || '해당없음';

    // 성균관대 특수 처리: 수리형은 자연, 언어형은 인문으로 분류
    if (uName.includes('성균관')) {
        if (dept.includes('언어형')) return ['인문'];
        if (dept.includes('수리형')) return ['자연'];
    }

    const tracks = new Set();

    const hasMath = (mathNorm !== '해당없음' && mathNorm !== '');
    const hasHuman = ansType !== '';

    const isMed = dept.includes('의예') || dept.includes('치의예') || dept.includes('의학') || dept.includes('약학') || dept.includes('약학부') || dept.includes('한의예') || dept.includes('수의예') || dept.includes('의약');
    const isBusiness = dept.includes('경영') || dept.includes('경제') || dept.includes('상경') || dept.includes('경상');
    const isHumanities = dept.includes('인문') || dept.includes('사회') || dept.includes('사범') || dept.includes('교육') || dept.includes('예술') || dept.includes('체육') || dept.includes('의류') || dept.includes('어학') || dept.includes('언어형') || dept.includes('인문계');
    const isNatural = dept.includes('자연') || dept.includes('공학') || dept.includes('첨단ICT') || dept.includes('소프트웨어') || dept.includes('반도체') || dept.includes('컴퓨터') || dept.includes('인공지능') || dept.includes('생명') || dept.includes('IT') || dept.includes('자연계') || isMed;

    if (isMed) {
        tracks.add('의약');
    }
    if (isNatural) {
        tracks.add('자연');
    }

    if (isBusiness || isHumanities) {
        tracks.add('인문');
    }

    if (dept.includes('전 모집단위') || dept.includes('통합계열') || dept.includes('통합') || dept.includes('캠퍼스자율전공')) {
        if (hasHuman || isHumanities || isBusiness) {
            tracks.add('인문');
        }
        if (hasMath || isNatural) {
            tracks.add('자연');
        }
    }

    if (tracks.size === 0) {
        if (hasHuman) {
            tracks.add('인문');
        }
        if (hasMath) {
            tracks.add('자연');
        }
    }

    if (tracks.size === 0) {
        tracks.add('인문');
    }

    return Array.from(tracks);
}

// ===== 상태 관리 =====
const state = {
    univData: [],
    timetables: [{ id: 0, name: '시간표 1', univs: [], manualOverrides: {} }],
    activeTimetableId: 0,
    currentRecommendations: {},
    scheduleTranspose: true,
    summarySort: { column: '고사 일자', asc: true }
};

const DATA_URL = './data.csv';

// ===== CSV 데이터 로딩 =====
async function loadCsvData() {
    const res = await fetch(DATA_URL);

    if (!res.ok) {
        throw new Error(`data.csv 로딩 실패: ${res.status}`);
    }

    const csv = await res.text();
    const rawData = parseCSV(csv);

    state.univData = normalizeData(rawData);
    console.log('데이터 로드 완료:', state.univData.length, '건');
}

function parseCSV(csvText) {
    const lines = csvText
        .trim()
        .split(/\r?\n/)
        .filter(line => line.trim() !== '');

    if (lines.length === 0) return [];

    const headers = splitCSVLine(lines[0]).map(h => h.trim());

    return lines.slice(1).map(line => {
        const values = splitCSVLine(line).map(v => v.trim());
        return Object.fromEntries(headers.map((key, i) => [key, values[i] ?? '']));
    });
}

function splitCSVLine(line) {
    const result = [];
    let current = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"' && insideQuotes && nextChar === '"') {
            current += '"';
            i++;
        } else if (char === '"') {
            insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }

    result.push(current);
    return result;
}

function getActiveTimetable() {
    return state.timetables.find(t => t.id === state.activeTimetableId) || state.timetables[0];
}

// ===== 초기화 =====
async function init() {
    try {
        await loadCsvData();
    } catch (err) {
        console.error('data.csv 읽기 실패:', err);
        alert('data.csv 파일을 읽지 못했습니다. 파일명과 위치를 확인하세요.');
    }

    renderTabs();
    renderActiveTags();
    renderGrid();
    renderSummary();
    renderInteractiveSchedule();

    const searchInput = document.getElementById('univ-search');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchCandidates();
            }
        });
    }

    showWelcomeModal();

    updateDDay();
    setInterval(updateDDay, 1000);
}

// ===== 필터 값 가져오기 =====
function getFilters() {
    const getMathLevel = key => document.querySelector(`input[name="${key}"]:checked`)?.value || '무관';
    const getChecked = selector => [...document.querySelectorAll(selector + ':checked')].map(c => c.value);

    return {
        계열: '상관없음',
        미적: getMathLevel('미적'),
        확통: getMathLevel('확통'),
        기하: getMathLevel('기하'),
        제시문유형: getChecked('.type-cb'),
        답안유형: getChecked('.ans-cb'),
        약술형만: getChecked('.type-cb').includes('약술형'),
    };
}

// ===== 필터 변경 핸들러 =====
function handleFilterChange() {
    renderGrid();
    renderSummary();
    renderInteractiveSchedule();
}

// ===== 필터 초기화 =====
function resetFilters() {
    ['미적', '확통', '기하'].forEach(key => {
        const el = document.querySelector(`input[name="${key}"][value="무관"]`);
        if (el) el.checked = true;
    });

    document.querySelectorAll('.type-cb, .ans-cb').forEach(cb => {
        cb.checked = false;
    });
    
    const candidateSection = document.getElementById('candidate-section');
    if (candidateSection) candidateSection.style.display = 'none';

    const recommendSection = document.getElementById('recommend-section');
    if (recommendSection) recommendSection.style.display = 'none';

    const searchInput = document.getElementById('univ-search');
    if (searchInput) searchInput.value = '';
    
    handleFilterChange();
}

// ===== 매칭 판단 알고리즘 =====
function rowMatchesFilter(row, f) {
    const isMathFiltered = f.미적 !== '무관' || f.확통 !== '무관' || f.기하 !== '무관';
    const isHumanFiltered = f.제시문유형.length > 0 || f.답안유형.length > 0;

    if (!isMathFiltered && !isHumanFiltered) {
        return true;
    }

    const mathNorm = row['_수리정규화'] || '';
    const rowPresent = row['_제시문'] || '';
    const rowAnsType = row['_답안유형'] || '';
    const rowTracks = determineTracks(row);

    const isNaturalOrMed = rowTracks.includes('자연') || rowTracks.includes('의약');
    const isHumanTrack = rowTracks.includes('인문');

    let mathPass = true;
    let humanPass = true;

    // ── 수리 필터: 자연/의약 계열 행에만 적용 ──
    if (isMathFiltered) {
        if (!isNaturalOrMed) {
            // 인문 전용 행에는 수리 필터 적용 안 함 → 통과
            mathPass = true;
        } else {
            const hasMath = (mathNorm !== '해당없음' && mathNorm !== '');
            const needsAnyMath = f.미적 === '포함' || f.확통 === '포함' || f.기하 === '포함';

            if (needsAnyMath && !hasMath) {
                mathPass = false;
            } else if (hasMath) {
                for (const s of ['미적', '확통', '기하']) {
                    const hasSubject = mathNorm.includes(s);
                    if (f[s] === '포함' && !hasSubject) { mathPass = false; break; }
                    if (f[s] === '불포함' && hasSubject) { mathPass = false; break; }
                }
            } else {
                // 수리 없는 자연계 행 + 필터 적용 중 → 탈락
                mathPass = false;
            }
        }
    }

    // ── 언어 필터: 인문 계열 행에만 적용 ──
    if (isHumanFiltered) {
        if (!isHumanTrack) {
            // 자연/의약 전용 행에는 언어 필터 적용 안 함 → 통과
            humanPass = true;
        } else {
            // 약술형 단독 필터
            const wantsYakSul = f.제시문유형.includes('약술형');
            if (wantsYakSul) {
                humanPass = rowAnsType === '약술형';
            } else {
                // 제시문 유형 매칭
                const presentMatch = f.제시문유형.length === 0 || f.제시문유형.some(t => {
                    if (t === '통계') return rowPresent.includes('통계');
                    if (t === '도표') return rowPresent.includes('도표');
                    if (t === '수리') return rowPresent.includes('수리');
                    if (t === '영어') return rowPresent.includes('영어');
                    return false;
                });

                // 답안 유형 매칭
                const ansMatch = f.답안유형.length === 0 || f.답안유형.some(t => {
                    return rowAnsType.includes(t);
                });

                if (rowAnsType === '약술형') {
                    // 약술형 행이지만 약술형 필터 미선택 → 답안유형 필터가 없으면 통과
                    humanPass = f.답안유형.length === 0 ? presentMatch : false;
                } else if (rowAnsType || rowPresent) {
                    humanPass = presentMatch && ansMatch;
                } else {
                    // 정보 없는 행은 제시문/답안 필터가 없으면 통과
                    humanPass = (f.제시문유형.length === 0 && f.답안유형.length === 0);
                }
            }
        }
    }

    return mathPass && humanPass;
}

// ===== 대학 검색 및 후보 목록 렌더링 =====
function searchCandidates() {
    const val = document.getElementById('univ-search').value.trim();

    if (!val) {
        alert('검색할 대학명을 입력하세요.');
        return;
    }

    const queries = val.split(/[\s,]+/).filter(Boolean);
    const matched = {};
    
    state.univData.forEach(row => {
        const name = row['대학명'] || '';

        if (queries.some(q => name.includes(q))) {
            const rowTracks = determineTracks(row);

            if (!matched[name]) {
                matched[name] = new Set();
            }

            rowTracks.forEach(trackType => {
                matched[name].add(trackType);
            });
        }
    });

    renderCandidates(matched, `🔍 "${val}" 검색 결과`);
}

// ===== 맞춤 대학 추천 =====
function recommendUniversities(forceShow = true) {
    const f = getFilters();
    const matched = {};

    state.univData.forEach(row => {
        if (rowMatchesFilter(row, f)) {
            const name = row['대학명'] || '';
            const rowTracks = determineTracks(row);

            if (!matched[name]) {
                matched[name] = new Set();
            }

            rowTracks.forEach(trackType => {
                matched[name].add(trackType);
            });
        }
    });

    state.currentRecommendations = matched;

    renderRecommendCandidates(matched, `🎯 조건 추천 대학`, forceShow);
}

// ===== 추천대학 전체 담기 =====
function addAllRecommend() {
    const active = getActiveTimetable();
    const univNames = Object.keys(state.currentRecommendations);
    
    if (univNames.length === 0) {
        alert('담을 추천 대학이 없습니다.');
        return;
    }
    
    let addedCount = 0;

    univNames.forEach(name => {
        const tracks = [...state.currentRecommendations[name]];
        tracks.forEach(trackType => {
            const uniqueKey = `${name} (${trackType})`;
            if (!active.univs.includes(uniqueKey)) {
                active.univs.push(uniqueKey);
                addedCount++;
            }
        });
    });

    if (addedCount > 0) {
        renderActiveTags();
        renderGrid();
        renderSummary();
        renderRecommendCandidates(state.currentRecommendations, `🎯 조건 추천 대학`, true);
        renderInteractiveSchedule();
        alert(`${addedCount}개의 전형이 새롭게 담겼습니다!`);
    } else {
        alert('이미 모든 추천 대학이 시간표에 담겨 있습니다.');
    }
}

function renderRecommendCandidates(grouped, titleText, forceShow = false) {
    const listEl = document.getElementById('recommend-list');
    const secEl = document.getElementById('recommend-section');

    if (!listEl || !secEl) return;

    if (!forceShow && secEl.style.display !== 'block') {
        return;
    }
    
    const univNames = Object.keys(grouped);

    if (univNames.length === 0) {
        listEl.innerHTML = '<p style="font-size:0.85rem; color:var(--text-muted); padding: 0.5rem 0;">조건에 맞는 추천 대학이 없습니다.</p>';
        secEl.style.display = 'block';
        return;
    }

    const active = getActiveTimetable();

    listEl.innerHTML = univNames.map(name => {
        const tracks = [...grouped[name]];

        const buttonsHtml = tracks.map(trackType => {
            const uniqueKey = `${name} (${trackType})`;
            const isAdded = active.univs.includes(uniqueKey);

            return `
                <button class="${isAdded ? 'btn-primary' : 'btn-secondary'}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; font-weight: normal; margin-left: 0.25rem;" onclick="event.stopPropagation(); toggleUniv('${uniqueKey}')">
                     ${trackType} ${isAdded ? '✓' : '＋'}
                </button>
            `;
        }).join('');

        return `
            <div class="candidate-item" style="cursor: default;">
                <span class="candidate-info"><strong>${name}</strong></span>
                <span class="candidate-actions">${buttonsHtml}</span>
            </div>
        `;
    }).join('');

    secEl.style.display = 'block';
}

function renderCandidates(grouped, titleText) {
    const listEl = document.getElementById('candidate-list');
    const secEl = document.getElementById('candidate-section');
    const titleEl = document.getElementById('candidate-title');

    if (!listEl || !secEl || !titleEl) return;

    titleEl.textContent = titleText;
    
    const univNames = Object.keys(grouped);

    if (univNames.length === 0) {
        listEl.innerHTML = '<p style="font-size:0.85rem; color:var(--text-muted);">조건에 맞는 대학이 없습니다.</p>';
        secEl.style.display = 'block';
        return;
    }

    const active = getActiveTimetable();

    listEl.innerHTML = univNames.map(name => {
        const tracks = [...grouped[name]];

        const buttonsHtml = tracks.map(trackType => {
            const uniqueKey = `${name} (${trackType})`;
            const isAdded = active.univs.includes(uniqueKey);

            return `
                <button class="${isAdded ? 'btn-primary' : 'btn-secondary'}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; font-weight: normal; margin-left: 0.25rem;" onclick="event.stopPropagation(); toggleUniv('${uniqueKey}')">
                     ${trackType} ${isAdded ? '✓' : '＋'}
                </button>
            `;
        }).join('');

        return `
            <div class="candidate-item" style="cursor: default;">
                <span class="candidate-info"><strong>${name}</strong></span>
                <span class="candidate-actions">${buttonsHtml}</span>
            </div>
        `;
    }).join('');

    secEl.style.display = 'block';
}

// ===== 대학 추가 / 제거 =====
function toggleUniv(uniqueKey) {
    const active = getActiveTimetable();
    const idx = active.univs.indexOf(uniqueKey);

    if (idx > -1) {
        active.univs.splice(idx, 1);
    } else {
        active.univs.push(uniqueKey);
    }

    renderActiveTags();
    renderGrid();
    renderSummary();

    const titleText = document.getElementById('candidate-title')?.textContent;

    if (titleText) {
        const query = titleText.includes('검색') ? document.getElementById('univ-search').value.trim() : '';
        if (query) {
            searchCandidates();
        }
    }

    recommendUniversities(false);
    
    if (typeof renderInteractiveSchedule === 'function') {
        renderInteractiveSchedule();
    }
}

// ===== 담은 대학 태그 렌더링 =====
function renderActiveTags() {
    const active = getActiveTimetable();
    const container = document.getElementById('selected-univs');

    if (!container) return;

    container.innerHTML = active.univs.map(name => `
        <div class="tag">
            <span>${name}</span>
            <span class="tag-remove" onclick="event.stopPropagation(); toggleUniv('${name}')">×</span>
        </div>
    `).join('');
}

// ===== 시간표 그리드 렌더링 =====
function renderGrid() {
    const active = getActiveTimetable();
    const container = document.getElementById('timetable-grid-wrapper');

    if (!container) return;

    // 담은 대학 개수 배지 업데이트
    const countBadge = document.getElementById('timetable-count-badge');
    if (countBadge) {
        const cnt = active.univs.length;
        countBadge.textContent = cnt > 0 ? `${cnt}개 담김` : '';
        countBadge.style.display = cnt > 0 ? 'inline-block' : 'none';
    }

    if (active.univs.length === 0) {
        container.innerHTML = `<p style="text-align:center; padding:3rem 0; color:var(--text-muted);">대학을 검색하거나 추천받아 담아주세요.</p>`;
        return;
    }

    let matchingRows = [];

    active.univs.forEach(uniqueKey => {
        // Support both `대학명 (trackType)` and `대학명 (trackType)|rowIdx` formats
        const match = uniqueKey.match(/^(.+)\s\(([^|)]+)\)(?:\|(\d+))?$/);
        if (!match) return;
        const uName = match[1];
        const trackType = match[2];
        const rowIdx = match[3] !== undefined ? parseInt(match[3]) : null;

        if (rowIdx !== null) {
            // Specific session: find the exact row by _rowIdx
            const row = state.univData.find(r => r['_rowIdx'] === rowIdx);
            if (row) matchingRows.push(row);
        } else {
            // Legacy: all rows for this university+track
            const rows = state.univData.filter(row => row['대학명'] === uName);
            rows.forEach(row => {
                const rowTracks = determineTracks(row);
                if (rowTracks.includes(trackType)) {
                    matchingRows.push(row);
                }
            });
        }
    });

    if (matchingRows.length === 0) {
        container.innerHTML = `<p style="text-align:center; padding:3rem 0; color:var(--text-muted);">담은 대학의 일정 데이터가 없습니다.</p>`;
        return;
    }

    const allDates = [...new Set(matchingRows.map(r => r['고사 일자']).filter(Boolean))].sort();
    const timeSlots = ['오전(~12시)', '오후(12~16시)', '저녁(16시~)'];

    const parseTimeSlot = timeStr => {
        if (!timeStr) return '오전(~12시)';
        const m = timeStr.match(/(\d{1,2})[:시]/);
        if (!m) return '오전(~12시)';

        const hour = parseInt(m[1]);

        if (hour < 12) return '오전(~12시)';
        if (hour < 16) return '오후(12~16시)';
        return '저녁(16시~)';
    };

    const cellMap = {};

    matchingRows.forEach(row => {
        const date = row['고사 일자'];
        const slot = parseTimeSlot(row['고사 시간']);
        const key = `${date}__${slot}`;

        if (!cellMap[key]) cellMap[key] = [];
        cellMap[key].push(row);
    });

    const isCardOn = row => {
        const rowIdx = row['_rowIdx'];

        if (active.manualOverrides[rowIdx] !== undefined) {
            return active.manualOverrides[rowIdx];
        }

        return true;
    };

    const conflictDates = new Set();

    allDates.forEach(date => {
        timeSlots.forEach(slot => {
            const key = `${date}__${slot}`;
            const cards = cellMap[key] || [];
            const activeCardsCount = cards.filter(isCardOn).length;

            if (activeCardsCount > 1) {
                conflictDates.add(date);
            }
        });
    });

    let html = `<table class="tt-table">
        <thead>
            <tr>
                <th>날짜</th>
                ${timeSlots.map(s => `<th>${s}</th>`).join('')}
            </tr>
        </thead>
        <tbody>
    `;

    allDates.forEach(date => {
        const hasConflict = conflictDates.has(date);

        html += `
            <tr class="${hasConflict ? 'row-conflict' : ''}">
                <td class="date-cell">
                    ${hasConflict ? '<div class="conflict-badge">⚠️ 일정 겹침</div>' : ''}
                    <div>${date}</div>
                </td>
        `;

        timeSlots.forEach(slot => {
            const key = `${date}__${slot}`;
            const cards = cellMap[key] || [];

            html += `<td>`;

            if (cards.length > 0) {
                const stackClass = cards.length > 1 ? 'cell-stack' : '';
                html += `<div class="${stackClass}">`;

                cards.forEach((row, i) => {
                    const rowIdx = row['_rowIdx'];
                    const isOn = isCardOn(row);
                    const isOverlap = isOn && cards.filter(isCardOn).length > 1;

                    const mathNorm = row['_수리정규화'] || '해당없음';
                    const mathRaw = row['수리논술 범위 및 난이도'] || '';
                    const rowPresent = row['_제시문'] || '';
                    const rowAnsType = row['_답안유형'] || '';
                    const rowAnsLength = row['_답안분량'] || '';
                    const langRaw = row['_언어논술원문'] || '';
                    const hasMath = mathNorm !== '해당없음' && mathNorm !== '';
                    const hasLang = rowAnsType !== '' || rowPresent !== '';

                    const typeBadge = hasMath
                        ? `<span style="display:inline-block; font-size:0.65rem; background-color:#818cf8; color:white; padding:1px 4px; border-radius:3px; margin-right:3px;">수리</span>`
                        : hasLang
                            ? `<span style="display:inline-block; font-size:0.65rem; background-color:#f43f5e; color:white; padding:1px 4px; border-radius:3px; margin-right:3px;">인문</span>`
                            : '';

                    const minStr = row['수능 최저학력기준'] || '';
                    const hasMin = minStr && minStr !== '없음';

                    const minBadge = hasMin
                        ? `<span style="display:inline-block; font-size:0.65rem; background-color:#f59e0b; color:white; padding:1px 4px; border-radius:3px;">최저</span>`
                        : '';

                    const langDisplay = rowAnsType
                        ? `${rowAnsType}${rowAnsLength ? ' (' + rowAnsLength + ')' : ''}${rowPresent ? ' · ' + rowPresent : ''}`
                        : rowPresent;

                    html += `
                        <div class="timetable-card ${isOn ? '' : 'off'} ${isOverlap ? 'overlap' : ''}" 
                             style="--stack-idx: ${i}; z-index: ${cards.length - i};"
                             onclick="toggleCardOnOff(${rowIdx})">
                            <div class="card-header">
                                <span class="card-univ">${row['대학명']}</span>
                                <span class="card-toggle">${isOn ? 'ON' : 'OFF'}</span>
                            </div>
                            <div class="card-track">${row['모집계열 및 세부 학과'] || ''}</div>
                            <div class="card-time">🕐 ${row['고사 시간'] || '시간 미정'}</div>
                            <div style="margin-top:0.25rem;">${typeBadge}${minBadge}</div>
                            ${hasMath ? `<div class="card-print-detail" style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">📐 <strong>수리:</strong> ${mathRaw || mathNorm}</div>` : ''}
                            ${langDisplay ? `<div class="card-print-detail" style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">📝 <strong>언어:</strong> ${langDisplay}</div>` : ''}
                        </div>
                    `;
                });

                html += `</div>`;
            } else {
                html += `<span style="color:var(--text-muted); font-size:0.8rem;">-</span>`;
            }

            html += `</td>`;
        });

        html += `</tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}

// ===== 카드 개별 온오프 전환 =====
function toggleCardOnOff(rowIdx) {
    const active = getActiveTimetable();

    if (active.manualOverrides[rowIdx] === undefined) {
        active.manualOverrides[rowIdx] = false;
    } else {
        active.manualOverrides[rowIdx] = !active.manualOverrides[rowIdx];
    }

    renderGrid();
    renderSummary();
}

// ===== 요약 패널 렌더링 =====
function renderSummary() {
    const active = getActiveTimetable();
    const panel = document.getElementById('summary-panel');
    const body = document.getElementById('summary-body');

    if (!panel || !body) return;

    if (active.univs.length === 0) {
        panel.style.display = 'none';
        return;
    }

    let matchingRows = [];

    active.univs.forEach(uniqueKey => {
        const match = uniqueKey.match(/^(.+)\s\(([^|)]+)\)(?:\|(\d+))?$/);
        if (!match) return;
        const uName = match[1];
        const trackType = match[2];
        const rowIdx = match[3] !== undefined ? parseInt(match[3]) : null;

        if (rowIdx !== null) {
            const row = state.univData.find(r => r['_rowIdx'] === rowIdx);
            if (row) matchingRows.push(row);
        } else {
            const rows = state.univData.filter(row => row['대학명'] === uName);
            rows.forEach(row => {
                const rowTracks = determineTracks(row);
                if (rowTracks.includes(trackType)) {
                    matchingRows.push(row);
                }
            });
        }
    });
    
    const isCardOn = row => {
        const rowIdx = row['_rowIdx'];

        if (active.manualOverrides[rowIdx] !== undefined) {
            return active.manualOverrides[rowIdx];
        }

        return true;
    };

    const activeRows = matchingRows.filter(isCardOn);

    if (activeRows.length === 0) {
        panel.style.display = 'none';
        return;
    }

    const parseTimeForSort = timeStr => {
        if (!timeStr) return 999;
        const m = timeStr.match(/(\d{1,2})[:시]/);
        return m ? parseInt(m[1]) : 999;
    };

    // 정렬 로직 적용
    const sortCol = state.summarySort.column;
    const isAsc = state.summarySort.asc;

    activeRows.sort((a, b) => {
        let valA = a[sortCol] || '';
        let valB = b[sortCol] || '';

        // 고사 시간 정렬 특수 처리
        if (sortCol === '고사 시간') {
            const timeA = parseTimeForSort(valA);
            const timeB = parseTimeForSort(valB);
            return isAsc ? timeA - timeB : timeB - timeA;
        }

        // 일반 문자열 정렬
        return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });

    const rows = activeRows;
    const getSortIndicator = col => {
        if (state.summarySort.column !== col) return ' ↕';
        return state.summarySort.asc ? ' ▲' : ' ▼';
    };

    body.innerHTML = `
        <table class="summary-table">
            <thead>
                <tr>
                    <th style="width: 40px; text-align:center;">No.</th>
                    <th style="cursor:pointer;" onclick="sortSummaryTable('대학명')">대학명${getSortIndicator('대학명')}</th>
                    <th style="cursor:pointer;" onclick="sortSummaryTable('모집계열 및 세부 학과')">계열 / 학과${getSortIndicator('모집계열 및 세부 학과')}</th>
                    <th style="cursor:pointer; text-align:center;" onclick="sortSummaryTable('고사 일자')">고사 일자${getSortIndicator('고사 일자')}</th>
                    <th style="cursor:pointer; text-align:center;" onclick="sortSummaryTable('고사 시간')">고사 시간${getSortIndicator('고사 시간')}</th>
                    <th style="cursor:pointer;" onclick="sortSummaryTable('수리논술 범위 및 난이도')">수리논술 범위${getSortIndicator('수리논술 범위 및 난이도')}</th>
                    <th style="cursor:pointer;" onclick="sortSummaryTable('_답안유형')">언어논술 답안${getSortIndicator('_답안유형')}</th>
                    <th style="cursor:pointer;" onclick="sortSummaryTable('_제시문')">제시문${getSortIndicator('_제시문')}</th>
                    <th style="cursor:pointer;" onclick="sortSummaryTable('수능 최저학력기준')">수능최저${getSortIndicator('수능 최저학력기준')}</th>
                </tr>
            </thead>
            <tbody>
                ${rows.map((row, idx) => {
                    const mathRaw = row['수리논술 범위 및 난이도'] || '';
                    const mathNorm = row['_수리정규화'] || '';
                    const ansType = row['_답안유형'] || '';
                    const ansLen = row['_답안분량'] || '';
                    const presentRaw = row['_제시문'] || '';
                    const minRaw = row['수능 최저학력기준'] || '없음';
                    const hasMin = minRaw && minRaw !== '없음';
                    const hasMath = mathNorm && !['해당없음','없음','해당 없음',''].includes(mathNorm);
                    const hasLang = ansType || presentRaw;
                    const langDisplay = ansType
                        ? `${ansType}${ansLen ? ' (' + ansLen + ')' : ''}${presentRaw ? ' · ' + presentRaw : ''}`
                        : presentRaw;
                    return `
                        <tr>
                            <td style="text-align:center; color:var(--text-muted); font-size:0.8rem;">${idx + 1}</td>
                            <td><strong>${row['대학명']}</strong></td>
                            <td style="font-size:0.78rem; color:var(--text-muted);">${row['모집계열 및 세부 학과'] || '-'}</td>
                            <td style="text-align:center; font-weight:600;">${row['고사 일자'] || '미정'}</td>
                            <td style="text-align:center; font-size:0.8rem;">${row['고사 시간'] || '미정'}</td>
                            <td style="font-size:0.78rem;">${hasMath ? `<span class="summary-badge badge-math">수리</span> ${mathRaw || mathNorm}` : '<span style="color:var(--text-muted)">-</span>'}</td>
                            <td style="font-size:0.78rem;">${hasLang ? `<span style="color:#be3a63; font-weight:600;">${langDisplay}</span>` : '<span style="color:var(--text-muted)">-</span>'}</td>
                            <td style="font-size:0.78rem;">${presentRaw ? presentRaw : '<span style="color:var(--text-muted)">-</span>'}</td>
                            <td style="font-size:0.75rem;">${hasMin ? `<span class="summary-badge badge-min">${minRaw}</span>` : '<span style="color:var(--text-muted)">없음</span>'}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;

    panel.style.display = 'block';
}

function sortSummaryTable(column) {
    if (state.summarySort.column === column) {
        state.summarySort.asc = !state.summarySort.asc;
    } else {
        state.summarySort.column = column;
        state.summarySort.asc = true;
    }
    renderSummary();
}

window.sortSummaryTable = sortSummaryTable;

// ===== 새 시간표 추가 및 탭 전환 =====
function addNewTimetable() {
    const newId = Date.now();

    state.timetables.push({
        id: newId,
        name: `시간표 ${state.timetables.length + 1}`,
        univs: [],
        manualOverrides: {}
    });

    state.activeTimetableId = newId;

    renderTabs();
    renderActiveTags();
    renderGrid();
    renderSummary();
}

function switchTab(id) {
    state.activeTimetableId = id;

    renderTabs();
    renderActiveTags();
    renderGrid();
    renderSummary();
}

function renderTabs() {
    const container = document.getElementById('timetable-tabs');

    if (!container) return;

    container.innerHTML = state.timetables.map(t => `
        <button class="tab-btn ${t.id === state.activeTimetableId ? 'active' : ''}" onclick="switchTab(${t.id})">
            ${t.name}
        </button>
    `).join('');
}

// ===== 전역 노출 =====
window.searchCandidates = searchCandidates;
window.recommendUniversities = recommendUniversities;
window.handleFilterChange = handleFilterChange;
window.resetFilters = resetFilters;
window.toggleUniv = toggleUniv;
window.toggleCardOnOff = toggleCardOnOff;
window.addNewTimetable = addNewTimetable;
window.switchTab = switchTab;
window.openSecretPdf = openSecretPdf;
window.openFortuneModal = openFortuneModal;
window.closeFortuneModal = closeFortuneModal;
window.crackCookieModal = crackCookieModal;
window.toggleScheduleImage = toggleScheduleImage;
window.showWelcomeModal = showWelcomeModal;
window.closeWelcomeModal = closeWelcomeModal;

function toggleScheduleImage() {
    const content = document.getElementById('schedule-image-content');
    const arrow = document.getElementById('schedule-arrow');
    if (!content || !arrow) return;
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        arrow.style.transform = 'rotate(180deg)';
    } else {
        content.style.display = 'none';
        arrow.style.transform = 'rotate(0deg)';
    }
}

// ===== D-day & 비밀번호 PDF & 포춘쿠키 추가 기능 =====
function updateDDay() {
    const targetDate = new Date('2026-11-19T08:00:00');
    const now = new Date();
    const diff = targetDate - now;
    
    const dDayRightEl = document.getElementById('dday-header-right');
    const dDayNumbersEl = document.getElementById('dday-numbers');
    if (!dDayRightEl || !dDayNumbersEl) return;

    if (diff <= 0) {
        dDayRightEl.textContent = '2026.11.19. / D-Day 경과';
        dDayNumbersEl.textContent = '00:00:00:00';
    } else {
        const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const diffMinutes = Math.floor((diff / (1000 * 60)) % 60);
        const diffSeconds = Math.floor((diff / 1000) % 60);
        
        dDayRightEl.textContent = `2026.11.19. / D-${diffDays}`;
        
        const pad = (num) => String(num).padStart(2, '0');
        dDayNumbersEl.textContent = `${diffDays}:${pad(diffHours)}:${pad(diffMinutes)}:${pad(diffSeconds)}`;
    }
}

function openSecretPdf() {
    window.open('300.pdf', '_blank');
}

const fortunes = [
    "지금 흐르는 땀방울이 미래의 당신을 더욱 빛나게 할 것입니다.",
    "끝까지 포기하지 않는 자가 원하는 결과를 얻습니다.",
    "당신은 생각보다 훨씬 더 강하고 지혜로운 사람입니다.",
    "오늘 한 걸음 내딛은 노력이 합격이라는 큰 결실로 돌아올 것입니다.",
    "자신을 믿으세요. 당신은 충분히 해낼 수 있는 사람입니다.",
    "힘든 시기는 지나가고, 곧 눈부신 성공의 순간이 찾아올 것입니다.",
    "매일 조금씩 성장하는 당신의 노력이 이미 결실을 맺기 시작했습니다.",
    "오늘 최선을 다한 당신, 합격의 주인공은 바로 당신입니다.",
    "흔들리지 않고 피는 꽃은 없습니다. 오늘의 고민이 당신을 더 단단하게 만듭니다.",
    "당신의 꿈을 응원합니다. 할 수 있습니다!"
];

function openFortuneModal() {
    const modal = document.getElementById('fortune-modal');
    if (modal) {
        modal.style.display = 'flex';
        crackCookieModal();
    }
}

function closeFortuneModal() {
    const modal = document.getElementById('fortune-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function crackCookieModal() {
    const textEl = document.getElementById('fortune-modal-text');
    if (!textEl) return;
    const randomIndex = Math.floor(Math.random() * fortunes.length);
    textEl.style.opacity = '0';
    setTimeout(() => {
        textEl.textContent = fortunes[randomIndex];
        textEl.style.opacity = '1';
    }, 200);
}

// ===== 웰컴 모달 =====
function showWelcomeModal() {
    const modal = document.getElementById('welcome-modal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeWelcomeModal() {
    const modal = document.getElementById('welcome-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// ===== 인터랙티브 전체 일정표 렌더링 (daily.png 스타일) =====

/**
 * 모집계열 필드에서 짧은 구분자(창의형, 일반형, 1교시, 오전 등)를 추출한다.
 * 대학명이 같아도 전형 유형이 다를 때 사용자가 구분할 수 있도록.
 */
function extractSubLabel(dept) {
    if (dept.includes('창의형')) return '창의';
    if (dept.includes('일반형')) return '일반';
    if (dept.includes('1교시')) return '1교시';
    if (dept.includes('2교시')) return '2교시';
    if (dept.includes('3교시')) return '3교시';
    if (dept.includes('오전')) return '오전';
    if (dept.includes('오후')) return '오후';
    if (dept.includes('Ⅰ') && !dept.includes('Ⅱ')) return 'Ⅰ';
    if (dept.includes('Ⅱ')) return 'Ⅱ';
    if (dept.includes('T1')) return 'T1';
    if (dept.includes('T2')) return 'T2';
    if (dept.includes('T3')) return 'T3';
    if (dept.includes('T4')) return 'T4';
    return '';
}

function shortenUnivName(name) {
    if (!name) return '';
    const mappings = {
        '서울시립대학교': '시립', '서울시립대': '시립',
        '홍익대학교': '홍익', '홍익대': '홍익',
        '가톨릭대학교': '가톨릭', '가톨릭대': '가톨릭',
        '중앙대학교': '중앙', '중앙대': '중앙',
        '단국대학교': '단국', '단국대': '단국',
        '상명대학교': '상명', '상명대': '상명',
        '연세대학교': '연세', '연세대': '연세',
        '건국대학교': '건국', '건국대': '건국',
        '경희대학교': '경희', '경희대': '경희',
        '고려대학교': '고려', '고려대': '고려',
        '서강대학교': '서강', '서강대': '서강',
        '성균관대학교': '성균관', '성균관대': '성균관',
        '숙명여자대학교': '숙명여', '숙명여대': '숙명여',
        '숭실대학교': '숭실', '숭실대': '숭실',
        '동국대학교': '동국', '동국대': '동국',
        '경북대학교': '경북', '경북대': '경북',
        '광운대학교': '광운', '광운대': '광운',
        '세종대학교': '세종', '세종대': '세종',
        '이화여자대학교': '이화여', '이화여대': '이화여',
        '한국외국어대학교': '외대', '한국외대': '외대',
        '한양대학교': '한양', '한양대': '한양',
        '가천대학교': '가천', '가천대': '가천',
        '을지대학교': '을지', '을지대': '을지',
        '서경대학교': '서경', '서경대': '서경',
        '서울여자대학교': '서울여', '서울여대': '서울여',
        '한국항공대학교': '항공', '한국항공대': '항공',
        '수원대학교': '수원', '수원대': '수원',
        '한국공학대학교': '공학대', '한국공학대': '공학대',
        '삼육대학교': '삼육', '삼육대': '삼육',
        '서울과학기술대학교': '과기대', '서울과기대': '과기대',
        '한국기술교육대학교': '기술교', '한국기술교육대': '기술교',
        '경기대학교': '경기', '경기대': '경기',
        '동덕여자대학교': '동덕여', '동덕여대': '동덕여',
        '강남대학교': '강남', '강남대': '강남',
        '부산대학교': '부산', '부산대': '부산',
        '덕성여자대학교': '덕성여', '덕성여대': '덕성여',
        '성신여자대학교': '성신여', '성신여대': '성신여',
        '신한대학교': '신한', '신한대': '신한',
        '한신대학교': '한신', '한신대': '한신'
    };
    
    // Check key mapping
    for (const [key, val] of Object.entries(mappings)) {
        if (name.includes(key)) {
            let branch = '';
            if (name.includes('미래')) branch = '(미)';
            if (name.includes('세종')) branch = '(세)';
            if (name.includes('글로벌')) branch = '(글)';
            return val + branch;
        }
    }
    return name.replace(/대학교/g, '').replace(/대학/g, '');
}

function getUnivTextColor(name) {
    if (!name) return '#000000';
    // 여대 판정
    const isWomen = name.includes('여대') || name.includes('여자') || name.includes('이화') || name.includes('동덕') || name.includes('덕성') || name.includes('숙명') || name.includes('서울여');
    if (isWomen) return '#db2777'; // Pink
    
    // 서울외 지역 판정
    const isOutsideSeoul = name.includes('미래') || name.includes('세종') || name.includes('죽전') || name.includes('경북') || name.includes('가천') || name.includes('을지') || name.includes('항공') || name.includes('수원') || name.includes('공학') || name.includes('기술') || name.includes('강남') || name.includes('부산') || name.includes('신한') || name.includes('한신') || name.includes('가톨릭') || name.includes('단국') || (name.includes('경기') && !name.includes('서울캠'));
    if (isOutsideSeoul) return '#16a34a'; // Green
    
    // 서울 지역 (기본값)
    return '#000000'; // Black
}

// ===== 인터랙티브 전체 일정표 렌더링 (daily.png 스타일) =====

function renderInteractiveSchedule() {
    const container = document.getElementById('interactive-schedule-table');
    if (!container || state.univData.length === 0) return;

    const f = getFilters();
    const active = getActiveTimetable();

    const toSortKey = d => {
        if (d.includes('수능일') || d.includes('11.19')) return 1119;
        const m = d.match(/(\d+)\.(\d+)\./);
        return m ? parseInt(m[1]) * 100 + parseInt(m[2]) : 9999;
    };
    
    // 전체 일정에 수능일을 가상으로 끼워 넣습니다 (daily.png 캘린더 장벽)
    const baseDates = [...new Set(state.univData.map(r => r['고사 일자']).filter(Boolean))];
    if (!baseDates.includes('11.19.(수능일)')) {
        baseDates.push('11.19.(수능일)');
    }
    const allDates = baseDates.sort((a, b) => toSortKey(a) - toSortKey(b));

    const allTracks = ['인문', '자연', '의약'];
    
    const trackMeta = {
        '인문': { label: '📝 인문', color: '#be3a63', bg: 'rgba(190,58,99,0.03)' },
        '자연': { label: '🔢 자연', color: '#1a6b44', bg: 'rgba(26,107,68,0.03)' },
        '의약': { label: '🏥 의약', color: '#6b3fa0', bg: 'rgba(107,63,160,0.03)' },
    };

    let tableHtml = '';

    if (!state.scheduleTranspose) {
        // Mode A: 세로형 (행 = 날짜, 열 = 계열)
        let rowsHtml = '';
        allDates.forEach(date => {
            if (date.includes('수능일')) {
                rowsHtml += `<tr style="border-bottom: 2px solid #000;">
                    <td class="sched-date" style="background:#000; color:#fff; font-size:0.75rem; font-weight:800; padding: 0.35rem 0.25rem;">11.19.(목)</td>
                    <td colspan="3" style="background:#111; color:#ef4444; font-weight:800; text-align:center; font-size:0.75rem; padding:0.35rem; border: 1px solid #000; letter-spacing: 0.1em;">⚡ 2027학년도 대학수학능력시험 (수능일)</td>
                </tr>`;
                return;
            }

            const rowsForDate = state.univData.filter(r => r['고사 일자'] === date);
            if (rowsForDate.length === 0) return;

            const cells = allTracks.map((trackType, colIdx) => {
                const meta = trackMeta[trackType];
                const trackRows = rowsForDate.filter(r => determineTracks(r).includes(trackType));
                
                const seenSession = new Set();
                const buttons = [];

                trackRows.forEach(r => {
                    const uName = r['대학명'];
                    if (seenSession.has(uName)) return;
                    seenSession.add(uName);

                    const shortName = shortenUnivName(uName);
                    const displayLabel = shortName;
                    
                    // 해당 대학, 계열, 날짜에 해당하는 모든 전형들
                    const matches = trackRows.filter(tr => tr['대학명'] === uName);
                    const isAdded = matches.some(tr => active.univs.includes(`${uName} (${trackType})|${tr._rowIdx}`));
                    const isMatched = matches.some(tr => rowMatchesFilter(tr, f));

                    const colorVal = getUnivTextColor(uName);
                    const c = meta.color;
                    let btnStyle = isAdded
                        ? `background:${c};color:#fff;border-color:${c};`
                        : `background:transparent;color:${colorVal};border-color:${colorVal};`;
                    
                    if (!isMatched) {
                        btnStyle += 'opacity:0.25;filter:grayscale(60%);';
                    }

                    buttons.push(
                        `<button class="sched-btn${isAdded ? ' sched-btn--on' : ''}" style="${btnStyle}" onclick="toggleUnivAndRenderSchedule('${uName.replace(/'/g, "\\'")}', '${trackType}', '${date.replace(/'/g, "\\'")}')">${displayLabel}${isAdded ? ' ✓' : ''}</button>`
                    );
                });

                return `<td class="sched-cell" style="background:${meta.bg}; padding: 0.25rem;"><div style="display: flex; flex-wrap: wrap; gap: 3px; justify-content: flex-start; align-content: flex-start;">${buttons.join('')}</div></td>`;
            }).join('');

            rowsHtml += `<tr>
                <td class="sched-date">${date}</td>
                ${cells}
            </tr>`;
        });

        tableHtml = `
            <table class="sched-table" style="width:100%;">
                <thead>
                    <tr>
                        <th style="background:#3a3a4a; width:10%; font-size:0.7rem;">일자</th>
                        <th style="background:#be3a63; width:33%; font-size:0.7rem;">📝 인문</th>
                        <th style="background:#1a6b44; width:33%; font-size:0.7rem;">🔢 자연</th>
                        <th style="background:#6b3fa0; width:24%; font-size:0.7rem;">🏥 의약</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        `;
    } else {
        // Mode B: 가로형 - 날짜가 한열에 다 있도록 단일 테이블 구조로 배치 조정
        const headerCols = allDates.map(d => {
            if (d.includes('수능일')) {
                return `<th style="background:#000; color:#ef4444; min-width:20px; max-width:24px; font-size:0.55rem; padding:0.1rem 0; font-weight:800; border:1px solid #1a1a24; text-align:center; vertical-align:middle; white-space:nowrap; line-height:1.05;">11<br><span style="font-size:0.6rem; font-weight:900; border-top:1px solid #ef4444; border-bottom:1px solid #ef4444; display:block; margin:1px 0; padding:0;">19</span>수능</th>`;
            }
            
            // "10.11.(일)" or "11.1.(일)" 등 형식 파싱
            // 월, 일, 요일을 개별로 추출하여 디자인 적용
            const m = d.match(/(\d+)\.(\d+)\.\(([가-힣]+)\)/);
            if (m) {
                const month = m[1];
                const day = m[2];
                const yoil = m[3];
                let yoilColor = '#fff';
                if (yoil === '토') yoilColor = '#2563eb';
                if (yoil === '일') yoilColor = '#dc2626';
                
                return `
                    <th class="sched-th-date" style="padding: 0; min-width: 48px; border: 1px solid rgba(255,255,255,0.12);">
                        <div style="background: rgba(255,255,255,0.08); font-size: 0.65rem; font-weight: 800; padding: 2px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">${month}</div>
                        <div style="font-size: 0.95rem; font-weight: 800; padding: 2px 0; color: #fff; line-height: 1;">${day}</div>
                        <div style="font-size: 0.72rem; font-weight: bold; padding: 2px 0; color: ${yoilColor}; border-top: 1px dashed rgba(255,255,255,0.15);">${yoil}</div>
                    </th>
                `;
            }
            
            const cleanD = d.replace(/\.\([가-힣]+\)$/, m => `<br><span style="font-size:0.62rem; font-weight:normal;">${m}</span>`);
            return `<th class="sched-th-date" style="font-size: 0.65rem; min-width: 45px; padding: 0.25rem 0.1rem; line-height: 1.2;">${cleanD}</th>`;
        }).join('');

        let bodyRows = '';
        allTracks.forEach(trackType => {
            const meta = trackMeta[trackType];
            const cells = allDates.map(date => {
                if (date.includes('수능일')) {
                    return `<td class="sched-cell sched-cell-suneung" style="background:#0b0c10; padding:0; border: 1px solid #1a1a24; text-align:center; color:#ef4444; font-size:0.55rem; font-weight:800; vertical-align:middle; min-width:20px; max-width:24px; line-height:1.2;">수<br>능<br>일</td>`;
                }
                const rowsForCell = state.univData.filter(r => r['고사 일자'] === date && determineTracks(r).includes(trackType));
                const seenSession = new Set();
                const buttons = [];
                rowsForCell.forEach(r => {
                    const uName = r['대학명'];
                    if (seenSession.has(uName)) return;
                    seenSession.add(uName);

                    const shortName = shortenUnivName(uName);
                    const displayLabel = shortName;
                    
                    const matches = rowsForCell.filter(tr => tr['대학명'] === uName);
                    const isAdded = matches.some(tr => active.univs.includes(`${uName} (${trackType})|${tr._rowIdx}`));
                    const isMatched = matches.some(tr => rowMatchesFilter(tr, f));

                    const colorVal = getUnivTextColor(uName);
                    const c = meta.color;
                    let btnStyle = isAdded
                        ? `background:${c};color:#fff;border-color:${c};`
                        : `background:transparent;color:${colorVal};border-color:${colorVal};`;
                    if (!isMatched) btnStyle += 'opacity:0.25;filter:grayscale(60%);';

                    buttons.push(
                        `<button class="sched-btn-block${isAdded ? ' sched-btn-block--on' : ''}" style="${btnStyle}" onclick="toggleUnivAndRenderSchedule('${uName.replace(/'/g, "\\'")}', '${trackType}', '${date.replace(/'/g, "\\'")}')">${displayLabel}${isAdded ? '✓' : ''}</button>`
                    );
                });
                return `<td class="sched-cell" style="background:${meta.bg}; padding: 0.1rem 0.05rem; text-align: center;"><div style="display: flex; flex-wrap: wrap; gap: 1px; justify-content: center; align-items: flex-start; min-height: 28px;">${buttons.join('')}</div></td>`;
            }).join('');

            let verticalLabel = '';
            if (trackType === '인문') verticalLabel = '📝<br>인<br>문';
            else if (trackType === '자연') verticalLabel = '🔢<br>자<br>연';
            else if (trackType === '의약') verticalLabel = '🏥<br>의<br>약';

            bodyRows += `<tr>
                <th class="sched-track-header" style="background:${meta.color}; font-size:0.65rem; padding: 0.25rem 0.05rem; min-width: 32px; max-width: 32px; width: 32px; line-height: 1.2;">${verticalLabel}</th>
                ${cells}
            </tr>`;
        });

        tableHtml = `
            <table class="sched-table">
                <thead>
                    <tr>
                        <th class="sched-track-header" style="background:#3a3a4a; min-width:32px; max-width:32px; width:32px; font-size:0.6rem; padding:0.25rem 0.05rem; line-height:1.2;">계열<br>\<br>날짜</th>
                        ${headerCols}
                    </tr>
                </thead>
                <tbody>${bodyRows}</tbody>
            </table>
        `;
    }

    container.innerHTML = `
        <style>
            #interactive-schedule-table { 
                overflow-x: auto;
                max-height: 600px; 
                overflow-y: auto; 
                border-radius: 0.5rem;
                border: 1px solid var(--border-color);
                width: 100%;
                -webkit-overflow-scrolling: touch;
            }
            .sched-table {
                width: 100%;
                min-width: max-content;
                border-collapse: collapse;
                font-size: 0.7rem;
                table-layout: fixed;
            }
            .sched-table thead th {
                padding: 0.15rem 0.05rem;
                color: #fff;
                font-weight: 700;
                text-align: center;
                border: 1px solid rgba(255,255,255,0.15);
                font-size: 0.65rem;
            }
            .sched-th-date {
                padding: 0.15rem 0.05rem;
                background: #3a3a4a;
                color: #fff;
                font-weight: 700;
                text-align: center;
                border: 1px solid rgba(255,255,255,0.12);
            }
            .sched-track-header {
                color: #fff;
                font-weight: 700;
                padding: 0.15rem 0.05rem;
                border: 1px solid rgba(255,255,255,0.15);
                white-space: nowrap;
                text-align: center;
                font-size: 0.65rem;
                vertical-align: middle;
            }
            .sched-date {
                font-weight: 700;
                white-space: nowrap;
                padding: 0.15rem 0.05rem;
                border: 1px solid var(--border-color);
                background: var(--bg-card);
                text-align: center;
                color: var(--text-main);
                font-size: 0.68rem;
                vertical-align: middle;
            }
            .sched-cell {
                border: 1px solid var(--border-color);
                padding: 0.1rem 0.05rem;
                vertical-align: top;
            }
            /* Mode A (계열이 열일 때, 이전버전 가로 나열 알약형태 버튼) */
            .sched-btn {
                display: inline-block;
                margin: 1.5px;
                padding: 1.5px 5px;
                border-radius: 999px;
                border: 1.2px solid;
                font-size: 0.68rem;
                font-weight: 600;
                cursor: pointer;
                font-family: var(--font-family);
                transition: opacity 0.15s, transform 0.1s, box-shadow 0.15s;
                box-shadow: 0 1px 1px rgba(0,0,0,0.05);
                white-space: nowrap;
                line-height: 1.2;
                text-align: center;
            }
            .sched-btn:hover { opacity: 0.85; transform: translateY(-1px); box-shadow: 0 3px 6px rgba(0,0,0,0.12); }
            .sched-btn--on { box-shadow: 0 2px 4px rgba(0,0,0,0.18); }

            /* Mode B (날짜가 열일 때, 세로 콤팩트 채우기 버튼) */
            .sched-btn-block {
                display: inline-block;
                margin: 1px;
                padding: 1px 3px;
                border-radius: 3px;
                border: 1px solid;
                font-size: 0.72rem;
                font-weight: 700;
                letter-spacing: -0.05em;
                cursor: pointer;
                font-family: var(--font-family);
                transition: opacity 0.15s, transform 0.1s, box-shadow 0.15s;
                box-shadow: 0 1px 1px rgba(0,0,0,0.05);
                white-space: nowrap;
                line-height: 1.15;
                text-align: center;
            }
            .sched-btn-block:hover { opacity: 0.85; transform: translateY(-1px); }
            .sched-btn-block--on { box-shadow: 0 1.5px 3px rgba(0,0,0,0.15); font-weight: 800; }
        </style>
        ${tableHtml}
    `;
}

function toggleUnivAndRenderSchedule(uName, trackType, date) {
    const active = getActiveTimetable();
    const targetRows = state.univData.filter(r => 
        r['고사 일자'] === date && 
        determineTracks(r).includes(trackType) && 
        r['대학명'] === uName
    );
    if (targetRows.length === 0) return;

    const keys = targetRows.map(r => `${uName} (${trackType})|${r._rowIdx}`);
    const anyAdded = keys.some(k => active.univs.includes(k));

    if (anyAdded) {
        keys.forEach(k => {
            const idx = active.univs.indexOf(k);
            if (idx > -1) active.univs.splice(idx, 1);
        });
    } else {
        keys.forEach(k => {
            if (!active.univs.includes(k)) active.univs.push(k);
        });
    }

    renderActiveTags();
    renderGrid();
    renderSummary();
    recommendUniversities(false);
    renderInteractiveSchedule();
}

function toggleScheduleTranspose() {
    state.scheduleTranspose = !state.scheduleTranspose;
    renderInteractiveSchedule();
}

function toggleScheduleImage() {
    const content = document.getElementById('schedule-image-content');
    const arrow = document.getElementById('schedule-arrow');
    if (!content) return;
    if (content.style.display === 'none') {
        content.style.display = 'block';
        if (arrow) arrow.style.transform = 'rotate(180deg)';
        renderInteractiveSchedule();
    } else {
        content.style.display = 'none';
        if (arrow) arrow.style.transform = 'rotate(0deg)';
    }
}

// ===== DOM 시작 =====
document.addEventListener('DOMContentLoaded', init);
