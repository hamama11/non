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
        const essayRaw = row['언어논술 제시문 및 답안 유형'] || '';
        const mathRaw = row['수리논술 범위 및 난이도'] || '';
        const parsed = parseEssayColumn(essayRaw);

        // 반영 비율 0 -> - 치환 처리 (ex: 70:0:0 -> 70:-:-)
        const origRatio = row['논술:교과:비'] || row['전형 비율 (논술:교과:비교과)'] || '-';
        const formattedRatio = origRatio.split(':').map(v => v.trim() === '0' ? '-' : v.trim()).join(':');

        return {
            ...row,
            '_rowIdx': idx,
            '_수리정규화': normalizeMath(mathRaw),
            '_제시문': parsed.present,
            '_답안유형': parsed.answerType,
            '_답안분량': parsed.answerLength,
            '_언어논술원문': essayRaw,
            '논술:교과:비': formattedRatio // 가공된 전형비율 속성 표준화
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
    const isNatural = (dept.includes('자연') || dept.includes('공학') || dept.includes('첨단ICT') || dept.includes('소프트웨어') || dept.includes('반도체') || dept.includes('컴퓨터') || dept.includes('인공지능') || dept.includes('생명') || dept.includes('IT') || dept.includes('자연계')) && !isMed;

    if (isMed) {
        tracks.add('의약');
    } else if (isNatural) {
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
        const totalCount = active.univs.length;
        let onCount = 0;
        active.univs.forEach(uniqueKey => {
            const match = uniqueKey.match(/^(.+)\s\(([^|)]+)\)(?:\|(\d+))?$/);
            if (!match) return;
            const rowIdxStr = match[3];
            if (rowIdxStr !== undefined) {
                const rowIdx = parseInt(rowIdxStr);
                const isManualOff = active.manualOverrides[rowIdx] === false;
                if (!isManualOff) {
                    onCount++;
                }
            } else {
                onCount++;
            }
        });
        countBadge.textContent = totalCount > 0 ? `(${onCount}/${totalCount})개` : '';
        countBadge.style.display = totalCount > 0 ? 'inline-block' : 'none';
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

    // 수능 최저학력기준 곤란도(난이도) 평가 모델
    const evaluateMinimumDifficulty = minText => {
        if (!minText || minText === '없음' || minText === '정보 없음' || minText.includes('미적용')) {
            return 0;
        }

        // 여러 학과 기준이 혼합된 경우 슬래시(/) 기준으로 최대 난이도 추출
        const parts = minText.split('/');
        let maxScore = 0;

        parts.forEach(part => {
            let score = 0;
            
            // 1. 반영 영역 수 추출 (4합: 400, 3합: 300, 2합: 200, 1개/1합: 100)
            let areaNum = 0;
            const matchArea = part.match(/(\d)\s*합/);
            if (matchArea) {
                areaNum = parseInt(matchArea[1]);
            } else if (part.includes('1개') || part.includes('1개 영역') || part.includes('합 5')) {
                // "합 5 이내" (경북대 등)는 의예/약학 3합5 등을 의미하므로 3합 보정, 아닐 시 1합
                if (part.includes('의예') || part.includes('치의예') || part.includes('수의예') || part.includes('약학')) {
                    areaNum = 3;
                } else {
                    areaNum = 1;
                }
            }

            score += areaNum * 100;

            // 2. 합산 등급 기준 (합산 등급 숫자가 작을수록 고난도이므로 20에서 뺌)
            let gradeNum = 0;
            let matchGrade = part.match(/(?:합|합\s*)\s*(\d{1,2})/);
            if (!matchGrade) {
                matchGrade = part.match(/(\d)\s*등급/);
            }
            if (matchGrade) {
                gradeNum = parseInt(matchGrade[1]);
            }

            if (gradeNum > 0 && areaNum > 0) {
                score += (20 - gradeNum);
            }

            // 3. 미세 조정 가산점
            // ① 탐구 과목 조건 (2과목 평균 기준 등 더 까다로우면 상위)
            if (part.includes('2과목 평균') || part.includes('2평균') || part.includes('탐구 2평균') || part.includes('과탐(2')) {
                score += 1.5;
            }
            // ② 필수 지정 조건 (수학 필수, 특정 과목 지정 등)
            if (part.includes('필수') || part.includes('포함') || part.includes('지정')) {
                score += 0.5;
            }

            if (score > maxScore) {
                maxScore = score;
            }
        });

        return maxScore;
    };

    // 정렬 로직 적용
    const sortCol = state.summarySort.column;
    const isAsc = state.summarySort.asc;

    if (sortCol) {
        activeRows.sort((a, b) => {
            let valA = a[sortCol] || '';
            let valB = b[sortCol] || '';

            // 고사 시간 정렬 특수 처리
            if (sortCol === '고사 시간') {
                const timeA = parseTimeForSort(valA);
                const timeB = parseTimeForSort(valB);
                return isAsc ? timeA - timeB : timeB - timeA;
            }

            // 수능 최저학력기준 곤란도(난이도) 정렬 특수 처리
            if (sortCol === '수능 최저학력기준') {
                const scoreA = evaluateMinimumDifficulty(valA);
                const scoreB = evaluateMinimumDifficulty(valB);
                // 기본 오름차순(▲) 클릭 시 난이도 높은 순 우선 정렬
                return isAsc ? scoreB - scoreA : scoreA - scoreB;
            }

            // 일반 문자열 정렬
            return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        });
    } else {
        // 드래그/클릭에 의해 임의 정렬이 수행되는 경우 active.univs에 정의된 순서 보존
        activeRows.sort((a, b) => {
            const keyA = active.univs.find(k => k.includes('|' + a['_rowIdx'])) || '';
            const keyB = active.univs.find(k => k.includes('|' + b['_rowIdx'])) || '';
            return active.univs.indexOf(keyA) - active.univs.indexOf(keyB);
        });
    }

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
                    <th style="cursor:pointer;" onclick="sortSummaryTable('수리논술 범위 및 난이도')">수리논술${getSortIndicator('수리논술 범위 및 난이도')}</th>
                    <th style="cursor:pointer;" onclick="sortSummaryTable('_답안유형')">인문,상경${getSortIndicator('_답안유형')}</th>
                    <th style="cursor:pointer;" onclick="sortSummaryTable('수능 최저학력기준')">수능최저(난도)${getSortIndicator('수능 최저학력기준')}</th>
                    <th style="cursor:pointer; text-align:center;" onclick="sortSummaryTable('논술:교과:비')">논술:교과:비${getSortIndicator('논술:교과:비')}</th>
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
                    const ratioRaw = row['논술:교과:비'] || '-';
                    const hasMin = minRaw && minRaw !== '없음';
                    const hasMath = mathNorm && !['해당없음','없음','해당 없음',''].includes(mathNorm);
                    const hasLang = ansType || presentRaw;
                    const langDisplay = ansType
                        ? `${ansType}${ansLen ? ' (' + ansLen + ')' : ''}${presentRaw ? ' · ' + presentRaw : ''}`
                        : presentRaw;
                    
                    // 역방향으로 uniqueKey 찾기
                    const uKey = active.univs.find(k => k.includes('|' + row['_rowIdx'])) || `${row['대학명']} (${row['모집계열 및 세부 학과']})|${row['_rowIdx']}`;

                    return `
                        <tr draggable="true" data-key="${uKey}">
                            <td style="text-align:center; color:var(--text-muted); font-size:0.8rem;">${idx + 1}</td>
                            <td><strong>${row['대학명']}</strong></td>
                            <td style="font-size:0.78rem; color:var(--text-muted);">${row['모집계열 및 세부 학과'] || '-'}</td>
                            <td style="text-align:center; font-weight:600;">${row['고사 일자'] || '미정'}</td>
                            <td style="text-align:center; font-size:0.8rem;">${row['고사 시간'] || '미정'}</td>
                            <td style="font-size:0.78rem;">${hasMath ? `<span class="summary-badge badge-math">수리</span> ${mathRaw || mathNorm}` : '<span style="color:var(--text-muted)">-</span>'}</td>
                            <td style="font-size:0.78rem;">${hasLang ? `<span style="color:#be3a63; font-weight:600;">${langDisplay}</span>` : '<span style="color:var(--text-muted)">-</span>'}</td>
                            <td style="font-size:0.72rem; white-space: pre-wrap; word-break: break-word; line-height:1.5;">${hasMin ? `<span class="summary-badge badge-min" style="white-space:normal;">${minRaw.replace(/,\s*/g, ',\n').replace(/\s*\/\s*/g, '\n/ ')}</span>` : '<span style="color:var(--text-muted)">없음</span>'}</td>
                            <td style="font-size:0.78rem; color:var(--text-muted); text-align:center;">${ratioRaw}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;

    panel.style.display = 'block';
    setupSummaryDragAndClick();
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

let selectedRowKeyForMove = null;

function setupSummaryDragAndClick() {
    const table = document.querySelector('.summary-table');
    if (!table) return;

    const rows = table.querySelectorAll('tbody tr');
    let draggedKey = null;

    rows.forEach(row => {
        const key = row.getAttribute('data-key');
        if (!key) return;

        // 1. 드래그 앤 드롭
        row.addEventListener('dragstart', (e) => {
            draggedKey = key;
            row.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', key);

            // 기존 클릭 선택 해제
            if (selectedRowKeyForMove) {
                const prevSel = table.querySelector('.selected-row-for-move');
                if (prevSel) prevSel.classList.remove('selected-row-for-move');
                selectedRowKeyForMove = null;
            }
        });

        row.addEventListener('dragover', (e) => {
            e.preventDefault();
            const draggingRow = table.querySelector('.dragging');
            const targetRow = e.target.closest('tr');
            if (targetRow && targetRow !== draggingRow) {
                const rect = targetRow.getBoundingClientRect();
                const next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
                const parent = targetRow.parentNode;
                parent.insertBefore(draggingRow, next ? targetRow.nextSibling : targetRow);
            }
        });

        row.addEventListener('drop', (e) => {
            e.preventDefault();
            row.classList.remove('dragging');

            const currentRows = Array.from(table.querySelectorAll('tbody tr'));
            const newUnivs = [];
            currentRows.forEach(r => {
                const k = r.getAttribute('data-key');
                if (k) newUnivs.push(k);
            });

            const active = getActiveTimetable();
            active.univs = newUnivs;
            state.summarySort.column = null; // 정렬 초기화
            saveStateToLocalStorage();
            renderSummary();
            renderGrid();
        });

        row.addEventListener('dragend', () => {
            row.classList.remove('dragging');
        });

        // 2. 행 직접 클릭으로 순서 조정
        row.addEventListener('click', (e) => {
            // 헤더 클릭 등은 무시
            if (e.target.tagName === 'TH' || e.target.closest('th') || e.target.tagName === 'BUTTON') return;

            const active = getActiveTimetable();

            if (!selectedRowKeyForMove) {
                // 첫 클릭: 대상 선택
                selectedRowKeyForMove = key;
                row.classList.add('selected-row-for-move');
            } else {
                if (selectedRowKeyForMove === key) {
                    // 동일 행 클릭: 선택 해제
                    row.classList.remove('selected-row-for-move');
                    selectedRowKeyForMove = null;
                } else {
                    // 두 번째 클릭: 이동 실행
                    const fromIdx = active.univs.indexOf(selectedRowKeyForMove);
                    const toIdx = active.univs.indexOf(key);

                    if (fromIdx !== -1 && toIdx !== -1) {
                        const targetKey = active.univs[fromIdx];
                        active.univs.splice(fromIdx, 1);
                        const insertIdx = active.univs.indexOf(key);
                        // 대상 행의 바로 앞으로 이동
                        active.univs.splice(insertIdx, 0, targetKey);

                        state.summarySort.column = null; // 정렬 해제
                        saveStateToLocalStorage();
                    }

                    selectedRowKeyForMove = null;
                    renderSummary();
                    renderGrid();
                }
            }
        });
    });
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
    const now = new Date();
    
    // 수능일 및 오늘 자정 기준 날짜 객체 생성 (순수 일수 계산용)
    const targetMidnight = new Date(2026, 10, 19); // 2026.11.19 (0-indexed 10은 11월)
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayDiff = Math.round((targetMidnight - todayMidnight) / (1000 * 60 * 60 * 24));
    
    // 시:분:초 카운트용
    const targetDateTime = new Date('2026-11-19T09:00:00'); // 수능 당일 9시 시험 시작 가정
    const diff = targetDateTime - now;
    
    const dDayRightEl = document.getElementById('dday-header-right');
    const dDayNumbersEl = document.getElementById('dday-numbers');
    if (!dDayRightEl || !dDayNumbersEl) return;

    if (diff <= 0) {
        dDayRightEl.textContent = '2026.11.19. / D-Day 경과';
        dDayNumbersEl.textContent = '00:00:00:00';
    } else {
        // 카운터용 일수: diff(ms) 기반으로 계산 → dayDiff와 자동으로 ±1일 내 동기화
        const counterDays = Math.floor(diff / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const diffMinutes = Math.floor((diff / (1000 * 60)) % 60);
        const diffSeconds = Math.floor((diff / 1000) % 60);
        
        // 우측 D-XXX는 오늘 자정 기준 날짜 수 표시
        dDayRightEl.textContent = `2026.11.19. / D-${dayDiff}`;
        
        // 카운터 숫자는 실제 남은 시간 기반 (D-day와 최대 1일 차이)
        const pad = (num) => String(num).padStart(2, '0');
        dDayNumbersEl.textContent = `${counterDays}:${pad(diffHours)}:${pad(diffMinutes)}:${pad(diffSeconds)}`;
    }
}

function openSecretPdf() {
    window.open('300.pdf', '_blank');
}

function captureTimetable() {
    const area = document.getElementById('capture-area');
    const container = document.getElementById('capture-flex-container');
    const leftPanel = document.getElementById('capture-left-panel');
    const rightPanel = document.getElementById('capture-right-panel');

    if (!area || !container || !leftPanel || !rightPanel) return;

    // [0] OFF 카드 임시 숨기기 (캡처 시 ON된 것들만 보이게)
    const offCards = area.querySelectorAll('.timetable-card.off');
    offCards.forEach(card => { card.setAttribute('data-hidden-for-capture', 'true'); card.style.display = 'none'; });

    // [1] timetable-bg-wrapper: 세로로 긴 시간표 전체가 보이도록 overflow 해제
    const timetableWrapper = area.querySelector('.timetable-bg-wrapper');
    const origTimetableOverflow = timetableWrapper ? timetableWrapper.style.overflowX : null;
    const origTimetableMaxH = timetableWrapper ? timetableWrapper.style.maxHeight : null;
    if (timetableWrapper) {
        timetableWrapper.style.overflow = 'visible';
        timetableWrapper.style.maxHeight = 'none';
    }

    // [2] summary-body: 요약표가 rightPanel 너비(650px) 안에 맞게 → width 100%로 고정
    const summaryBody = area.querySelector('#summary-body');
    const origSummaryOverflow = summaryBody ? summaryBody.style.overflowX : null;
    const origSummaryWidth = summaryBody ? summaryBody.style.width : null;
    if (summaryBody) {
        summaryBody.style.overflowX = 'visible';
        summaryBody.style.width = '100%';
    }

    // [3] 요약 테이블: table-layout:fixed + font-size 축소로 650px 안에 자동 줄바꿈
    const summaryTable = area.querySelector('.summary-table');
    const origSummaryTableStyle = summaryTable ? {
        fontSize: summaryTable.style.fontSize,
        tableLayout: summaryTable.style.tableLayout,
        width: summaryTable.style.width
    } : null;
    if (summaryTable) {
        summaryTable.style.fontSize = '0.65rem';
        summaryTable.style.tableLayout = 'fixed';
        summaryTable.style.width = '100%';
    }

    // [4] 캡처용 좌우 배치 (2칼럼) 임시 스타일 적용
    const originalContainerFlexDir = container.style.flexDirection;
    const originalContainerAlign = container.style.alignItems;
    const originalLeftWidth = leftPanel.style.width;
    const originalRightWidth = rightPanel.style.width;
    const originalAreaOverflow = area.style.overflow;
    const originalAreaWidth = area.style.width;

    container.style.flexDirection = 'row';
    container.style.alignItems = 'flex-start';
    leftPanel.style.width = '750px';
    rightPanel.style.width = '650px';
    rightPanel.style.overflow = 'visible';
    area.style.overflow = 'visible';
    area.style.width = '1440px';

    // 캡처 완료 시 원래 상태로 복원
    const restoreStyles = () => {
        // OFF 카드 복원
        offCards.forEach(card => { card.removeAttribute('data-hidden-for-capture'); card.style.display = ''; });
        if (timetableWrapper) {
            timetableWrapper.style.overflowX = origTimetableOverflow || '';
            timetableWrapper.style.overflow = '';
            timetableWrapper.style.maxHeight = origTimetableMaxH || '';
        }
        if (summaryBody) {
            summaryBody.style.overflowX = origSummaryOverflow || '';
            summaryBody.style.width = origSummaryWidth || '';
        }
        if (summaryTable && origSummaryTableStyle) {
            summaryTable.style.fontSize = origSummaryTableStyle.fontSize;
            summaryTable.style.tableLayout = origSummaryTableStyle.tableLayout;
            summaryTable.style.width = origSummaryTableStyle.width;
        }
        container.style.flexDirection = originalContainerFlexDir;
        container.style.alignItems = originalContainerAlign;
        leftPanel.style.width = originalLeftWidth;
        rightPanel.style.width = originalRightWidth;
        rightPanel.style.overflow = '';
        area.style.overflow = originalAreaOverflow;
        area.style.width = originalAreaWidth;
    };

    // html2canvas 실행
    html2canvas(area, {
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        scale: 2,
        scrollX: 0,
        scrollY: -window.scrollY,
        windowWidth: 1500,
        windowHeight: area.scrollHeight + 100
    }).then(canvas => {
        restoreStyles();
        const link = document.createElement('a');
        link.download = '나의_논술_모의계획표.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    }).catch(err => {
        console.error('이미지 캡처 오류:', err);
        restoreStyles();
        alert('이미지 저장 중 오류가 발생했습니다. 브라우저 호환성을 확인해 주세요.');
    });
}

// 새 창 방식 인쇄 함수 (window.print()의 빈 페이지 문제 우회)
function printTimetable() {
    const area = document.getElementById('capture-area');
    if (!area) return;

    // 현재 화면 스타일시트 경로 수집
    const styleLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .map(l => `<link rel="stylesheet" href="${l.href}">`)
        .join('\n');
    const inlineStyles = Array.from(document.querySelectorAll('style'))
        .map(s => `<style>${s.textContent}</style>`)
        .join('\n');

    // ON 상태 카드만 포함하여 HTML 추출 (OFF 카드 제거)
    const areaClone = area.cloneNode(true);
    areaClone.querySelectorAll('.timetable-card.off').forEach(el => el.remove());
    areaClone.querySelectorAll('.timetable-tabs, .timetable-header button, .no-print').forEach(el => el.remove());

    // 캡처 flex를 인쇄용 column으로 전환 (시간표 밑에 요약표 배치)
    const flexContainer = areaClone.querySelector('#capture-flex-container');
    if (flexContainer) {
        flexContainer.style.flexDirection = 'column';
        flexContainer.style.alignItems = 'stretch';
        flexContainer.style.gap = '2rem';
    }
    const leftPanel = areaClone.querySelector('#capture-left-panel');
    if (leftPanel) {
        leftPanel.style.width = '100%';
        leftPanel.style.flex = 'none';
    }
    const rightPanel = areaClone.querySelector('#capture-right-panel');
    if (rightPanel) {
        rightPanel.style.width = '100%';
        rightPanel.style.flex = 'none';
    }

    const printHTML = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>나의 논술 모의 계획표</title>
${styleLinks}
${inlineStyles}
<style>
  body { background: white !important; margin: 0; padding: 0.4cm; font-family: 'Noto Sans KR', sans-serif; box-sizing: border-box; }
  #print-area { width: 100%; }
  #capture-flex-container { display: flex !important; flex-direction: column !important; align-items: stretch !important; gap: 1.5rem !important; width: 100% !important; }
  #capture-left-panel { width: 100% !important; }
  #capture-right-panel { width: 100% !important; }
  
  /* 시간표 테이블 크기 유연화 (상하 배치이므로 조금 더 시원하게 0.72rem 적용) */
  .tt-table { width: 100% !important; table-layout: fixed !important; font-size: 0.72rem !important; }
  .tt-table th, .tt-table td { padding: 0.35rem 0.3rem !important; word-break: break-all !important; }
  .timetable-bg-wrapper { overflow: visible !important; max-height: none !important; width: 100% !important; }
  
  /* 시간표 카드 최적화 */
  .timetable-card { padding: 0.35rem !important; margin-bottom: 3px !important; box-shadow: none !important; border: 1px solid #ddd !important; }
  .timetable-card .card-title { font-size: 0.75rem !important; font-weight: 700 !important; }
  .timetable-card .card-print-detail { display: block !important; font-size: 0.65rem !important; color: #444 !important; }
  
  /* 요약 테이블 크기 유연화 */
  #summary-body { overflow: visible !important; width: 100% !important; }
  #summary-panel { display: block !important; margin-top: 0 !important; }
  .summary-table { width: 100% !important; table-layout: fixed !important; font-size: 0.7rem !important; word-break: break-word !important; }
  .summary-table th, .summary-table td { padding: 0.35rem 0.4rem !important; white-space: normal !important; word-break: break-word !important; }
  .summary-badge { display: inline-block; white-space: normal !important; padding: 0.15rem 0.3rem !important; font-size: 0.62rem !important; }
  
  .timetable-card.off { display: none !important; }
  @page { size: A4 landscape; margin: 0.8cm; }
</style>
</head>
<body>
<div id="print-area">${areaClone.outerHTML}</div>
<script>
  window.onload = function() { setTimeout(function() { window.print(); window.close(); }, 400); };
<\/script>
</body>
</html>`;

    const printWin = window.open('', '_blank', 'width=1200,height=800');
    if (!printWin) { alert('팝업이 차단되었습니다. 팝업 허용 후 다시 시도해 주세요.'); return; }
    printWin.document.open();
    printWin.document.write(printHTML);
    printWin.document.close();
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
    "당신의 꿈을 응원합니다. 할 수 있습니다!",
    "불안함은 진지함의 증거입니다. 당신은 이미 충분히 열심히 하고 있어요.",
    "오늘 모르는 문제가 내일의 실력이 됩니다. 틀린 것도 자산입니다.",
    "수능은 당신의 전부가 아닙니다. 하지만 지금 최선을 다하는 당신이 자랑스럽습니다.",
    "잠깐 쉬어도 괜찮아요. 충전된 에너지로 더 멀리 달릴 수 있습니다.",
    "조금 느려도 괜찮습니다. 당신의 속도가 곧 당신의 길입니다.",
    "오늘 하루도 버텨낸 당신, 그것만으로도 충분히 대단합니다.",
    "남과 비교하지 마세요. 어제의 나보다 오늘의 내가 더 성장했다면 그것으로 됩니다.",
    "긴장은 준비된 사람만이 느끼는 감정입니다. 당신이 얼마나 열심히 했는지 알고 있어요.",
    "합격의 기쁨은 반드시 당신 곁으로 찾아올 것입니다. 조금만 더 버텨요.",
    "포기하고 싶은 날에도 한 문제만 더. 그 한 문제가 당신의 미래를 바꿉니다.",
    "당신이 걸어온 길이 틀리지 않았음을, 결과가 증명할 것입니다.",
    "실수해도 괜찮아요. 다시 일어나는 힘이 진짜 실력입니다.",
    "오늘 힘들다면, 그만큼 목표에 가까워지고 있다는 신호입니다.",
    "집중하는 지금 이 순간이 가장 빛나는 당신입니다.",
    "수험생 여러분, 오늘도 한 걸음씩. 분명히 해낼 수 있어요.",
    "포기하지 마세요, 노력은 배신하지 않습니다.",
    "오늘 하루도 잘 버텨낸 자신을 칭찬해주세요.",
    "당신의 잠재력은 상상 이상으로 무궁무진합니다.",
    "어려운 모의고사 점수에 일희일비하지 마세요. 실전이 진짜입니다.",
    "지치고 힘들 때는 깊게 숨을 한번 쉬고 다시 시작해 봐요.",
    "원하는 대학에 당당히 합격할 당신의 미래를 응원합니다.",
    "할 수 있다고 믿는 순간, 이미 절반은 이뤄낸 것입니다.",
    "당신의 쏟은 모든 정성이 빛을 발할 날이 곧 올 것입니다.",
    "충분히 잘하고 있고, 앞으로도 계속 잘 해낼 것입니다.",
    "성공을 향한 가장 확실한 길은 한 번만 더 시도하는 것입니다.",
    "작은 성취가 모여 큰 승리를 만듭니다. 오늘 공부한 한 페이지도 소중합니다.",
    "체력과 멘탈은 공부의 기본입니다. 오늘 밤은 푹 자길 바랄게요.",
    "슬럼프는 더 높이 도약하기 위해 웅크리는 과정일 뿐입니다.",
    "스스로를 믿는 것보다 더 강한 합격 무기는 없습니다.",
    "자신감은 승리로 이끄는 최고의 지름길입니다.",
    "오늘도 목표를 위해 한 걸음 내딛은 당신이 참 멋집니다.",
    "끝까지 최선을 다한 시간은 인생의 가장 큰 자산이 될 것입니다.",
    "눈앞의 어둠은 곧 밝아올 새벽이 멀지 않았음을 의미합니다.",
    "당신이 꿈꾸는 미래는 이미 가까이에 와 있습니다.",
    "오늘 틀린 문제는 수능 시험장에서 맞출 최고의 기회입니다.",
    "매 순간 최선을 다하면 후회는 남지 않습니다. 자신을 믿으세요.",
    "스스로를 아끼고 격려하는 하루가 되기를 소망합니다.",
    "합격은 간절히 바라고 끝까지 실행하는 자의 몫입니다.",
    "힘내세요! 지금 이 순간도 당신은 꿈에 다가가고 있습니다.",
    "마지막에 웃는 자가 진정한 승리자입니다. 끝까지 페이스를 잃지 마세요.",
    "포기는 선택지에 없습니다. 전진만이 있을 뿐입니다.",
    "당신만의 페이스를 유지하며 묵묵히 걸어가면 성공합니다.",
    "당신의 노력을 세상이 알아줄 날이 눈앞에 다가왔습니다.",
    "어려운 고비를 넘길 때마다 합격 가능성은 더 높아집니다.",
    "오늘도 흔들림 없이 책상 앞을 지킨 당신이 자랑스럽습니다.",
    "성공의 비결은 단 하나, 끝까지 포기하지 않는 끈기입니다.",
    "당신은 이 세상을 바꿀 만큼 놀라운 인재입니다.",
    "힘든 날이 있다면 맛있는 음식을 먹고 기운을 내보세요.",
    "오늘의 수고가 내일의 환한 웃음으로 돌아올 것을 믿습니다.",
    "목표가 뚜렷하면 흔들리지 않습니다. 초심을 잃지 마세요.",
    "할 수 있다는 마음가짐 하나로 모든 장벽을 무너뜨릴 수 있습니다.",
    "인생에서 가장 찬란하게 빛날 날을 위해 오늘을 견뎌봅시다.",
    "긍정적인 생각은 긍정적인 결과를 부르는 법입니다.",
    "당신이 노력한 모든 순간은 우주가 기억하고 보답할 것입니다.",
    "남들의 기준에 휘둘리지 말고 오롯이 자신에게 집중하세요.",
    "수능 합격의 기쁨을 만끽할 당신의 모습을 상상해 보세요.",
    "충분한 휴식도 공부의 중요한 일부분입니다. 쉬어 가세요.",
    "오늘 머릿속에 담은 지식들이 시험장에서 빛을 발할 것입니다.",
    "당신의 성실함이 최고의 기적을 만들어 낼 것입니다.",
    "오늘 힘든 공부가 미래의 자유를 선물할 것입니다.",
    "주변의 시선보다는 스스로의 성장에 집중하는 하루를 보내세요.",
    "할 수 있다는 굳은 믿음으로 한 번 더 책장을 넘겨보세요.",
    "끝은 또 다른 시작이자 승리의 순간입니다.",
    "꿈은 포기하지 않는 한 반드시 실현되는 법입니다.",
    "매일 1%씩만 나아진다면, 결국 완전함에 도달하게 됩니다.",
    "성공은 준비와 기회가 만나는 곳에 존재합니다. 당신은 준비 중입니다.",
    "낙담하지 마세요. 오늘의 아쉬움은 내일의 원동력이 됩니다.",
    "빛은 가장 어두운 밤을 지나온 뒤에야 찾아오는 법입니다.",
    "합격의 골인 지점이 저 멀리 보이기 시작합니다. 힘을 내세요.",
    "당신이 들인 모든 수고에 박수를 보냅니다.",
    "노력의 무게만큼 결실의 단맛은 배가 될 것입니다.",
    "마음의 평안을 얻는 순간, 최고의 집중력이 발휘됩니다.",
    "오늘 해야 할 일들을 묵묵히 마친 당신에게 박수를 보냅니다.",
    "꿈은 도망가지 않습니다. 도망가는 것은 언제나 자신일 뿐입니다.",
    "실전에서는 연습처럼, 연습은 실전처럼 신중하게 임하세요.",
    "작은 습관이 모여서 합격이라는 큰 산을 만듭니다.",
    "조급해하지 마세요. 시간은 충분히 당신 편입니다.",
    "자신을 향한 의심을 멈추는 순간 성공이 시작됩니다.",
    "오늘 공부한 지식은 평생 당신의 머릿속에 남을 큰 힘이 됩니다.",
    "끝까지 견디는 힘이 가장 위대한 재능입니다.",
    "원하는 것을 향해 거침없이 나아가세요.",
    "당신이 가는 그 길의 끝에는 합격이라는 꽃길이 있을 것입니다.",
    "어제를 후회하기보다 오늘을 설계하는 편이 훨씬 현명합니다.",
    "마지막 스퍼트가 승부를 결정짓습니다. 조금만 더 힘냅니다.",
    "용기를 내세요. 당신의 도전을 모두가 뜨겁게 응원하고 있습니다.",
    "오늘도 열심히 살아낸 당신을 진심으로 안아주고 싶습니다.",
    "당신의 빛나는 성취를 위해 매일 기도하는 이들이 있습니다.",
    "포기하지 않는 열정은 모든 한계를 뛰어넘습니다.",
    "조용히 쌓은 내공이 시험장에서 폭발적인 에너지가 될 것입니다.",
    "아침에 일어난 작은 결심이 합격의 지름길을 만듭니다.",
    "흔들리더라도 부러지지 않는 유연함을 지니시길 바랍니다.",
    "공부의 고통은 잠깐이지만 합격의 기쁨은 영원합니다.",
    "최종 합격이라는 아름다운 목적지에 곧 도착할 예정입니다.",
    "오늘 흘린 땀방울이 합격의 꽃길에 물을 주는 셈입니다.",
    "목표 대학의 캠퍼스를 걷는 당신을 기분 좋게 상상해 보세요.",
    "부정적인 생각은 훌훌 털어버리고 다시 펜을 잡으세요.",
    "시간은 정직하게 흘러 당신의 성장을 고스란히 보여줄 것입니다.",
    "오늘 공부한 내용은 무조건 시험에 출제될 것입니다.",
    "실수조차도 성장의 밑거름이 됨을 잊지 마세요.",
    "마음먹은 대로 흘러가지 않아도 포기하지 않는 지혜가 필요합니다.",
    "자신에 대한 흔들림 없는 확신을 바탕으로 하루를 채우세요.",
    "합격 통지서를 받아들고 기뻐할 부모님의 얼굴을 떠올려보세요.",
    "스스로에게 칭찬을 아끼지 마세요. 당신은 대단합니다.",
    "고비마다 한 걸음씩만 더 나아가면 목표에 도달합니다.",
    "포기하지 않는 마음이 가장 큰 기적을 불러옵니다.",
    "오늘의 고단함이 내일의 자랑스러움으로 바뀔 것입니다.",
    "실력은 계단식으로 상승합니다. 정체기 뒤에 도약이 있습니다.",
    "지혜롭고 슬기롭게 오늘 하루를 이겨낸 당신이 자랑스럽습니다.",
    "마음을 다스리는 자가 시험에서도 백전백승하는 법입니다.",
    "최선을 다하고 결과를 기다리는 겸허한 마음을 가집시다.",
    "수능 대박의 주인공은 이미 정해져 있습니다. 바로 당신입니다.",
    "스스로를 신뢰하는 마음이 합격의 주춧돌이 됩니다.",
    "어려운 문제를 극복해낼 때마다 당신의 수준은 한층 높아집니다.",
    "불안을 이겨내는 가장 좋은 방법은 지금 당장 몰입하는 것입니다.",
    "매일 똑같은 일상처럼 보여도 당신은 조금씩 나아가고 있습니다.",
    "오늘보다 더 나은 내일이 올 것이라는 믿음을 잃지 마세요.",
    "꿈은 간절한 사람에게 가장 먼저 문을 열어줍니다.",
    "체력을 아끼고 페이스를 지키는 것도 똑똑한 전략입니다.",
    "시험 문제는 당신이 아는 곳에서 전부 나올 것입니다.",
    "어려운 시기가 지나면 인생의 황금기가 찾아올 것입니다.",
    "당신의 머릿속은 합격에 필요한 지식으로 가득 차고 있습니다.",
    "목표를 마음 깊이 새기고 묵묵히 전진하세요.",
    "오늘 하루 수고 많으셨습니다. 편안한 휴식을 취하세요.",
    "더 멀리 뛰기 위해 잠시 웅크리는 지혜를 가져봅시다.",
    "자신을 가장 많이 믿어주는 사람이 바로 자기 자신이어야 합니다.",
    "끝없는 성실함이 합격이라는 달콤한 과실을 맺게 합니다.",
    "오늘 조금 덜 공부했어도 자책하지 마세요. 내일 더 잘하면 됩니다.",
    "자랑스러운 미래의 자신을 상상하며 오늘을 극복해봅시다.",
    "합격을 향한 발걸음에 온 우주의 기운이 깃들기를 바랍니다.",
    "흔들리지 않는 굳건한 의지가 있으면 두려울 것이 없습니다.",
    "모든 과목의 오답이 시험장에서 정답으로 탈바꿈할 것입니다.",
    "오늘 하루도 지혜롭고 차분하게 계획을 달성했군요.",
    "당신의 가치는 모의고사 점수 몇 점으로 평가받지 못합니다.",
    "당당하고 씩씩하게 수험 생활의 마침표를 찍어봅시다.",
    "힘내세요, 승리는 멀지 않은 곳에 기다리고 있습니다.",
    "하루하루가 합격을 향한 소중한 퍼즐 조각입니다.",
    "자신을 한계 짓지 마세요. 당신은 무엇이든 될 수 있습니다.",
    "시험장에서 당신의 펜 끝이 정답만을 콕콕 집어낼 것입니다.",
    "끝까지 견디고 노력한 모든 이에게 합격의 문은 열립니다.",
    "포기하는 것은 언제나 가장 나쁜 전략입니다. 계속 가세요.",
    "스스로가 자랑스러운 공부를 하도록 최선을 다하세요.",
    "오늘 뿌린 노력의 씨앗이 내일의 기적을 창조할 것입니다.",
    "조급해하지 않고 느긋하게 집중하는 태도가 필요합니다.",
    "당신은 시험의 주인공이며 합격의 산증인이 될 것입니다.",
    "최선의 노력을 다했다면 당당하게 어깨를 펴도 좋습니다.",
    "몸과 마음이 건강해야 지치지 않고 완주할 수 있습니다.",
    "내일의 태양은 오늘보다 훨씬 더 밝게 당신을 비출 것입니다.",
    "지금의 노력이 인생의 든든한 밑거름이 되어줄 것입니다.",
    "최종 목표를 향해 한 계단씩 차근차근 밟고 올라서세요.",
    "수능 날까지 남은 시간은 오롯이 당신이 성장할 시간입니다.",
    "스스로를 향한 뜨거운 격려가 최고의 동기부여입니다.",
    "어렵게 느껴지는 것도 계속 반복하면 익숙해지는 법입니다.",
    "당신이 할 수 있다고 확신하면 정말로 해내게 됩니다.",
    "합격은 남들이 만들어주는 것이 아닌, 당신이 쟁취하는 것입니다.",
    "오늘의 모든 스트레스는 수능 날 모두 사라질 것입니다.",
    "마지막까지 집중력을 유지하는 집중의 힘을 믿으세요.",
    "매 순간 최선을 다한 기억이 평생의 자부심이 됩니다.",
    "하루를 돌아보며 작은 감사함을 느껴보는 것도 좋습니다.",
    "오늘 공부한 양이 적더라도 깊이가 있었다면 성공입니다.",
    "인내의 쓴맛은 잠깐이지만 열매의 단맛은 영원합니다.",
    "목표 대학에 당당히 서 있는 자신을 믿고 나아가세요.",
    "지치고 피곤할 때는 따뜻한 차 한 잔으로 몸을 녹이세요.",
    "세상은 노력하는 자에게 결국 최고의 기회를 줍니다.",
    "어떤 역경 속에서도 합격을 이뤄낼 단단한 내공을 쌓으세요.",
    "오늘도 후회 없는 하루를 보내느라 정말 수고하셨습니다.",
    "자신감이 절반, 성실함이 나머지 절반을 채워줍니다.",
    "흔들리는 멘탈을 꼭 쥐어잡고 오답 하나에 더 집중하세요.",
    "시험 문제는 당신이 그동안 공부한 범위 안에서만 출제됩니다.",
    "실수하는 법을 배워야 비로소 실수를 줄일 수 있습니다.",
    "포기라는 단어를 머릿속에서 완전히 지워버리세요.",
    "끝까지 버티는 뚝심이 결국 대세의 흐름을 바꿉니다.",
    "합격을 부르는 가장 좋은 습관은 매일 약점을 극복하는 것입니다.",
    "스스로를 다독이며 한 걸음씩만 더 걸어가 봅시다.",
    "오늘보다 한층 더 진보할 내일을 적극적으로 환영하세요.",
    "목표에 대한 열망이 클수록 합격의 문은 넓어집니다.",
    "마음의 소란을 잠재우고 눈앞의 책장에 시선을 맞추세요.",
    "체계적으로 관리된 하루가 수능 대박의 기본입니다.",
    "실전 시험지처럼 꼼꼼하게 지금 푸는 문제를 대하세요.",
    "오늘 하루 열심히 달린 당신을 위해 깊은 잠을 보냅니다.",
    "성공을 확신하며 걷는 걸음걸이에는 당당함이 묻어납니다.",
    "당신은 도전을 즐기고 이겨낼 능력이 충분한 사람입니다.",
    "끝까지 온 정성을 쏟으면 결과는 자연스럽게 따라옵니다.",
    "실수 하나에 낙담할 시간에 오답의 이유를 분석하세요.",
    "모든 수험 기간은 당신의 인격을 성숙시키는 소중한 기회입니다.",
    "마음에 여유를 품을 때 두뇌 회전도 가장 빨라집니다.",
    "수능 날 가벼운 발걸음으로 시험장을 나올 당신을 믿습니다.",
    "오늘 공부한 이론이 머릿속에 완벽히 정립되기를 바랍니다.",
    "어떠한 난관이 찾아와도 극복할 지혜가 우리 안에 있습니다.",
    "합격은 끊임없이 의문을 던지고 해결하는 자의 열매입니다.",
    "오늘 하루 무탈하게 공부를 끝낸 스스로에게 박수치세요.",
    "긍정의 에너지를 가득 채워 기분 좋게 잠자리에 드세요.",
    "꿈꾸는 삶에 다가가기 위한 오늘의 희생은 가치 있습니다.",
    "최선을 다하되 스스로에게 너무 냉정해지지는 마세요.",
    "시험 점수가 오르지 않는 정체기도 성장의 소중한 일부입니다.",
    "어려운 개념을 마스터했을 때의 쾌감을 느껴보세요.",
    "당신의 매일은 합격이라는 기적을 빚어내는 순간들입니다.",
    "주변 사람들의 응원에 힘입어 끝까지 에너지를 채우세요.",
    "아침 공부부터 밤 공부까지 성실히 소화해 낸 당신입니다.",
    "스스로를 진심으로 신뢰하는 사람만이 성공을 쟁취합니다.",
    "오늘 발견한 약점을 기분 좋게 보강하고 넘어가세요.",
    "자신감 있게 문제를 풀어가는 거침없는 태도를 기르세요.",
    "수능 날 최고의 컨디션으로 실력을 뽐내게 될 것입니다.",
    "포기라는 나약함에 굴복하지 않는 강인한 자신을 만드세요.",
    "노력의 꽃은 늦게 피더라도 가장 화려하게 피어납니다.",
    "마음속의 의심을 지우고 긍정적인 기대만을 남기세요.",
    "어려운 조건에서도 공부를 이어가는 당신은 영웅입니다.",
    "오늘도 최선을 다했으니 후회 없이 하루를 마무리하세요.",
    "수능 날 가방 가득 합격의 꿈을 싣고 돌아올 것입니다.",
    "당신의 눈부신 비상을 모두가 설레는 마음으로 기다립니다.",
    "최종 합격자 명단에서 당신의 이름을 발견하게 될 것입니다.",
    "한결같은 끈기와 노력은 모든 불안을 잠재우는 명약입니다.",
    "오늘 공부한 지식들이 시험장에서 보물처럼 쏟아질 것입니다.",
    "매일매일 꿈을 향해 진군하는 자랑스러운 청춘입니다.",
    "지치고 쓰러질 것 같을 때 당신을 사랑하는 이들을 생각하세요.",
    "마지막 한 달, 한 주, 하루가 모든 것을 결정짓습니다.",
    "자신감을 장착하고 세상의 시험대에 당당히 올라서세요.",
    "오늘 뿌린 노력의 씨앗이 내일의 기적을 창조할 것입니다.",
    "스스로에게 격려와 응원의 말을 끊임없이 건네주세요.",
    "성실하게 쌓아 올린 시간은 그 무엇도 무너뜨릴 수 없습니다.",
    "합격의 결실을 맺을 소중한 인내의 시간들을 사랑해 보세요.",
    "오늘도 당신은 어제보다 훨씬 더 지혜롭고 똑똑해졌습니다.",
    "어려운 한 문제에 쏟은 고민의 시간이 실력을 도약시킵니다.",
    "수능 성공의 짜릿함을 상상하며 기분 좋게 펜을 드세요.",
    "흔들리지 않고 끝까지 목적지를 향해 직진하는 마음입니다.",
    "오늘 하루도 무사히 완주해 낸 당신에게 박수를 보냅니다.",
    "자신을 향한 굳은 신념은 어떠한 바람에도 꺾이지 않습니다.",
    "모든 오답은 더 완벽한 정답으로 나아가는 과정입니다.",
    "조급함과 두려움을 떨쳐내고 내면의 평온을 찾으세요.",
    "당신은 이미 훌륭하며, 더 훌륭해지는 중입니다.",
    "끝까지 페이스를 유지하는 자가 수능의 최종 승자입니다.",
    "합격이라는 행복한 결과를 온몸으로 맞이할 날이 옵니다.",
    "오늘 공부를 마친 맑은 정신으로 내일을 기대해 봅시다.",
    "노력하는 과정 자체가 당신의 아름다운 스펙이 될 것입니다.",
    "어려운 과목일수록 기본으로 돌아가 기초를 다지세요.",
    "스스로를 위로하며 나아가는 지혜로운 수험생이 됩시다.",
    "당신의 열정이 합격이라는 놀라운 기적을 만들어냅니다.",
    "오늘 틀린 문제는 완벽한 내 지식으로 저장하면 됩니다.",
    "두려움을 지우고 합격의 가능성만을 향해 집중해 보세요.",
    "끝까지 견디는 삶은 그 자체로 찬란하게 빛납니다.",
    "오늘 하루 목표했던 공부를 성공적으로 해내셨군요.",
    "당신의 머릿속은 수능 날 최고의 능력을 발휘할 것입니다.",
    "지칠 때는 맛있는 간식을 먹으며 잠시 뇌를 쉬어주세요.",
    "마지막 수능 날 웃으며 문을 나설 자신을 믿어보세요.",
    "오늘 공부한 핵심 포인트를 다시 한번 리마인드 하세요.",
    "성실한 노력이 결국 모든 불안함을 잠재워 줄 것입니다.",
    "당신이 포기하지 않는 한 성공은 반드시 찾아옵니다.",
    "오늘 밤은 걱정 없이 편안하게 단잠을 자길 소망합니다.",
    "꿈은 그것을 믿고 실행하는 사람에게 반드시 응답합니다.",
    "힘들고 포기하고 싶은 순간이 진짜 합격의 고비입니다.",
    "스스로를 향해 따뜻한 미소를 지어보이는 밤이 되세요.",
    "매 순간 최선을 다했다면 결과는 하늘에 맡기면 됩니다.",
    "오늘도 수고한 자신에게 마음속 깊은 감사를 건네세요.",
    "합격의 에너지가 당신의 주위에 맴돌고 있습니다.",
    "어제보다 오늘 더 똑똑해진 자신을 축하해주세요.",
    "어려운 수학 문제도 끈질기게 붙잡으면 결국 풀립니다.",
    "지혜롭고 성실한 태도가 평생을 관통하는 실력이 됩니다.",
    "오늘 공부한 소중한 지식들을 고스란히 마음속에 담으세요.",
    "끝까지 집중력을 잃지 않는 단단한 마음을 지니세요.",
    "원하는 미래에 당당히 도착해 있을 당신을 확신합니다.",
    "오늘 흘린 눈물이 내일의 찬란한 합격 영광이 됩니다.",
    "자신을 격려하며 끝까지 용기를 잃지 않기를 바랍니다.",
    "당신의 쏟아부은 열정의 크기만큼 기적이 일어날 것입니다.",
    "흔들리지 않고 꿋꿋하게 공부를 지켜나가는 모습이 귀합니다.",
    "오늘 하루도 치열하게 성장을 일궈낸 당신이 최고입니다.",
    "스스로를 신뢰하고 거침없이 앞으로 나아가시길 바랍니다.",
    "모든 정성이 더해져 수능 시험장에서 만점의 행운이 깃듭니다.",
    "조급해하지 마세요. 당신의 속도는 지극히 정상입니다.",
    "최선을 다하는 당신의 하루하루가 이미 눈부신 작품입니다.",
    "몸의 피로를 풀고 마음을 맑게 비우는 수면을 청하세요.",
    "내일의 학습 계획을 기대하며 편안하게 오늘을 마무리하세요.",
    "당신의 아름다운 미래를 위한 오늘 하루의 헌신에 감사합니다.",
    "수능 날 떨지 않고 차분히 실력을 발휘할 지혜를 드립니다.",
    "당신은 합격의 영광을 누릴 충분한 자격이 있는 사람입니다.",
    "마지막 순간까지 긴장의 끈을 늦추지 않고 정진해 나갑시다.",
    "꿈꾸는 캠퍼스의 낭만을 만끽할 당신을 늘 응원합니다.",
    "수능 대박, 최종 합격의 기적은 오롯이 당신의 것입니다!"
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
        let lastMonthA = '';
        allDates.forEach(date => {
            if (date.includes('수능일')) {
                lastMonthA = '';
                rowsHtml += `<tr style="border-bottom: 2px solid #000;">
                    <td class="sched-date" style="background:#000; color:#fff; font-size:0.75rem; font-weight:800; padding: 0.35rem 0.25rem;">11.19.(목)</td>
                    <td colspan="3" style="background:#111; color:#ef4444; font-weight:800; text-align:center; font-size:0.75rem; padding:0.35rem; border: 1px solid #000; letter-spacing: 0.1em;">⚡ 2027학년도 대학수학능력시험 (수능일)</td>
                </tr>`;
                return;
            }

            const rowsForDate = state.univData.filter(r => r['고사 일자'] === date);
            if (rowsForDate.length === 0) return;

            // 동일한 월은 생략하여 간소하게 표현
            let displayDate = date;
            const m = date.match(/(\d+)\.(\d+)\.\(([가-힣]+)\)/);
            if (m) {
                const month = m[1];
                const day = m[2];
                const yoil = m[3];
                if (month === lastMonthA) {
                    displayDate = `${day}.(${yoil})`;
                } else {
                    lastMonthA = month;
                    displayDate = `${month}.${day}.(${yoil})`;
                }
            }

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
                <td class="sched-date">${displayDate}</td>
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
        let lastMonthB = '';
        const headerCols = allDates.map(d => {
            if (d.includes('수능일')) {
                lastMonthB = '';
                return `<th style="background:#000; color:#ef4444; min-width:20px; max-width:24px; font-size:0.55rem; padding:0.1rem 0; font-weight:800; border:1px solid #1a1a24; text-align:center; vertical-align:middle; white-space:nowrap; line-height:1.05;">11<br><span style="font-size:0.6rem; font-weight:900; border-top:1px solid #ef4444; border-bottom:1px solid #ef4444; display:block; margin:1px 0; padding:0;">19</span>수능</th>`;
            }
            
            const m = d.match(/(\d+)\.(\d+)\.\(([가-힣]+)\)/);
            if (m) {
                const month = m[1];
                const day = m[2];
                const yoil = m[3];
                let yoilColor = '#fff';
                if (yoil === '토') yoilColor = '#2563eb';
                if (yoil === '일') yoilColor = '#dc2626';
                
                const isSameMonth = (month === lastMonthB);
                lastMonthB = month;

                return `
                    <th class="sched-th-date" style="padding: 0; min-width: 48px; border: 1px solid rgba(255,255,255,0.12);">
                        <div style="background: rgba(255,255,255,0.08); font-size: 0.65rem; font-weight: 800; padding: 2px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">${isSameMonth ? '&nbsp;' : month + '월'}</div>
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
