// app.js

// ===== 데이터 정규화 유틸 =====
function normalizeMath(raw) {
    if (!raw) return '해당없음';
    let trimmed = raw.trim();
    if (['없음', '해당 없음', '해당없음', '신설', ''].includes(trimmed)) return '해당없음';
    
    trimmed = trimmed.replace(/미적분/g, '미적')
                     .replace(/확률과\s*통계/g, '확통')
                     .replace(/확률과통계/g, '확통');

    if ((trimmed.includes('수Ⅰ') || trimmed.includes('수I')) && !trimmed.includes('미적') && !trimmed.includes('확통') && !trimmed.includes('기하')) return '해당없음';
    
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

function normalizeAnswer(raw) {
    if (!raw) return '해당없음';
    const trimmed = raw.trim();
    if (['없음', '해당 없음', '해당없음', '신설', ''].includes(trimmed)) return '해당없음';
    if (trimmed.includes('/')) {
        const sub = trimmed.split('/').map(s => normalizeAnswer(s.trim())).filter(s => s !== '해당없음');
        return sub.length > 0 ? sub.join('/') : '해당없음';
    }
    if (trimmed.includes('장문')) return '장문형';
    if (trimmed.includes('분할')) return '분할형';
    if (trimmed.includes('쪼개기') || trimmed.includes('200')) return '쪼개기형';
    if (trimmed.includes('자유')) return '자유형';
    return '해당없음';
}

function normalizeData(raw) {
    return raw.map((row, idx) => ({
        ...row,
        '_rowIdx': idx,
        '_수리정규화': normalizeMath(row['수리논술 범위/난이도']),
        '_답안정규화': normalizeAnswer(row['인문논술 답안 유형/분량']),
    }));
}

function determineTracks(row) {
    const dept = row['모집계열 및 세부 학과'] || '';
    const ansNorm = row['_답안정규화'] || '해당없음';
    const mathNorm = row['_수리정규화'] || '해당없음';

    const tracks = new Set();

    const hasMath = (mathNorm !== '해당없음' && mathNorm !== '');
    const hasHuman = (ansNorm !== '해당없음' && ansNorm !== '');

    const isBusiness = dept.includes('경영') || dept.includes('경제') || dept.includes('상경') || dept.includes('경상');
    const isHumanities = dept.includes('인문') || dept.includes('사회') || dept.includes('사범') || dept.includes('교육') || dept.includes('예술') || dept.includes('체육') || dept.includes('의류') || dept.includes('어학') || dept.includes('언어형') || dept.includes('인문계');
    const isNatural = dept.includes('자연') || dept.includes('의예') || dept.includes('치의예') || dept.includes('의학') || dept.includes('약학') || dept.includes('한의예(자)') || dept.includes('공학') || dept.includes('수의예') || dept.includes('첨단ICT') || dept.includes('소프트웨어') || dept.includes('반도체') || dept.includes('컴퓨터') || dept.includes('인공지능') || dept.includes('생명') || dept.includes('IT') || dept.includes('자연계');

    if (isNatural && hasMath) {
        tracks.add('자연');
    }

    if (isBusiness) {
        tracks.add('인문(상경)');
    }

    if (isHumanities) {
        tracks.add('인문');
    }

    if (dept.includes('전 모집단위') || dept.includes('통합계열') || dept.includes('통합') || dept.includes('캠퍼스자율전공')) {
        if (hasHuman || isHumanities) {
            tracks.add('인문');
        }
        if (hasMath || isNatural) {
            tracks.add('자연');
        }
        if (isBusiness) {
            tracks.add('인문(상경)');
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

    const searchInput = document.getElementById('univ-search');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchCandidates();
            }
        });
    }
}

// ===== 필터 값 가져오기 =====
function getFilters() {
    const trackVal = document.querySelector('input[name="track"]:checked')?.value || '상관없음';
    const getMathLevel = key => document.querySelector(`input[name="${key}"]:checked`)?.value || '불포함';
    const getChecked = selector => [...document.querySelectorAll(selector + ':checked')].map(c => c.value);

    return {
        계열: trackVal,
        미적: getMathLevel('미적'),
        확통: getMathLevel('확통'),
        기하: getMathLevel('기하'),
        제시문유형: getChecked('.type-cb'),
        답안유형: getChecked('.ans-cb'),
    };
}

// ===== 필터 변경 핸들러 =====
function handleFilterChange() {
    renderGrid();
    renderSummary();
}

// ===== 필터 초기화 =====
function resetFilters() {
    const defaultTrack = document.querySelector('input[name="track"][value="상관없음"]');
    if (defaultTrack) defaultTrack.checked = true;

    ['미적', '확통', '기하'].forEach(key => {
        const el = document.querySelector(`input[name="${key}"][value="불포함"]`);
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
    if (f.계열 !== '상관없음') {
        const track = row['모집계열 및 세부 학과'] || '';
        let trackMatch = false;

        if (f.계열 === '인문') {
            trackMatch = track.includes('인문') || track.includes('사회') || track.includes('사범');
        } else if (f.계열 === '자연') {
            trackMatch = track.includes('자연') || track.includes('의') || track.includes('약') || track.includes('공학');
        } else if (f.계열 === '상경포함') {
            trackMatch = track.includes('상경') || track.includes('경영') || track.includes('경제') || track.includes('인문') || track.includes('통합');
        }

        if (!trackMatch) return false;
    }

    const isMathFiltered = f.미적 !== '불포함' || f.확통 !== '불포함' || f.기하 !== '불포함';
    const isHumanFiltered = f.제시문유형.length > 0 || f.답안유형.length > 0;

    if (!isMathFiltered && !isHumanFiltered) {
        return true;
    }

    const mathNorm = row['_수리정규화'] || '';
    const ansNorm = row['_답안정규화'] || '';
    const presentType = row['제시문 유형'] || '';

    let mathPass = false;

    if (isMathFiltered) {
        if (mathNorm !== '해당없음' && mathNorm !== '') {
            const getLevelVal = lvl => ({ '상': 3, '중상': 2, '중': 1 }[lvl] || 0);
            const getCardLevel = subject => {
                if (!mathNorm.includes(subject)) return 0;
                const m = mathNorm.match(new RegExp(subject + '\\(([^)]+)\\)'));
                return getLevelVal(m ? m[1] : '중');
            };

            let excluded = false;
            for (const s of ['미적', '확통', '기하']) {
                if (f[s] === '불포함' && getCardLevel(s) > 0) {
                    excluded = true;
                    break;
                }
            }

            if (!excluded) {
                let satisfied = false;
                for (const s of ['미적', '확통', '기하']) {
                    if (f[s] !== '불포함') {
                        const cl = getCardLevel(s);
                        if (cl > 0 && cl <= getLevelVal(f[s])) {
                            satisfied = true;
                            break;
                        }
                    }
                }
                mathPass = satisfied;
            }
        }
    }

    let humanPass = false;

    if (isHumanFiltered) {
        if (ansNorm !== '해당없음' && ansNorm !== '') {
            const presentMatch = f.제시문유형.length === 0 || f.제시문유형.some(t => {
                if (t === '통계') return presentType.includes('통계');
                if (t === '도표') return presentType.includes('도표');
                if (t === '수학') return presentType.includes('수학') || presentType.includes('수리');
                if (t === '영어') return presentType.includes('영어');
                return false;
            });

            const ansMatch = f.답안유형.length === 0 || f.답안유형.some(t => {
                const target = t === '장문' ? '장문형'
                    : t === '분할' ? '분할형'
                    : t === '쪼개기' ? '쪼개기형'
                    : t === '자유' ? '자유형'
                    : t;
                return ansNorm.includes(target);
            });

            humanPass = presentMatch && ansMatch;
        }
    }

    if (isMathFiltered && isHumanFiltered) return mathPass && humanPass;
    if (isMathFiltered) return mathPass;
    if (isHumanFiltered) return humanPass;
    return true;
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

    renderRecommendCandidates(matched, `🎯 조건 추천 대학`, forceShow);
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
        if (active.univs.length >= 8) {
            alert('한 계획표에 최대 8개 대학까지 담을 수 있습니다.');
            return;
        }

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

    if (active.univs.length === 0) {
        container.innerHTML = `<p style="text-align:center; padding:3rem 0; color:var(--text-muted);">대학을 검색하거나 추천받아 담아주세요.</p>`;
        return;
    }

    let matchingRows = [];

    active.univs.forEach(uniqueKey => {
        const match = uniqueKey.match(/^(.+)\s\((.+)\)$/);
        if (!match) return;
        const uName = match[1];
        const trackType = match[2];
        const rows = state.univData.filter(row => row['대학명'] === uName);

        rows.forEach(row => {
            const rowTracks = determineTracks(row);

            if (rowTracks.includes(trackType)) {
                matchingRows.push(row);
            }
        });
    });

    const f = getFilters();

    if (f.계열 !== '상관없음') {
        matchingRows = matchingRows.filter(row => {
            const track = row['모집계열 및 세부 학과'] || '';

            if (f.계열 === '인문') {
                return track.includes('인문') || track.includes('사회') || track.includes('사범');
            } else if (f.계열 === '자연') {
                return track.includes('자연') || track.includes('의') || track.includes('약') || track.includes('공학');
            } else if (f.계열 === '상경포함') {
                return track.includes('상경') || track.includes('경영') || track.includes('경제') || track.includes('인문') || track.includes('통합');
            }

            return true;
        });
    }

    if (matchingRows.length === 0) {
        container.innerHTML = `<p style="text-align:center; padding:3rem 0; color:var(--text-muted);">현재 계열 필터에 부합하는 담은 대학의 일정 데이터가 없습니다.</p>`;
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
        const slot = parseTimeSlot(row['고사 시간 (입실 포함)']);
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
                    const ansNorm = row['_답안정규화'] || '해당없음';
                    const hasMath = mathNorm !== '해당없음' && mathNorm !== '';
                    const hasHuman = ansNorm !== '해당없음' && ansNorm !== '';

                    const typeBadge = hasMath
                        ? `<span style="display:inline-block; font-size:0.65rem; background-color:#818cf8; color:white; padding:1px 4px; border-radius:3px; margin-right:3px;">수리</span>`
                        : hasHuman
                            ? `<span style="display:inline-block; font-size:0.65rem; background-color:#f43f5e; color:white; padding:1px 4px; border-radius:3px; margin-right:3px;">인문</span>`
                            : '';

                    const minStr = row['수능 최저학력기준 및 반영 방법'] || '';
                    const hasMin = minStr && minStr !== '없음';

                    const minBadge = hasMin
                        ? `<span style="display:inline-block; font-size:0.65rem; background-color:#f59e0b; color:white; padding:1px 4px; border-radius:3px;">최저</span>`
                        : '';

                    html += `
                        <div class="timetable-card ${isOn ? '' : 'off'} ${isOverlap ? 'overlap' : ''}" 
                             style="--stack-idx: ${i}; z-index: ${cards.length - i};"
                             onclick="toggleCardOnOff(${rowIdx})">
                            <div class="card-header">
                                <span class="card-univ">${row['대학명']}</span>
                                <span class="card-toggle">${isOn ? 'ON' : 'OFF'}</span>
                            </div>
                            <div class="card-track">${row['모집계열 및 세부 학과'] || ''}</div>
                            <div class="card-time">🕐 ${row['고사 시간 (입실 포함)'] || '시간 미정'}</div>
                            <div style="margin-top:0.25rem;">${typeBadge}${minBadge}</div>
                            ${hasMath ? `<div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">📐 ${mathNorm}</div>` : ''}
                            ${hasHuman ? `<div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">📝 ${ansNorm}</div>` : ''}
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
        const match = uniqueKey.match(/^(.+)\s\((.+)\)$/);
        if (!match) return;
        const uName = match[1];
        const trackType = match[2];
        const rows = state.univData.filter(row => row['대학명'] === uName);

        rows.forEach(row => {
            const rowTracks = determineTracks(row);

            if (rowTracks.includes(trackType)) {
                matchingRows.push(row);
            }
        });
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

    activeRows.sort((a, b) => {
        const dateA = a['고사 일자'] || '';
        const dateB = b['고사 일자'] || '';

        if (dateA !== dateB) return dateA.localeCompare(dateB);

        return parseTimeForSort(a['고사 시간 (입실 포함)']) - parseTimeForSort(b['고사 시간 (입실 포함)']);
    });

    body.innerHTML = activeRows.map(row => {
        const typeParts = [];

        if (row['제시문 유형'] && row['제시문 유형'] !== '없음' && row['제시문 유형'] !== '정보 없음') {
            typeParts.push(`제시문: ${row['제시문 유형']}`);
        }

        if (row['인문논술 답안 유형/분량'] && row['인문논술 답안 유형/분량'] !== '없음' && row['인문논술 답안 유형/분량'] !== '해당 없음') {
            typeParts.push(`답안: ${row['인문논술 답안 유형/분량']}`);
        }

        const humanStr = typeParts.length > 0 ? typeParts.join(', ') : '정보 없음';

        return `
            <div class="summary-card">
                <div class="summary-univ">${row['대학명']} <span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">(${row['모집계열 및 세부 학과']})</span></div>
                <div style="margin-top:0.4rem; display:flex; flex-direction:column; gap:0.2rem;">
                    <div>📅 <strong>일정:</strong> ${row['고사 일자'] || '날짜 미정'} ${row['고사 시간 (입실 포함)'] || '시간 미정'}</div>
                    <div>📐 <strong>수리논술:</strong> ${row['수리논술 범위/난이도'] || '해당 없음'}</div>
                    <div>📝 <strong>인문논술:</strong> ${humanStr}</div>
                    <div>🎯 <strong>수능최저:</strong> ${row['수능 최저학력기준 및 반영 방법'] || '없음'}</div>
                </div>
            </div>
        `;
    }).join('');

    panel.style.display = 'block';
}

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

// ===== DOM 시작 =====
document.addEventListener('DOMContentLoaded', init);
