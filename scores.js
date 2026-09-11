/**
 * scores.js - 논술 합격선 분석 대시보드 v4
 * 시험 1 / 시험 2 / 시험 3 색상 테마 시스템 & 우선순위 레이아웃
 */

// ── 전역 상태 ────────────────────────────────────────────────────────────────
// ── 전역 상태 ────────────────────────────────────────────────────────────────
const state = {
    allData: [],
    filteredData: [],
    selectedRegions: new Set(),
    selectedFields: new Set(),
    selectedUnivs: new Set(),     // 선택된 대학 목록
    isMultiSelectUniv: false,     // 기본: 단일 선택(false), 다중선택 토글 시 true
    selectedMinimum: 'all',       // 'all' | 'Y' | 'N'
    hasMathOnly: false,
    searchQuery: '',
    sortColumn: '환산점수',
    sortDirection: 'desc',
    currentPage: 1,
    itemsPerPage: 20,
    activeExamTab: 'all',         // 'all' | '인문' | '자연' | '의치한약수' | '약술형'
    selectedSubExam: 'all',       // 대학 모드 3안 세부 시험 필터: 'all' 또는 고유 시험구분(예: '인문 1', '상경계열')
    strategyGuideOpen: true,      // 기본 열림 상태 (점수대별 활용 방법)
    browseView: 'table',          // 기본: 'table' (전체 학과 테이블 뷰) | 'univ' (대학별 모아보기)
    deptScoreChartMode: 'diverging', // 'diverging' (평균 대비 편차 차트) | 'absolute' (100점 환산 절대값 차트)
    expandedUnivs: new Set(),     // 아코디언 펼쳐진 대학들
    charts: {
        univ: null,
        field: null,
        examDist: null,
        minComp: null,
        mathComp: null,
        searchDeptScore: null,
        searchDeptMath: null,
        deptSearch: null,
        deptMin: null
    }
};

// ── 시험 종류 동적 분류 시스템 (인문1/2, 자연1/2/3, 의치한약수, 약술형, 한양대 세부시험) ─────
function classifyExamType(item) {
    const u = item.대학명 || '';
    const f = item.계열구분 || '';
    const m = item.학과명 || '';
    const e = item.시험구분 || '';
    const line = item.합격점수라인의미 || '';

    // 0. 한양대학교 고유 시험구분별 맞춤 색상 및 테마 (식별력 대폭 강화)
    if (u.includes('한양') || e.includes('오전') || e.includes('오후 1') || e.includes('오후 2')) {
        // 한양대 의예과
        if (m.includes('의예') || e.includes('의예')) {
            return {
                key: '한양_의예',
                label: '의예과',
                fullLabel: '🩺 한양대 의예과',
                badgeClass: 'exam-theme-hanyang-med',
                color: '#7C3AED',
                bgColor: '#F5F3FF',
                borderColor: '#DDD6FE',
                chartBg: 'rgba(124, 58, 237, 0.85)',
                chartBorder: '#7C3AED'
            };
        }
        // 자연 (오후 2): 미래차/반도체/융합전자/컴소
        if (e.includes('오후 2') || e.includes('오후2')) {
            return {
                key: '자연_오후2',
                label: '자연 (오후 2)',
                fullLabel: '⚡ 자연 (오후 2: 첨단IT·전자)',
                badgeClass: 'exam-theme-hanyang-pm2',
                color: '#1E3A8A', // 깊은 네이비/미드나잇블루
                bgColor: '#EFF6FF',
                borderColor: '#93C5FD',
                chartBg: 'rgba(30, 58, 138, 0.9)',
                chartBorder: '#1E3A8A'
            };
        }
        // 자연 (오후 1): 기계/화학/신소재/물리/수학/화공/산공/생명/전기/수학교육
        if (e.includes('오후 1') || e.includes('오후1')) {
            return {
                key: '자연_오후1',
                label: '자연 (오후 1)',
                fullLabel: '🔬 자연 (오후 1: 공학·자연)',
                badgeClass: 'exam-theme-hanyang-pm1',
                color: '#2563EB', // 비비드 로열블루
                bgColor: '#DBEAFE',
                borderColor: '#60A5FA',
                chartBg: 'rgba(37, 99, 235, 0.85)',
                chartBorder: '#2563EB'
            };
        }
        // 자연 (오전): 건축/토목/도시/식영/간호/인터칼리지
        if (e.includes('오전')) {
            return {
                key: '자연_오전',
                label: '자연 (오전)',
                fullLabel: '🌱 자연 (오전: 건축·환경·보건)',
                badgeClass: 'exam-theme-hanyang-am',
                color: '#059669', // 산뜻한 에메랄드 그린
                bgColor: '#ECFDF5',
                borderColor: '#6EE7B7',
                chartBg: 'rgba(5, 150, 105, 0.85)',
                chartBorder: '#059669'
            };
        }
        // 상경계열: 경영/경금/파경/정시/인터(인문)/정시
        if (e.includes('상경')) {
            return {
                key: '상경계열',
                label: '상경계열',
                fullLabel: '📊 상경계열 (수리논술 포함)',
                badgeClass: 'exam-theme-hanyang-biz',
                color: '#4338CA', // 딥 인디고/보라
                bgColor: '#EEF2FF',
                borderColor: '#A5B4FC',
                chartBg: 'rgba(67, 56, 202, 0.85)',
                chartBorder: '#4338CA'
            };
        }
        // 인문 1: 국문, 사학, 철학, 관광, 영화 등
        if (e.includes('인문 1') || e.includes('인문1')) {
            return {
                key: '인문1',
                label: '인문 1',
                fullLabel: '📖 인문 1 (인문·어문)',
                badgeClass: 'exam-theme-hum1',
                color: '#EA580C', // 비비드 오렌지
                bgColor: '#FFF7ED',
                borderColor: '#FDBA74',
                chartBg: 'rgba(234, 88, 12, 0.85)',
                chartBorder: '#EA580C'
            };
        }
        // 인문 2: 사회, 정책, 행정 등
        if (e.includes('인문 2') || e.includes('인문2')) {
            return {
                key: '인문2',
                label: '인문 2',
                fullLabel: '🏛️ 인문 2 (사회과학)',
                badgeClass: 'exam-theme-hum2',
                color: '#B45309', // 웜 앰버/브라운
                bgColor: '#FEF3C7',
                borderColor: '#FCD34D',
                chartBg: 'rgba(180, 83, 9, 0.85)',
                chartBorder: '#B45309'
            };
        }
    }

    // 1. 의치한약수 (메디컬)
    if (item.메디컬 || m.includes('의예') || m.includes('약학') || m.includes('치의예') || m.includes('수의예') || m.includes('한의예') || m.includes('의학과') || m.includes('약학과') || m.includes('한약') || e.includes('3')) {
        return {
            key: '의치한약수',
            label: '의치한약수',
            fullLabel: '🩺 의치한약수 (메디컬)',
            badgeClass: 'exam-theme-medical',
            color: '#6D28D9',
            bgColor: '#F5F3FF',
            borderColor: '#DDD6FE',
            chartBg: 'rgba(109, 40, 217, 0.85)',
            chartBorder: '#6D28D9'
        };
    }

    // 2. 약술형 (교과형)
    if (line.includes('약술') || ['가천대', '삼육대', '수원대', '서경대', '한신대', '을지대', '상명대', '한국공학대'].includes(u)) {
        return {
            key: '약술형',
            label: '약술형',
            fullLabel: '✏️ 약술형 (교과형)',
            badgeClass: 'exam-theme-short',
            color: '#92400E',
            bgColor: '#FEF3C7',
            borderColor: '#FDE68A',
            chartBg: 'rgba(180, 83, 9, 0.85)',
            chartBorder: '#B45309'
        };
    }

    // 3. 인문/상경/사회계열 세분화 (시험구분 명시값 우선 판별)
    if (e.includes('상경') || e.includes('경상') || e.includes('사회계열') || e.includes('인문 2') || e.includes('인문2') || e.includes('인문 (오후 조)')) {
        return {
            key: '인문2',
            label: '인문2 (상경·사회)',
            fullLabel: '📊 인문 2 (상경·사회)',
            badgeClass: 'exam-theme-hum2',
            color: '#9A3412',
            bgColor: '#FFEDD5',
            borderColor: '#FED7AA',
            chartBg: 'rgba(194, 65, 12, 0.85)',
            chartBorder: '#C2410C'
        };
    }

    if (e.includes('인문 1') || e.includes('인문1') || e.includes('인문계열') || e.includes('인문 (오전 조)')) {
        return {
            key: '인문1',
            label: '인문1 (인문·어문)',
            fullLabel: '📖 인문 1 (인문·어문)',
            badgeClass: 'exam-theme-hum1',
            color: '#C2410C',
            bgColor: '#FFF7ED',
            borderColor: '#FFEDD5',
            chartBg: 'rgba(234, 88, 12, 0.85)',
            chartBorder: '#EA580C'
        };
    }

    if (f.includes('인문') || f.includes('상경') || f.includes('사회') || e.includes('1') || m.includes('인문') || m.includes('경영') || m.includes('경제')) {
        // 인문 2: 상경·사회·정경 (경영, 경제, 통계, 미디어, 행정, 정치, 사회, 법학 등)
        if (m.includes('경영') || m.includes('경제') || m.includes('통계') || m.includes('미디어') || m.includes('행정') || m.includes('정치') || m.includes('사회') || m.includes('법') || m.includes('상경') || m.includes('금융') || m.includes('파이낸스') || m.includes('광고') || m.includes('언론') || f.includes('상경')) {
            return {
                key: '인문2',
                label: '인문2 (상경·사회)',
                fullLabel: '📊 인문 2 (상경·사회)',
                badgeClass: 'exam-theme-hum2',
                color: '#9A3412',
                bgColor: '#FFEDD5',
                borderColor: '#FED7AA',
                chartBg: 'rgba(194, 65, 12, 0.85)',
                chartBorder: '#C2410C'
            };
        }
        // 인문 1: 어문·인문학·사범·문학
        return {
            key: '인문1',
            label: '인문1 (인문·어문)',
            fullLabel: '📖 인문 1 (인문·어문)',
            badgeClass: 'exam-theme-hum1',
            color: '#C2410C',
            bgColor: '#FFF7ED',
            borderColor: '#FFEDD5',
            chartBg: 'rgba(234, 88, 12, 0.85)',
            chartBorder: '#EA580C'
        };
    }

    // 4. 자연계열 세분화 (시험구분 명시값 우선 판별)
    if (e.includes('이학계열') || e.includes('자연 2') || e.includes('자연2') || e.includes('자연 (오후 조)') || e.includes('자연 (오후 2)')) {
        return {
            key: '자연2',
            label: '자연2 (공학·IT)',
            fullLabel: '💻 자연 2 (공학·IT)',
            badgeClass: 'exam-theme-nat2',
            color: '#1E40AF',
            bgColor: '#EFF6FF',
            borderColor: '#BFDBFE',
            chartBg: 'rgba(30, 64, 175, 0.85)',
            chartBorder: '#1E40AF'
        };
    }

    if (e.includes('공학계열') || e.includes('자연 1') || e.includes('자연1') || e.includes('자연 (오전 조)') || e.includes('자연 (오전)') || e.includes('자연 (오후 1)')) {
        return {
            key: '자연1',
            label: '자연1 (기초자연)',
            fullLabel: '🔬 자연 1 (기초자연)',
            badgeClass: 'exam-theme-nat1',
            color: '#065F46',
            bgColor: '#ECFDF5',
            borderColor: '#A7F3D0',
            chartBg: 'rgba(5, 150, 105, 0.85)',
            chartBorder: '#059669'
        };
    }

    // 자연 3: 간호/보건/융합/자유전공
    if (m.includes('간호') || m.includes('치료') || m.includes('방사선') || m.includes('보건') || m.includes('자율') || m.includes('자유') || m.includes('인터칼리지') || m.includes('융합') || m.includes('임상') || m.includes('재활')) {
        return {
            key: '자연3',
            label: '자연3 (보건·융합)',
            fullLabel: '🧬 자연 3 (보건·융합)',
            badgeClass: 'exam-theme-nat3',
            color: '#0F766E',
            bgColor: '#F0FDFA',
            borderColor: '#99F6E4',
            chartBg: 'rgba(13, 148, 136, 0.85)',
            chartBorder: '#0F766E'
        };
    }

    // 자연 2: 공학/IT/컴퓨터/반도체/신소재/전자/기계/화공
    if (f.includes('공학') || f.includes('IT') || m.includes('컴퓨터') || m.includes('소프트웨어') || m.includes('인공지능') || m.includes('AI') || m.includes('전자') || m.includes('전기') || m.includes('기계') || m.includes('화학공학') || m.includes('화공') || m.includes('신소재') || m.includes('반도체') || m.includes('건축') || m.includes('토목') || m.includes('시스템') || m.includes('데이터')) {
        return {
            key: '자연2',
            label: '자연2 (공학·IT)',
            fullLabel: '💻 자연 2 (공학·IT)',
            badgeClass: 'exam-theme-nat2',
            color: '#1E40AF',
            bgColor: '#EFF6FF',
            borderColor: '#BFDBFE',
            chartBg: 'rgba(30, 64, 175, 0.85)',
            chartBorder: '#1E40AF'
        };
    }

    // 자연 1: 기초자연과학 (수학, 물리, 화학, 생명과학, 지구환경 등)
    return {
        key: '자연1',
        label: '자연1 (기초자연)',
        fullLabel: '🔬 자연 1 (기초자연)',
        badgeClass: 'exam-theme-nat1',
        color: '#065F46',
        bgColor: '#ECFDF5',
        borderColor: '#A7F3D0',
        chartBg: 'rgba(5, 150, 105, 0.85)',
        chartBorder: '#059669'
    };
}

// ── 레거시 호환 헬퍼 ────────────────────────────────────────────────────────
function getExamTheme(itemOrStr) {
    if (typeof itemOrStr === 'object' && itemOrStr !== null) {
        return itemOrStr.examType || classifyExamType(itemOrStr);
    }
    const s = String(itemOrStr || '');
    if (s.includes('오후 2') || s.includes('오후2')) return classifyExamType({ 시험구분: '자연 (오후 2)' });
    if (s.includes('오후 1') || s.includes('오후1')) return classifyExamType({ 시험구분: '자연 (오후 1)' });
    if (s.includes('오전')) return classifyExamType({ 시험구분: '자연 (오전)' });
    if (s.includes('의') || s.includes('약') || s.includes('치') || s.includes('수') || s.includes('메디')) return classifyExamType({ 메디컬: true });
    if (s.includes('약술')) return classifyExamType({ 합격점수라인의미: '약술' });
    if (s.includes('상경')) return classifyExamType({ 시험구분: '상경계열', 계열구분: '상경', 학과명: '경영' });
    if (s.includes('인문 2') || s.includes('인문2')) return classifyExamType({ 시험구분: '인문 2', 계열구분: '인문', 학과명: '사회' });
    if (s.includes('인문 1') || s.includes('인문1')) return classifyExamType({ 시험구분: '인문 1', 계열구분: '인문', 학과명: '국문' });
    if (s.includes('인문')) return classifyExamType({ 계열구분: '인문', 학과명: '국문' });
    if (s.includes('자연3') || s.includes('보건')) return classifyExamType({ 학과명: '간호' });
    if (s.includes('자연2') || s.includes('공학')) return classifyExamType({ 계열구분: '공학', 학과명: '컴퓨터' });
    return classifyExamType({ 계열구분: '자연', 학과명: '수학' });
}

// ── CSV 파서 ─────────────────────────────────────────────────────────────────
function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/^\uFEFF/, ''));
    const records = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('#')) continue;

        const values = [];
        let cur = '';
        let inQ = false;
        for (let c = 0; c < line.length; c++) {
            const ch = line[c];
            if (ch === '"') { inQ = !inQ; }
            else if (ch === ',' && !inQ) { values.push(cur.trim()); cur = ''; }
            else { cur += ch; }
        }
        values.push(cur.trim());

        if (values.length >= headers.length) {
            const row = {};
            headers.forEach((h, idx) => { row[h] = values[idx] !== undefined ? values[idx] : ''; });

            const univ      = row['대학명'] || '';
            const region    = row['지역구분'] || '';
            const field     = row['계열구분'] || '';
            const major     = row['학과명'] || '';
            const exam      = row['시험구분'] || '';
            const rawScore  = parseFloat(row['논술점수']) || 0;
            const convScore = parseFloat(row['100점만점환산']) || 0;
            const avgPass   = parseNum(row['합격자평균점']);
            const cut70     = parseNum(row['70%Cut']);
            const minCut    = parseNum(row['최저점_커트라인']);
            const univAvg   = parseNum(row['대학평균환산점수']);
            const examAvg   = parseNum(row['대학시험별평균점수']);
            const isMedical = (row['메디컬여부'] || '').trim().toUpperCase() === 'Y';
            const tag       = row['인기학과태그'] || '일반학과';
            const minRaw    = (row['최저여부'] || '').trim().toUpperCase();
            const hasMinimum = minRaw === 'Y';
            const lineMeaning = row['합격점수라인의미'] || '';

            const mathPassMed = parseNum(row['수능수학_합격자_중앙값']);
            const mathPassAvg = parseNum(row['수능수학_합격자_평균']);
            const mathPassMode = parseNum(row['수능수학_합격자_최빈값']);
            const mathPassCount = parseNum(row['수능수학_합격자_표본수']);

            const mathFailMed = parseNum(row['수능수학_불합격자_중앙값']);
            const mathFailAvg = parseNum(row['수능수학_불합격자_평균']);
            const mathFailMode = parseNum(row['수능수학_불합격자_최빈값']);
            const mathFailCount = parseNum(row['수능수학_불합격자_표본수']);

            if (univ && major) {
                const itemObj = {
                    _id: records.length,
                    대학명: univ,
                    지역구분: region,
                    계열구분: field,
                    학과명: major,
                    시험구분: exam,
                    논술점수: rawScore,
                    환산점수: convScore,
                    합격자평균점: avgPass,
                    cut70: cut70,
                    최저점: minCut,
                    대학평균환산점수: univAvg,
                    대학시험별평균점수: examAvg,
                    메디컬: isMedical,
                    태그: tag,
                    최저여부: hasMinimum ? 'Y' : (minRaw === 'N' ? 'N' : '-'),
                    합격점수라인의미: lineMeaning,
                    계열분류: exam.includes('1') ? '인문' : (exam.includes('2') ? '자연/이공' : '기타'),
                    mathPassMed,
                    mathPassAvg,
                    mathPassMode,
                    mathPassCount,
                    mathFailMed,
                    mathFailAvg,
                    mathFailMode,
                    mathFailCount,
                    hasMathData: mathPassMed !== null || mathPassAvg !== null
                };
                itemObj.examType = classifyExamType(itemObj);
                records.push(itemObj);
            }
        }
    }
    return records;
}

function parseNum(val) {
    if (!val || val.trim() === '') return null;
    const n = parseFloat(val.replace(/[^0-9.-]/g, ''));
    return isNaN(n) ? null : n;
}

// ── 로컬스토리지 상태 저장 및 복원 ──────────────────────────────────────────
function saveScoresStateToLocalStorage() {
    try {
        const dataToSave = {
            searchQuery: state.searchQuery,
            selectedUnivs: Array.from(state.selectedUnivs),
            isMultiSelectUniv: state.isMultiSelectUniv,
            activeExamTab: state.activeExamTab,
            selectedMinimum: state.selectedMinimum,
            hasMathOnly: state.hasMathOnly,
            browseView: state.browseView,
            selectedRegions: Array.from(state.selectedRegions),
            selectedFields: Array.from(state.selectedFields)
        };
        localStorage.setItem('essay_scores_state', JSON.stringify(dataToSave));
    } catch (e) {
        console.error('Failed to save scores state to localStorage:', e);
    }
}

function loadScoresStateFromLocalStorage() {
    try {
        const saved = localStorage.getItem('essay_scores_state');
        if (!saved) return;
        const parsed = JSON.parse(saved);
        if (parsed.searchQuery !== undefined) {
            state.searchQuery = parsed.searchQuery;
            const input = document.getElementById('search-input');
            if (input) input.value = parsed.searchQuery;
        }
        if (Array.isArray(parsed.selectedUnivs)) {
            state.selectedUnivs = new Set(parsed.selectedUnivs);
        }
        if (parsed.isMultiSelectUniv !== undefined) {
            state.isMultiSelectUniv = parsed.isMultiSelectUniv;
        }
        if (parsed.activeExamTab) {
            state.activeExamTab = parsed.activeExamTab;
        }
        if (parsed.selectedMinimum) {
            state.selectedMinimum = parsed.selectedMinimum;
            ['all', 'Y', 'N'].forEach(k => {
                const btn = document.getElementById(`btn-min-${k}`);
                if (btn) btn.classList.toggle('active', k === state.selectedMinimum);
            });
        }
        if (parsed.hasMathOnly !== undefined) {
            state.hasMathOnly = parsed.hasMathOnly;
            const cb = document.getElementById('check-has-math');
            if (cb) cb.checked = parsed.hasMathOnly;
            const chip = document.getElementById('chip-has-math');
            chip?.classList.toggle('active', parsed.hasMathOnly);
        }
        if (parsed.browseView) {
            state.browseView = parsed.browseView;
        }
        if (Array.isArray(parsed.selectedRegions) && parsed.selectedRegions.length > 0) {
            state.selectedRegions = new Set(parsed.selectedRegions);
            document.querySelectorAll('#region-filters .filter-chip').forEach(chip => {
                const input = chip.querySelector('input');
                if (input) {
                    const isChecked = state.selectedRegions.has(input.value);
                    input.checked = isChecked;
                    chip.classList.toggle('active', isChecked);
                }
            });
        }
        if (Array.isArray(parsed.selectedFields) && parsed.selectedFields.length > 0) {
            state.selectedFields = new Set(parsed.selectedFields);
            document.querySelectorAll('#field-filters .filter-chip').forEach(chip => {
                const input = chip.querySelector('input');
                if (input) {
                    const isChecked = state.selectedFields.has(input.value);
                    input.checked = isChecked;
                    chip.classList.toggle('active', isChecked);
                }
            });
        }
    } catch (e) {
        console.error('Failed to load scores state from localStorage:', e);
    }
}

// ── 초기화 ───────────────────────────────────────────────────────────────────
async function initApp() {
    try {
        const res = await fetch('./essay_scores.csv');
        if (!res.ok) throw new Error(`CSV 로드 실패: ${res.status}`);
        const text = await res.text();
        state.allData = parseCSV(text);

        initFilterOptions();
        initExamTabs();
        
        // URL 파라미터가 있으면 우선 적용하고, 없으면 로컬스토리지에서 복원
        const hasUrlParam = handleUrlParams();
        if (!hasUrlParam) {
            loadScoresStateFromLocalStorage();
        }

        initQuickUnivTags();
        applyFilters();
    } catch (err) {
        console.error(err);
        const tbody = document.getElementById('table-body');
        if (tbody) tbody.innerHTML = `<tr><td colspan="10" class="no-data-msg">⚠️ 데이터를 불러오지 못했습니다.</td></tr>`;
    }
}

// ── URL 파라미터 처리 ─────────────────────────────────────────────────────────
function handleUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const searchVal = params.get('univ') || params.get('search');
    if (searchVal) {
        state.searchQuery = searchVal.trim().toLowerCase();
        const input = document.getElementById('search-input');
        if (input) input.value = searchVal.trim();
        return true;
    }
    return false;
}

// ── 빠른 대학 선택 칩 (기본: 단일 선택, 다중선택 ON/OFF 스위치 지원) ─────────
function initQuickUnivTags() {
    const container = document.getElementById('quick-univ-tags');
    if (!container) return;
    const univs = [...new Set(state.allData.map(d => d.대학명))].sort();
    const hasSelection = state.selectedUnivs.size > 0;

    container.innerHTML = `
        <div class="quick-univ-toolbar">
            <button class="multi-select-toggle-btn ${state.isMultiSelectUniv ? 'active' : ''}" onclick="toggleMultiSelectMode()" title="다중 대학 비교 모드 켜기/끄기">
                ${state.isMultiSelectUniv ? '☑️ 다중선택 ON' : '◻️ 다중선택 OFF'}
            </button>
            ${hasSelection ? `<button class="quick-univ-clear-btn" onclick="clearSelectedUnivs()" title="선택된 대학 전체 해제">선택 해제 ✕</button>` : ''}
        </div>
        <div class="quick-univ-chips-wrap">
            ${univs.map(u => {
                const isAct = state.selectedUnivs.has(u);
                return `<button class="quick-univ-chip ${isAct ? 'active' : ''}" onclick="toggleQuickUniv('${escapeHtml(u)}')">${escapeHtml(u)}</button>`;
            }).join('')}
        </div>
    `;
}

window.toggleMultiSelectMode = function() {
    state.isMultiSelectUniv = !state.isMultiSelectUniv;
    // 다중선택을 OFF로 끌 때 2개 이상 선택되어 있다면 첫 번째 대학 1개만 유지
    if (!state.isMultiSelectUniv && state.selectedUnivs.size > 1) {
        const first = Array.from(state.selectedUnivs)[0];
        state.selectedUnivs = new Set([first]);
    }
    state.currentPage = 1;
    initQuickUnivTags();
    applyFilters();
};

window.toggleQuickUniv = function(univName) {
    if (state.isMultiSelectUniv) {
        // 다중 선택 모드
        if (state.selectedUnivs.has(univName)) {
            state.selectedUnivs.delete(univName);
        } else {
            state.selectedUnivs.add(univName);
        }
    } else {
        // 단일 선택 모드 (기본): 이미 선택된 대학을 다시 누르면 해제, 다른 대학 누르면 해당 대학만 선택
        if (state.selectedUnivs.has(univName)) {
            state.selectedUnivs.clear();
        } else {
            state.selectedUnivs.clear();
            state.selectedUnivs.add(univName);
        }
    }
    state.currentPage = 1;
    initQuickUnivTags();
    applyFilters();
};

window.clearSelectedUnivs = function() {
    state.selectedUnivs.clear();
    state.currentPage = 1;
    initQuickUnivTags();
    applyFilters();
};

// ── 가이드 / 분석 코멘트 토글 ───────────────────────────────────────────────
window.toggleStrategyGuide = function() {
    const card = document.getElementById('strategy-guide-card');
    const btn = document.getElementById('strategy-toggle-btn');
    if (!card) return;

    state.strategyGuideOpen = !state.strategyGuideOpen;
    if (state.strategyGuideOpen) {
        card.style.display = 'block';
        if (btn) btn.textContent = '💡 분석 코멘트 접기 ▲';
    } else {
        card.style.display = 'none';
        if (btn) btn.textContent = '💡 합격선 데이터 해석 코멘트 ▼';
    }
};

// ── 시험구분 탭 (전체, 인문, 자연, 의치한약수, 약술형) ─────────────────────
function initExamTabs() {
    const tabBar = document.getElementById('exam-tab-bar');
    if (!tabBar) return;

    const tabs = [
        { key: 'all', label: '전체 보기', color: '#1E3A8A' },
        { key: '인문', label: '📖 인문', color: '#EA580C' },
        { key: '자연', label: '🔬 자연', color: '#059669' },
        { key: '의치한약수', label: '🩺 의치한약수', color: '#7C3AED' },
        { key: '약술형', label: '✏️ 약술형', color: '#D97706' }
    ];

    tabBar.innerHTML = tabs.map(t => `
        <button class="exam-tab ${t.key === state.activeExamTab ? 'active' : ''}"
                style="border-color:${t.color};"
                onclick="switchExamTab('${t.key}')">${t.label}</button>
    `).join('');
}

window.switchExamTab = function(key) {
    state.activeExamTab = key;
    state.currentPage = 1;
    document.querySelectorAll('.exam-tab').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick')?.includes(`'${key}'`));
    });
    applyFilters();
};

// ── 필터 옵션 초기화 ─────────────────────────────────────────────────────────
function initFilterOptions() {
    const regions = [...new Set(state.allData.map(d => d.지역구분).filter(Boolean))].sort();
    const fields  = [...new Set(state.allData.map(d => d.계열구분).filter(Boolean))].sort();

    state.selectedRegions = new Set(regions);
    state.selectedFields  = new Set(fields);

    renderChips('region-filters', regions, 'region');
    renderChips('field-filters', fields, 'field');
}

function renderChips(containerId, items, type) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = items.map(item => `
        <label class="filter-chip active" id="chip-${type}-${CSS.escape(item)}">
            <input type="checkbox" value="${item}" checked onchange="toggleFilter('${type}','${item}')">
            <span>${item}</span>
        </label>
    `).join('');
}

window.toggleFilter = function(type, value) {
    const set = type === 'region' ? state.selectedRegions : state.selectedFields;
    const chipId = `chip-${type}-${CSS.escape(value)}`;
    const chip = document.getElementById(chipId);
    if (set.has(value)) {
        set.delete(value);
        chip?.classList.remove('active');
    } else {
        set.add(value);
        chip?.classList.add('active');
    }
    state.currentPage = 1;
    applyFilters();
};

window.toggleAllFilters = function(type, selectAll) {
    const items = [...new Set(state.allData.map(d => type === 'region' ? d.지역구분 : d.계열구분).filter(Boolean))];
    const set = type === 'region' ? state.selectedRegions : state.selectedFields;
    if (selectAll) { items.forEach(v => set.add(v)); }
    else { set.clear(); }
    items.forEach(v => {
        const chip = document.getElementById(`chip-${type}-${CSS.escape(v)}`);
        const input = chip?.querySelector('input');
        if (input) input.checked = selectAll;
        if (selectAll) chip?.classList.add('active');
        else chip?.classList.remove('active');
    });
    state.currentPage = 1;
    applyFilters();
};

window.setMinimumFilter = function(val) {
    state.selectedMinimum = val;
    state.currentPage = 1;
    ['all', 'Y', 'N'].forEach(k => {
        const btn = document.getElementById(`btn-min-${k}`);
        if (btn) btn.classList.toggle('active', k === val);
    });
    applyFilters();
};

window.toggleHasMathOnly = function(checked) {
    state.hasMathOnly = checked;
    state.currentPage = 1;
    const chip = document.getElementById('chip-has-math');
    chip?.classList.toggle('active', checked);
    applyFilters();
};

window.clearSearch = function() {
    state.searchQuery = '';
    state.selectedUnivs.clear();
    state.selectedSubExam = 'all';
    const si = document.getElementById('search-input');
    if (si) si.value = '';
    const clearBtn = document.getElementById('search-clear-btn');
    if (clearBtn) clearBtn.style.display = 'none';
    state.currentPage = 1;
    initQuickUnivTags();
    applyFilters();
};

window.handleSearch = function(q) {
    state.searchQuery = q.trim().toLowerCase();
    state.selectedSubExam = 'all';
    state.currentPage = 1;
    const si = document.getElementById('search-input');
    if (si && si.value !== q) si.value = q;
    
    const clearBtn = document.getElementById('search-clear-btn');
    if (clearBtn) clearBtn.style.display = (state.searchQuery || state.selectedUnivs.size > 0) ? 'flex' : 'none';

    applyFilters();
};

window.filterSubExam = function(examName) {
    state.selectedSubExam = examName;
    state.currentPage = 1;
    applyFilters();
};

window.resetAllFilters = function() {
    clearSearch();
    state.isMultiSelectUniv = false;
    state.selectedSubExam = 'all';
    toggleAllFilters('region', true);
    toggleAllFilters('field', true);
    setMinimumFilter('all');
    toggleHasMathOnly(false);
    const cb = document.getElementById('check-has-math');
    if (cb) cb.checked = false;
    state.activeExamTab = 'all';
    initExamTabs();
    initQuickUnivTags();
    applyFilters();
};

window.switchBrowseView = function(viewType) {
    state.browseView = viewType;
    document.getElementById('btn-view-univ')?.classList.toggle('active', viewType === 'univ');
    document.getElementById('btn-view-table')?.classList.toggle('active', viewType === 'table');

    const univView = document.getElementById('univ-grouped-view');
    const tableView = document.getElementById('browse-table-section');

    if (viewType === 'univ') {
        if (univView) univView.style.display = 'flex';
        if (tableView) tableView.style.display = 'none';
    } else {
        if (univView) univView.style.display = 'none';
        if (tableView) tableView.style.display = 'block';
        renderBrowseTable();
    }
};

window.toggleUnivAccordion = function(univName) {
    if (state.expandedUnivs.has(univName)) {
        state.expandedUnivs.delete(univName);
    } else {
        state.expandedUnivs.add(univName);
    }
    renderUnivGroupedView();
};

// ── 필터링 및 레이아웃 분기 (다중 대학 비교 지원) ───────────────────────────
function applyFilters() {
    state.filteredData = state.allData.filter(item => {
        if (!state.selectedRegions.has(item.지역구분)) return false;
        if (!state.selectedFields.has(item.계열구분)) return false;
        
        // 시험구분 필터 (전체, 인문, 자연, 의치한약수, 약술형)
        if (state.activeExamTab !== 'all') {
            const tab = state.activeExamTab;
            const exKey = item.examType?.key || '';
            const exLabel = item.examType?.label || '';
            const field = item.계열구분 || '';
            const examStr = item.시험구분 || '';

            if (tab === '의치한약수') {
                if (exKey !== '의치한약수' && exKey !== '한양_의예' && !item.메디컬) return false;
            } else if (tab === '약술형') {
                if (exKey !== '약술형') return false;
            } else if (tab === '인문') {
                // 의치한약수, 약술형 제외한 인문 계열
                if (exKey === '의치한약수' || exKey === '한양_의예' || exKey === '약술형') return false;
                const isHum = exKey.startsWith('인문') || exKey === '상경계열' || field.includes('인문') || examStr.includes('인문') || examStr.includes('상경');
                if (!isHum) return false;
            } else if (tab === '자연') {
                // 의치한약수, 약술형 제외한 자연 계열
                if (exKey === '의치한약수' || exKey === '한양_의예' || exKey === '약술형') return false;
                const isNat = exKey.startsWith('자연') || field.includes('자연') || field.includes('공학') || field.includes('IT') || examStr.includes('자연');
                if (!isNat) return false;
            }
        }

        if (state.selectedMinimum !== 'all') {
            if (state.selectedMinimum === 'Y' && item.최저여부 !== 'Y') return false;
            if (state.selectedMinimum === 'N' && item.최저여부 !== 'N') return false;
        }

        if (state.hasMathOnly && !item.hasMathData) return false;

        // 다중 대학 칩 선택 필터
        if (state.selectedUnivs.size > 0 && !state.selectedUnivs.has(item.대학명)) {
            return false;
        }

        // 대학 검색 모드 내 대학별 3안 세부 시험구분 필터
        if (state.selectedSubExam && state.selectedSubExam !== 'all' && item.시험구분 !== state.selectedSubExam) {
            return false;
        }

        // 검색어 필터 (쉼표나 띄어쓰기로 여러 대학/학과 검색 가능)
        if (state.searchQuery) {
            const tokens = state.searchQuery.split(/[,\s]+/).filter(Boolean);
            const targetText = `${item.대학명} ${item.학과명} ${item.계열구분} ${item.examType.fullLabel} ${item.합격점수라인의미}`.toLowerCase();
            const matchAll = tokens.every(tok => targetText.includes(tok));
            if (!matchAll) return false;
        }
        return true;
    });

    sortData();
    updateMetrics();

    const isFilteredByUnivOrSearch = state.selectedUnivs.size > 0 || state.searchQuery.length > 0;
    
    // 사용자가 기본값에서 필터(검색어, 대학선택, 시험구분, 최저여부, 수학표본, 지역/계열 해제)를 하나라도 적용했는지 확인
    const totalRegions = new Set(state.allData.map(d => d.지역구분).filter(Boolean)).size;
    const totalFields  = new Set(state.allData.map(d => d.계열구분).filter(Boolean)).size;
    const isAnyFilterApplied = isFilteredByUnivOrSearch
        || (state.activeExamTab !== 'all')
        || (state.selectedMinimum !== 'all')
        || state.hasMathOnly
        || (state.selectedRegions.size < totalRegions)
        || (state.selectedFields.size < totalFields);

    const searchContainer = document.getElementById('search-mode-container');
    const deptSearchContainer = document.getElementById('dept-search-mode-container');
    const browseContainer = document.getElementById('browse-mode-container');
    const browseBottomAnalytics = document.getElementById('browse-bottom-analytics');

    const headerBadge = document.getElementById('header-mode-badge');
    const headerDesc = document.getElementById('header-mode-desc');

    const matchedUnivs = [...new Set(state.filteredData.map(d => d.대학명))];

    if (!isFilteredByUnivOrSearch) {
        // [Mode B]: 전국 대학 탐색 모드 (기본: 전체 학과 테이블 뷰)
        if (headerBadge) {
            headerBadge.textContent = '전국 대학 탐색 모드';
            headerBadge.style.background = '#F6C9D6';
            headerBadge.style.color = '#0F5A43';
        }
        if (headerDesc) {
            headerDesc.textContent = '상단 빠른선택에서 여러 대학을 클릭하여 비교하거나 학과명을 검색해보세요.';
        }

        if (searchContainer) searchContainer.style.display = 'none';
        if (deptSearchContainer) deptSearchContainer.style.display = 'none';
        if (browseContainer) browseContainer.style.display = 'flex';

        if (state.browseView === 'table') {
            const univView = document.getElementById('univ-grouped-view');
            const tableView = document.getElementById('browse-table-section');
            if (univView) univView.style.display = 'none';
            if (tableView) tableView.style.display = 'block';
            renderBrowseTable();
        } else {
            const univView = document.getElementById('univ-grouped-view');
            const tableView = document.getElementById('browse-table-section');
            if (univView) univView.style.display = 'flex';
            if (tableView) tableView.style.display = 'none';
            renderUnivGroupedView();
        }

        // 처음 진입(전체 화면)이 아닌 필터/검색 조건이 1개라도 걸려있을 때만 하단 통계/비교 차트 노출
        if (browseBottomAnalytics) {
            if (isAnyFilterApplied) {
                browseBottomAnalytics.style.display = 'flex';
                updateBrowseCharts();
            } else {
                browseBottomAnalytics.style.display = 'none';
            }
        }
    } else if (matchedUnivs.length === 1) {
        // [Mode A-1]: 단일 대학 내부 심층 분석실
        const targetUniv = matchedUnivs[0];
        if (headerBadge) {
            headerBadge.textContent = '대학 내부 학과 심층 분석실';
            headerBadge.style.background = '#DBEAFE';
            headerBadge.style.color = '#1E40AF';
        }
        if (headerDesc) {
            headerDesc.innerHTML = `🏢 <strong>"${targetUniv}"</strong> 대학 내부 학과별 논술 점수 · 시험 계열 비교 · 수능 백분위 심층 분석 중입니다.`;
        }

        if (searchContainer) searchContainer.style.display = 'flex';
        if (deptSearchContainer) deptSearchContainer.style.display = 'none';
        if (browseContainer) browseContainer.style.display = 'none';

        renderSearchModeBanner();
        renderSearchTable();
        updateSearchCharts();
        renderSearchInsights();
    } else {
        // [Mode A-2]: 여러 대학 비교 / 학과별 전국 비교 모드
        const univNames = state.selectedUnivs.size > 0 
            ? Array.from(state.selectedUnivs).join(', ')
            : (state.searchQuery || '전국 대학');

        if (headerBadge) {
            headerBadge.textContent = '전국 대학별 비교 모드';
            headerBadge.style.background = '#E0E7FF';
            headerBadge.style.color = '#3730A3';
        }
        if (headerDesc) {
            headerDesc.innerHTML = `🔍 <strong>${matchedUnivs.length}개 대학</strong> (${escapeHtml(univNames)}) 관련 학과 합격선 및 수능최저 비교 분석 중입니다.`;
        }

        if (searchContainer) searchContainer.style.display = 'none';
        if (deptSearchContainer) deptSearchContainer.style.display = 'flex';
        if (browseContainer) browseContainer.style.display = 'none';

        renderDeptSearchBanner(matchedUnivs);
        renderDeptSearchTable();
        updateDeptSearchCharts();
    }

    saveScoresStateToLocalStorage();
}

function sortData() {
    const col = state.sortColumn;
    const dir = state.sortDirection === 'asc' ? 1 : -1;
    state.filteredData.sort((a, b) => {
        let vA = a[col], vB = b[col];
        if (col === '계열분류') {
            vA = a.시험구분 || a.examType?.label || '';
            vB = b.시험구분 || b.examType?.label || '';
        }
        if (typeof vA === 'string') return vA.localeCompare(vB, 'ko') * dir;
        return ((vA ?? -Infinity) - (vB ?? -Infinity)) * dir;
    });
}

window.handleSort = function(column) {
    if (state.sortColumn === column) {
        state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        state.sortColumn = column;
        state.sortDirection = (column === '환산점수' || column === '논술점수') ? 'desc' : 'asc';
    }
    document.querySelectorAll('.scores-table th').forEach(th => {
        th.classList.remove('active-sort');
        const icon = th.querySelector('.sort-icon');
        if (icon) icon.textContent = '⇅';
    });
    const activeTh = document.getElementById(`th-${column}`);
    if (activeTh) {
        activeTh.classList.add('active-sort');
        const icon = activeTh.querySelector('.sort-icon');
        if (icon) icon.textContent = state.sortDirection === 'asc' ? '▲' : '▼';
    }
    sortData();

    // 현재 표시 중인 컨테이너에 맞춰 정확한 테이블 렌더러 호출
    const searchContainer = document.getElementById('search-mode-container');
    const deptSearchContainer = document.getElementById('dept-search-mode-container');
    const matchedUnivs = [...new Set(state.filteredData.map(d => d.대학명))];

    if ((searchContainer && searchContainer.style.display !== 'none') || matchedUnivs.length === 1 || state.selectedUnivs.size === 1) {
        renderSearchTable();
    } else if (deptSearchContainer && deptSearchContainer.style.display !== 'none') {
        renderDeptSearchTable();
    } else {
        renderBrowseTable();
    }
};

function updateMetrics() {
    const d = state.filteredData;
    const total = d.length;
    // 의치한약수(메디컬) 제외한 일반 학과 대상 환산점수 목록 (극단치 왜곡 방지)
    const nonMedicalData = d.filter(x => !x.메디컬 && x.examType?.key !== '의치한약수');
    const scores = nonMedicalData.map(x => x.환산점수).filter(x => x > 0);
    const avgScore = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : '-';
    const maxItem = nonMedicalData.length ? nonMedicalData.reduce((p, c) => p.환산점수 > c.환산점수 ? p : c) : null;
    const univCount = new Set(d.map(x => x.대학명)).size;
    const mathCount = d.filter(x => x.hasMathData).length;

    setText('metric-total-count', `${total.toLocaleString()}개`);
    setText('metric-avg-score', scores.length ? `${avgScore}점` : '-');
    setText('metric-max-score', maxItem ? `${maxItem.환산점수.toFixed(2)}점 (${maxItem.대학명})` : '-');
    setText('metric-univ-count', `${univCount}개교`);
    setText('metric-math-count', `${mathCount}개 학과`);
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

// ═════════════════════════════════════════════════════════════════════════════
//  [MODE A: 대학 검색 모드 - 시험 1/2/3 색상 테마 적용]
// ═════════════════════════════════════════════════════════════════════════════

function renderSearchModeBanner() {
    const banner = document.getElementById('univ-focus-banner');
    if (!banner) return;

    // 현재 대학의 전체 데이터 추출 (필터 전 원본 기준 시험구분 목록)
    const targetUniv = state.selectedUnivs.size === 1 ? Array.from(state.selectedUnivs)[0] : (state.searchQuery || '');
    const univAllItems = state.allData.filter(d => {
        if (state.selectedUnivs.size === 1) return state.selectedUnivs.has(d.대학명);
        if (state.searchQuery) return d.대학명.toLowerCase().includes(state.searchQuery);
        return false;
    });

    const uniqueUnivs = [...new Set(state.filteredData.map(d => d.대학명))];
    const univName = uniqueUnivs.length === 1 ? uniqueUnivs[0] : (targetUniv || `검색결과: "${state.searchQuery}"`);
    const totalDepts = state.filteredData.length;
    
    // 메디컬 제외 일반 학과 대상 평균
    const nonMedicalDepts = state.filteredData.filter(d => !d.메디컬 && d.examType?.key !== '의치한약수');
    const scores = (nonMedicalDepts.length ? nonMedicalDepts : state.filteredData).map(d => d.환산점수).filter(v => v > 0);
    const univAvg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : '-';

    // 해당 대학의 모든 3안 고유 시험구분 목록 도출
    const baseItems = univAllItems.length > 0 ? univAllItems : state.filteredData;
    const examMap = {};
    baseItems.forEach(d => {
        const exName = d.시험구분 || '공통';
        if (!examMap[exName]) examMap[exName] = [];
        examMap[exName].push(d.환산점수);
    });

    // 전체 버튼
    const isAllActive = !state.selectedSubExam || state.selectedSubExam === 'all';
    const allBtn = `
        <button class="sub-exam-filter-btn ${isAllActive ? 'active' : ''}" 
                onclick="filterSubExam('all')"
                style="padding:4px 10px; border-radius:999px; font-size:0.75rem; font-weight:700; cursor:pointer; transition:all 0.2s;
                       background:${isAllActive ? '#1E40AF' : '#F3F4F6'}; color:${isAllActive ? '#FFFFFF' : '#4B5563'}; border:1px solid ${isAllActive ? '#1E40AF' : '#D1D5DB'};">
            전체 (${baseItems.length})
        </button>
    `;

    // 3안 대학별 시험구분 필터 버튼 칩
    const examButtons = Object.entries(examMap).map(([exam, arr]) => {
        const theme = getExamTheme(exam);
        const avg = (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1);
        const isActive = state.selectedSubExam === exam;
        return `
            <button class="sub-exam-filter-btn ${isActive ? 'active' : ''}" 
                    onclick="filterSubExam('${escapeHtml(exam)}')"
                    title="${escapeHtml(exam)} 시험지로 치른 학과만 필터링"
                    style="padding:4px 10px; border-radius:999px; font-size:0.75rem; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:4px; transition:all 0.2s;
                           background:${isActive ? theme.color : theme.bgColor}; 
                           color:${isActive ? '#FFFFFF' : theme.color}; 
                           border:1.5px solid ${theme.color};
                           box-shadow:${isActive ? '0 2px 6px rgba(0,0,0,0.15)' : 'none'};">
                <span>${isActive ? '✓ ' : ''}<strong>${escapeHtml(exam)}</strong></span>
                <span style="font-size:0.7rem; opacity:0.9;">(${arr.length}개·평균 ${avg}점)</span>
            </button>
        `;
    }).join(' ');

    banner.innerHTML = `
        <div class="univ-focus-info">
            <div class="univ-focus-name">
                <span>🏢 ${escapeHtml(univName)} <span style="font-size:1.05rem; font-weight:600; color:#E0E7FF;">내부 상세 분석실</span></span>
                <span class="badge-tag" style="background:#FFFFFF; color:#1E40AF; font-size:0.8rem; font-weight:800;">${totalDepts}개 학과 표시 중</span>
            </div>
            <div class="univ-focus-stats" style="display:flex; flex-direction:column; gap:0.5rem; align-items:flex-start;">
                <div style="display:flex; gap:0.6rem; align-items:center; flex-wrap:wrap;">
                    <span>대학 환산평균(메디컬제외): <strong>${univAvg}점</strong></span>
                    <span style="opacity:0.6;">|</span>
                    <span>지역: <strong>${baseItems[0]?.지역구분 || '-'}</strong></span>
                </div>
                <div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap; margin-top:0.1rem;">
                    <span style="font-size:0.78rem; font-weight:700; color:#DBEAFE;">🏷️ 대학 시험구분(3안) 선택:</span>
                    ${allBtn}
                    ${examButtons}
                </div>
            </div>
        </div>
        <button class="univ-focus-reset-btn" onclick="clearSearch()" title="전국 대학별 목록으로 나가기">
            ← 🏛️ 전국 대학별 목록으로 나가기
        </button>
    `;
}

// [1순위] 학과별 논술점수 및 백분위 현황 테이블 (시험별 색상 뱃지 적용)
function renderSearchTable() {
    const tbody = document.getElementById('table-body');
    if (!tbody) return;

    const total = state.filteredData.length;
    setText('table-count-badge', `총 ${total.toLocaleString()}건`);

    if (total === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="no-data-msg">🔍 검색 조건에 일치하는 학과가 없습니다.</td></tr>`;
        renderPagination(0);
        return;
    }

    const start = (state.currentPage - 1) * state.itemsPerPage;
    const items = state.filteredData.slice(start, start + state.itemsPerPage);

    tbody.innerHTML = items.map(item => {
        const pct = Math.min(Math.max(item.환산점수, 0), 100);
        const theme = item.examType || getExamTheme(item);

        // 시험 구분 색상 뱃지 (대학 3안 명칭 + 표준 융합 테마)
        const examLabel = `
            <div style="display:flex; flex-direction:column; gap:2px; align-items:flex-start;">
                <span class="exam-badge-pill" style="background:${theme.bgColor}; color:${theme.color}; border:1px solid ${theme.borderColor}; font-weight:700;">
                    ${escapeHtml(item.시험구분 || theme.label)}
                </span>
                ${item.시험구분 && item.시험구분 !== theme.label ? `
                    <span style="font-size:0.65rem; color:#6B7280; margin-left:2px;">(${theme.label})</span>
                ` : ''}
            </div>
        `;

        const cut70Disp = item.cut70 != null ? `${item.cut70.toFixed(2)}` : '-';
        const minCutDisp = item.최저점 != null ? `${item.최저점.toFixed(2)}` : '-';

        // 꼬리 마진 계산 (70% Cut - 최저점)
        let tailBadge = '';
        if (item.cut70 != null && item.최저점 != null) {
            const tailMargin = (item.cut70 - item.최저점).toFixed(1);
            if (parseFloat(tailMargin) > 0) {
                tailBadge = `<span style="display:inline-block; font-size:0.68rem; color:#9D174D; background:#FCE7F3; border:1px solid #FBCFE8; padding:1px 4px; border-radius:3px; font-weight:700; margin-top:2px;">꼬리 -${tailMargin}점</span>`;
            }
        }

        const minBadge = item.최저여부 === 'Y'
            ? '<span class="badge-min-y">최저 있음</span>'
            : (item.최저여부 === 'N' ? '<span class="badge-min-n">최저 없음</span>' : '<span style="color:#9CA3AF">-</span>');

        let mathBadge = '<span style="color:#9CA3AF; font-size:0.75rem;">-</span>';
        if (item.hasMathData) {
            const passM = item.mathPassMed !== null ? item.mathPassMed.toFixed(1) : (item.mathPassAvg !== null ? item.mathPassAvg.toFixed(1) : '-');
            const failM = item.mathFailMed !== null ? item.mathFailMed.toFixed(1) : (item.mathFailAvg !== null ? item.mathFailAvg.toFixed(1) : '-');
            const countStr = item.mathPassCount ? `(n=${item.mathPassCount})` : '';

            mathBadge = `
                <div class="math-score-pill" onclick="openMathModal(${item._id})" title="클릭하여 수능 수학 상세 통계 보기">
                    <span class="math-pass-dot">🟢 합: <strong>${passM}</strong></span>
                    ${failM !== '-' ? `<span class="math-fail-dot">🔴 불: <strong>${failM}</strong></span>` : ''}
                    <span style="font-size:0.65rem; color:#6B7280;">${countStr}</span>
                </div>
            `;
        }

        const lineBadge = item.합격점수라인의미
            ? `<div class="line-meaning-cell" title="${escapeHtml(item.합격점수라인의미)}">${escapeHtml(item.합격점수라인의미)}</div>`
            : '<span style="color:#9CA3AF">-</span>';

        return `
            <tr>
                <td style="font-weight:700; color:var(--primary);">${escapeHtml(item.대학명)}</td>
                <td>${examLabel}</td>
                <td><span class="field-badge">${escapeHtml(item.계열구분)}</span></td>
                <td style="font-weight:700;">
                    ${escapeHtml(item.학과명)}
                    ${item.메디컬 ? '<span class="tag-medical-pill">의약</span>' : ''}
                    ${item.태그 && item.태그 !== '일반학과' ? `<span class="tag-sub-pill">${escapeHtml(item.태그)}</span>` : ''}
                </td>
                <td>${minBadge}</td>
                <td style="text-align:right; font-variant-numeric:tabular-nums; color:#4B5563;">${item.논술점수.toFixed(2)}</td>
                <td>
                    <div class="score-bar-cell">
                        <span class="score-num" style="color:${theme.color};">${item.환산점수.toFixed(2)}</span>
                        <div class="score-bar-bg"><div class="score-bar-fill" style="width:${pct}%; background:${theme.chartBg};"></div></div>
                    </div>
                </td>
                <td style="font-size:0.78rem; line-height:1.35; white-space:nowrap;">
                    ${cut70Disp !== '-' ? `<span style="color:#4F46E5; font-weight:700;">70%: ${cut70Disp}</span><br>` : ''}
                    ${minCutDisp !== '-' ? `<span style="color:#C2547A; font-weight:700;">최저: ${minCutDisp}</span>` : ''}
                    ${tailBadge ? `<br>${tailBadge}` : ''}
                </td>
                <td>${mathBadge}</td>
                <td>${lineBadge}</td>
            </tr>
        `;
    }).join('');

    renderPagination(total);
}

function renderPagination(totalItems) {
    const container = document.getElementById('pagination-container');
    if (!container) return;
    const totalPages = Math.ceil(totalItems / state.itemsPerPage);
    if (totalPages <= 1) {
        container.innerHTML = `<span class="pagination-info">전체 ${totalItems}건 표시 중</span>`;
        return;
    }
    const startItem = (state.currentPage - 1) * state.itemsPerPage + 1;
    const endItem   = Math.min(state.currentPage * state.itemsPerPage, totalItems);
    let html = `<span class="pagination-info">${startItem}-${endItem} / 총 ${totalItems.toLocaleString()}건</span><div class="pagination-controls">`;
    html += `<button class="page-btn" ${state.currentPage===1?'disabled':''} onclick="goToPage(1)">«</button>`;
    html += `<button class="page-btn" ${state.currentPage===1?'disabled':''} onclick="goToPage(${state.currentPage-1})">‹</button>`;
    let sp = Math.max(1, state.currentPage-2);
    let ep = Math.min(totalPages, sp+4);
    if (ep-sp<4) sp = Math.max(1,ep-4);
    for (let p = sp; p <= ep; p++) {
        html += `<button class="page-btn ${p===state.currentPage?'active':''}" onclick="goToPage(${p})">${p}</button>`;
    }
    html += `<button class="page-btn" ${state.currentPage===totalPages?'disabled':''} onclick="goToPage(${state.currentPage+1})">›</button>`;
    html += `<button class="page-btn" ${state.currentPage===totalPages?'disabled':''} onclick="goToPage(${totalPages})">»</button>`;
    html += '</div>';
    container.innerHTML = html;
}

window.goToPage = function(page) {
    state.currentPage = page;
    renderSearchTable();
    document.getElementById('table-card')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

// [2순위] 학과별 점수 차트 (시험구분별 색상 반영)
function updateSearchCharts() {
    updateSearchDeptScoreChart();
    updateSearchDeptMathChart();
}

window.switchDeptScoreChartMode = function(mode) {
    state.deptScoreChartMode = mode;
    const btnDiv = document.getElementById('btn-chart-mode-diverging');
    const btnAbs = document.getElementById('btn-chart-mode-absolute');
    const titleEl = document.getElementById('dept-score-chart-title');
    const hintEl = document.getElementById('dept-score-chart-hint');

    if (mode === 'diverging') {
        btnDiv?.classList.add('active');
        if (btnDiv) { btnDiv.style.background = '#1E40AF'; btnDiv.style.color = '#fff'; }
        btnAbs?.classList.remove('active');
        if (btnAbs) { btnAbs.style.background = 'transparent'; btnAbs.style.color = '#6B7280'; }
        if (titleEl) titleEl.innerHTML = '📊 대학/시험지 평균 대비 학과별 편차 비교 (효과적)';
        if (hintEl) hintEl.textContent = '기준선(0점) = 대학/시험지 평균';
    } else {
        btnAbs?.classList.add('active');
        if (btnAbs) { btnAbs.style.background = '#1E40AF'; btnAbs.style.color = '#fff'; }
        btnDiv?.classList.remove('active');
        if (btnDiv) { btnDiv.style.background = 'transparent'; btnDiv.style.color = '#6B7280'; }
        if (titleEl) titleEl.innerHTML = '📊 대학 내 학과별 100점 환산점수 및 70% Cut 비교';
        if (hintEl) hintEl.textContent = '100점 만점 환산점수 기준';
    }
    updateSearchDeptScoreChart();
};

function updateSearchDeptScoreChart() {
    const ctx = document.getElementById('searchDeptScoreChart')?.getContext('2d');
    if (!ctx) return;

    const sorted = [...state.filteredData].sort((a, b) => b.환산점수 - a.환산점수).slice(0, 16);
    const labels = sorted.map(d => `${d.학과명.length > 8 ? d.학과명.slice(0,7)+'..' : d.학과명} (${d.examType?.label || d.시험구분})`);
    const scores = sorted.map(d => +d.환산점수.toFixed(2));
    const cut70s = sorted.map(d => d.cut70 != null ? +d.cut70.toFixed(2) : null);
    
    // 시험 종류별 색상 배열 부여
    const bgColors = sorted.map(d => (d.examType || getExamTheme(d.시험구분)).chartBg);
    const borderColors = sorted.map(d => (d.examType || getExamTheme(d.시험구분)).chartBorder);

    // 전체 평균 또는 세부시험 평균 기준치 산출
    const validScores = scores.filter(v => v > 0);
    const baselineAvg = validScores.length ? (validScores.reduce((a, b) => a + b, 0) / validScores.length) : 70;

    if (state.charts.searchDeptScore) state.charts.searchDeptScore.destroy();

    if (state.deptScoreChartMode === 'diverging') {
        // [4번 추천: 양방향 편차 차트 (Diverging Baseline Chart)]
        // 각 학과의 점수가 "대학/시험지 평균(기준선 0)" 대비 몇 점 높고 낮은지 표시
        const diffScores = scores.map(s => +(s - baselineAvg).toFixed(2));
        const diffCut70s = sorted.map(d => d.cut70 != null ? +(d.cut70 - baselineAvg).toFixed(2) : null);

        // 양수(평균 이상)는 그린/블루 계열, 음수(평균 이하)는 오렌지/레드 계열 또는 학과 고유 테마 강조
        const divergingBg = diffScores.map((diff, i) => {
            return diff >= 0 ? bgColors[i] : 'rgba(225, 29, 72, 0.82)'; // 평균 미달은 직관적인 로즈/레드
        });
        const divergingBorder = diffScores.map((diff, i) => {
            return diff >= 0 ? borderColors[i] : '#E11D48';
        });

        // 편차의 최댓값/최솟값으로 대칭 또는 여유있는 Y축 스케일 산출
        const maxDiff = Math.max(...diffScores.map(Math.abs), 5);
        const yBound = Math.ceil((maxDiff + 2) / 2) * 2;

        state.charts.searchDeptScore = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: `평균 대비 편차 (기준: ${baselineAvg.toFixed(1)}점)`,
                        data: diffScores,
                        backgroundColor: divergingBg,
                        borderColor: divergingBorder,
                        borderWidth: 1.5,
                        borderRadius: 4
                    },
                    {
                        label: '70% Cut 편차',
                        data: diffCut70s,
                        backgroundColor: 'rgba(79,70,229,0.75)',
                        borderColor: '#4338CA',
                        borderWidth: 1.5,
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { 
                        display: true, 
                        position: 'top', 
                        labels: { font: { family: 'Pretendard', size: 10, weight: '700' }, padding: 8 } 
                    },
                    tooltip: {
                        callbacks: {
                            label: ctx => {
                                const val = ctx.parsed.y;
                                if (val == null) return '-';
                                const sign = val > 0 ? '+' : '';
                                const actual = (baselineAvg + val).toFixed(2);
                                return `${ctx.dataset.label}: ${sign}${val.toFixed(2)}점 (실제: ${actual}점)`;
                            }
                        }
                    }
                },
                scales: {
                    y: { 
                        min: -yBound, 
                        max: yBound, 
                        grid: { 
                            color: ctx => ctx.tick.value === 0 ? 'rgba(30, 58, 138, 0.65)' : 'rgba(0,0,0,0.06)',
                            lineWidth: ctx => ctx.tick.value === 0 ? 2 : 1
                        }, 
                        ticks: { 
                            font: { family: 'Pretendard', size: 10, weight: '700' },
                            callback: val => `${val > 0 ? '+' : ''}${val}점`
                        } 
                    },
                    x: { grid: { display: false }, ticks: { font: { family: 'Pretendard', size: 10, weight: '600' }, maxRotation: 40 } }
                }
            }
        });
    } else {
        // [절대 점수 모드: Y축 동적 스케일링]
        const validValues = [...scores, ...cut70s.filter(v => v != null && v > 0)];
        let yMin = 0;
        let yMax = 100;
        if (validValues.length > 0) {
            const minVal = Math.min(...validValues);
            const maxVal = Math.max(...validValues);
            yMin = Math.max(0, Math.floor((minVal - 4) / 5) * 5);
            yMax = Math.min(100, Math.ceil((maxVal + 2) / 5) * 5);
            if (yMax - yMin < 15) {
                yMin = Math.max(0, yMin - 5);
                yMax = Math.min(100, yMax + 5);
            }
        }

        state.charts.searchDeptScore = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: '100점 환산점수 (시험별 색상)',
                        data: scores,
                        backgroundColor: bgColors,
                        borderColor: borderColors,
                        borderWidth: 1.5,
                        borderRadius: 4
                    },
                    {
                        label: '70% Cut',
                        data: cut70s,
                        backgroundColor: 'rgba(79,70,229,0.75)',
                        borderColor: '#4338CA',
                        borderWidth: 1.5,
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: true, position: 'top', labels: { font: { family: 'Pretendard', size: 10 }, padding: 8 } },
                    tooltip: {
                        callbacks: {
                            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y != null ? ctx.parsed.y.toFixed(2)+'점' : '-'}`
                        }
                    }
                },
                scales: {
                    y: { 
                        min: yMin, 
                        max: yMax, 
                        grid: { color: 'rgba(0,0,0,0.06)' }, 
                        ticks: { 
                            font: { family: 'Pretendard', size: 10, weight: '600' },
                            callback: val => `${val}점`
                        } 
                    },
                    x: { grid: { display: false }, ticks: { font: { family: 'Pretendard', size: 10, weight: '600' }, maxRotation: 40 } }
                }
            }
        });
    }
}

function updateSearchDeptMathChart() {
    const ctx = document.getElementById('searchDeptMathChart')?.getContext('2d');
    if (!ctx) return;

    const mathItems = state.filteredData.filter(d => d.hasMathData && d.mathPassMed !== null).slice(0, 12);

    if (mathItems.length === 0) {
        if (state.charts.searchDeptMath) state.charts.searchDeptMath.destroy();
        ctx.clearRect(0, 0, 400, 300);
        return;
    }

    const labels = mathItems.map(d => `${d.학과명.length > 7 ? d.학과명.slice(0,6)+'..' : d.학과명}`);
    const passMed = mathItems.map(d => d.mathPassMed);
    const failMed = mathItems.map(d => d.mathFailMed);

    if (state.charts.searchDeptMath) state.charts.searchDeptMath.destroy();
    state.charts.searchDeptMath = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: '합격자 수학 중앙값', data: passMed, backgroundColor: 'rgba(5,150,105,0.85)', borderColor: '#059669', borderWidth: 1, borderRadius: 4 },
                { label: '불합격자 수학 중앙값', data: failMed, backgroundColor: 'rgba(220,38,38,0.75)', borderColor: '#DC2626', borderWidth: 1, borderRadius: 4 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true, position: 'top', labels: { font: { family: 'Pretendard', size: 10 } } } },
            scales: {
                y: { min: 50, max: 100, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { family: 'Pretendard', size: 10 } } },
                x: { grid: { display: false }, ticks: { font: { family: 'Pretendard', size: 10, weight: '600' }, maxRotation: 40 } }
            }
        }
    });
}

// [3순위] 같은 시험 종류별 평균 비교 및 틈새/특이점 분석
function renderSearchInsights() {
    const container = document.getElementById('univ-insight-container');
    if (!container) return;

    const data = state.filteredData;
    if (data.length === 0) return;

    const allScores = data.map(d => d.환산점수).filter(v => v > 0);
    const univAvg = (allScores.reduce((a, b) => a + b, 0) / allScores.length);

    // 같은 시험종류(examType.key)별로 분류하여 평균 계산
    const examGroupMap = {};
    data.forEach(d => {
        const exKey = d.examType?.key || d.시험구분;
        if (!examGroupMap[exKey]) examGroupMap[exKey] = { items: [], scores: [], theme: d.examType };
        examGroupMap[exKey].items.push(d);
        examGroupMap[exKey].scores.push(d.환산점수);
    });

    const examGroupCards = Object.entries(examGroupMap).map(([examKey, g]) => {
        const theme = g.theme || getExamTheme(examKey);
        const groupAvg = (g.scores.reduce((a, b) => a + b, 0) / g.scores.length);
        
        // 해당 시험 내에서 평균보다 낮은 가성비(틈새) 학과
        const groupNiche = g.items
            .filter(d => d.환산점수 <= groupAvg)
            .sort((a, b) => a.환산점수 - b.환산점수)
            .slice(0, 3);

        const groupTop = [...g.items].sort((a, b) => b.환산점수 - a.환산점수)[0];

        return `
            <div class="exam-group-box" style="border:1.5px solid ${theme.borderColor}; background:${theme.bgColor};">
                <div class="exam-box-header" style="color:${theme.color};">
                    <span>${theme.fullLabel}</span>
                    <strong style="font-size:1.15rem;">평균 ${groupAvg.toFixed(2)}점</strong>
                </div>
                <div style="font-size:0.78rem; color:#4B5563; margin-top:0.3rem;">
                    • <strong>최고 합격선 학과:</strong> ${groupTop ? `${groupTop.학과명} (${groupTop.환산점수.toFixed(1)}점)` : '-'}<br>
                    • <strong>시험 내 틈새(가성비) 학과:</strong> ${groupNiche.length ? groupNiche.map(d => `${d.학과명}(${d.환산점수.toFixed(1)}점)`).join(', ') : '없음'}
                </div>
            </div>
        `;
    }).join('');

    const lineMeaning = data[0]?.합격점수라인의미 || '일반 논술 전형';

    container.innerHTML = `
        <div class="univ-insight-card" style="grid-column: 1 / -1;">
            <div class="univ-insight-title">
                <span>🎯 1. 같은 시험 종류별 실질 평균선 비교</span>
                <span class="univ-avg-pill">대학 전체 평균: ${univAvg.toFixed(2)}점</span>
            </div>
            <div class="exam-boxes-grid">
                ${examGroupCards}
            </div>
            <div style="font-size:0.78rem; color:#6B7280; margin-top:0.5rem;">
                💡 <strong>해석 가이드:</strong> 문항 구성과 난이도가 다른 시험 종류(인문1 vs 인문2 vs 자연1 vs 자연2 등)끼리는 점수 척도가 다르므로, 전체 대학 평균보다는 <strong>해당 학과가 치르는 시험 종류의 평균 점수</strong>와 비교해야 합격 유불리를 정확히 판단할 수 있습니다.
            </div>
        </div>

        <div class="univ-insight-card" style="grid-column: 1 / -1;">
            <div class="univ-insight-title">
                <span>💡 2. 출제 라인 특이점 & 지원 전략 가이드</span>
            </div>
            <div class="line-meaning-box">
                <div style="font-weight:700; color:#1E40AF; margin-bottom:0.3rem;">📌 출제 및 채점 특징:</div>
                <div style="font-size:0.85rem; color:#374151; line-height:1.45;">${escapeHtml(lineMeaning)}</div>
            </div>
        </div>
    `;
}

// ═════════════════════════════════════════════════════════════════════════════
//  [MODE A-2: 계열/학과별 검색 모드 - 전국 대학별 해당 학과 합격선 & 최저 비교]
// ═════════════════════════════════════════════════════════════════════════════

function renderDeptSearchBanner(matchedUnivs) {
    const banner = document.getElementById('dept-search-banner');
    if (!banner) return;

    const totalDepts = state.filteredData.length;
    const scores = state.filteredData.map(d => d.환산점수).filter(v => v > 0);
    const avgScore = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : '-';

    const withMin = state.filteredData.filter(d => d.최저여부 === 'Y').map(d => d.환산점수);
    const withoutMin = state.filteredData.filter(d => d.최저여부 === 'N').map(d => d.환산점수);
    const withMinAvg = withMin.length ? (withMin.reduce((a, b) => a + b, 0) / withMin.length).toFixed(1) : '-';
    const withoutMinAvg = withoutMin.length ? (withoutMin.reduce((a, b) => a + b, 0) / withoutMin.length).toFixed(1) : '-';

    const univLabels = state.selectedUnivs.size > 0 
        ? Array.from(state.selectedUnivs).join(', ') 
        : (state.searchQuery || '전국 대학');

    banner.innerHTML = `
        <div class="dept-search-info">
            <div class="dept-search-title">
                <span>🎓 <strong>${matchedUnivs.length}개 대학</strong> (${escapeHtml(univLabels)}) 관련 학과 비교</span>
                <span class="badge-tag" style="background:#FFFFFF; color:#1E40AF; font-size:0.78rem; font-weight:800;">총 ${totalDepts}개 모집단위</span>
            </div>
            <div class="dept-search-stats" style="margin-top:0.35rem; font-size:0.83rem; display:flex; gap:0.6rem; align-items:center; flex-wrap:wrap;">
                <span>선택 대학 평균: <strong>${avgScore}점</strong></span>
                <span style="opacity:0.6;">|</span>
                <span>수능최저 있음(Y) 평균: <strong style="color:#93C5FD;">${withMinAvg}점</strong> (${withMin.length}개)</span>
                <span style="opacity:0.6;">|</span>
                <span>수능최저 없음(N) 평균: <strong style="color:#FCA5A5;">${withoutMinAvg}점</strong> (${withoutMin.length}개)</span>
            </div>
        </div>
        <button class="univ-focus-reset-btn" onclick="clearSearch()" title="전국 대학별 모아보기로 돌아가기">
            ← 🏛️ 전체 대학 모아보기
        </button>
    `;
}

function renderDeptSearchTable() {
    const tbody = document.getElementById('dept-table-body');
    if (!tbody) return;

    const total = state.filteredData.length;
    setText('dept-table-count-badge', `총 ${total.toLocaleString()}건`);

    if (total === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="no-data-msg">🔍 검색 조건에 일치하는 학과가 없습니다.</td></tr>`;
        renderDeptPagination(0);
        return;
    }

    const start = (state.currentPage - 1) * state.itemsPerPage;
    const items = state.filteredData.slice(start, start + state.itemsPerPage);

    tbody.innerHTML = items.map(item => {
        const pct = Math.min(Math.max(item.환산점수, 0), 100);
        const theme = item.examType || getExamTheme(item);

        const cut70Disp = item.cut70 != null ? `${item.cut70.toFixed(2)}` : '-';
        const minCutDisp = item.최저점 != null ? `${item.최저점.toFixed(2)}` : '-';

        let tailBadge = '';
        if (item.cut70 != null && item.최저점 != null) {
            const tailMargin = (item.cut70 - item.최저점).toFixed(1);
            if (parseFloat(tailMargin) > 0) {
                tailBadge = `<span style="display:inline-block; font-size:0.68rem; color:#9D174D; background:#FCE7F3; border:1px solid #FBCFE8; padding:1px 4px; border-radius:3px; font-weight:700;">꼬리 -${tailMargin}점</span>`;
            }
        }

        const minBadge = item.최저여부 === 'Y'
            ? '<span class="badge-min-y">최저 있음</span>'
            : (item.최저여부 === 'N' ? '<span class="badge-min-n">최저 없음</span>' : '<span style="color:#9CA3AF">-</span>');

        let mathBadge = '<span style="color:#9CA3AF; font-size:0.75rem;">-</span>';
        if (item.hasMathData) {
            const passM = item.mathPassMed !== null ? item.mathPassMed.toFixed(1) : (item.mathPassAvg !== null ? item.mathPassAvg.toFixed(1) : '-');
            mathBadge = `<span class="math-pass-dot" onclick="openMathModal(${item._id})" style="cursor:pointer; font-size:0.75rem; font-weight:700;">🟢 ${passM}</span>`;
        }

        return `
            <tr>
                <td style="font-weight:700; color:var(--primary);">
                    <a href="javascript:handleSearch('${escapeHtml(item.대학명)}')" style="color:var(--primary); text-decoration:underline;" title="클릭하여 ${escapeHtml(item.대학명)} 내부 상세분석실로 이동">
                        ${escapeHtml(item.대학명)}
                    </a>
                </td>
                <td><span class="region-badge ${item.지역구분}">${item.지역구분}</span></td>
                <td><span class="field-badge">${escapeHtml(item.계열구분)}</span></td>
                <td style="font-weight:700;">
                    ${escapeHtml(item.학과명)}
                    ${item.메디컬 ? '<span class="tag-medical-pill">의약</span>' : ''}
                    <span class="exam-badge-pill" style="background:${theme.bgColor}; color:${theme.color}; border:1px solid ${theme.borderColor}; font-size:0.68rem; padding:1px 5px; margin-left:3px;">
                        ${theme.label}
                    </span>
                    ${item.시험구분 && item.시험구분 !== '공통' && item.시험구분 !== '시험 1' && item.시험구분 !== '시험 2' ? `
                        <span class="badge-sub-exam" style="display:inline-block; font-size:0.65rem; color:${theme.color}; background:#FFFFFF; border:1px dashed ${theme.borderColor}; padding:0px 4px; border-radius:3px; font-weight:600; margin-left:2px;">
                            🏷️ ${escapeHtml(item.시험구분)}
                        </span>
                    ` : ''}
                </td>
                <td>${minBadge}</td>
                <td>
                    <div class="score-bar-cell">
                        <span class="score-num" style="color:${theme.color};">${item.환산점수.toFixed(2)}</span>
                        <div class="score-bar-bg"><div class="score-bar-fill" style="width:${pct}%; background:${theme.chartBg};"></div></div>
                    </div>
                </td>
                <td style="font-size:0.8rem; font-weight:700; color:#4F46E5;">${cut70Disp}</td>
                <td style="font-size:0.8rem; font-weight:700; color:#C2547A;">${minCutDisp} ${tailBadge}</td>
                <td>${mathBadge}</td>
                <td>
                    <button class="quick-univ-chip" onclick="handleSearch('${escapeHtml(item.대학명)}')" title="${escapeHtml(item.대학명)} 내부 분석실로 이동" style="background:#EFF6FF; border-color:#93C5FD; color:#1E40AF; padding:2px 8px; font-size:0.72rem;">
                        🏢 상세 →
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    renderDeptPagination(total);
}

function renderDeptPagination(totalItems) {
    const container = document.getElementById('dept-pagination-container');
    if (!container) return;
    const totalPages = Math.ceil(totalItems / state.itemsPerPage);
    if (totalPages <= 1) {
        container.innerHTML = `<span class="pagination-info">전체 ${totalItems}건 표시 중</span>`;
        return;
    }
    const startItem = (state.currentPage - 1) * state.itemsPerPage + 1;
    const endItem   = Math.min(state.currentPage * state.itemsPerPage, totalItems);
    let html = `<span class="pagination-info">${startItem}-${endItem} / 총 ${totalItems.toLocaleString()}건</span><div class="pagination-controls">`;
    html += `<button class="page-btn" ${state.currentPage===1?'disabled':''} onclick="goToDeptPage(1)">«</button>`;
    html += `<button class="page-btn" ${state.currentPage===1?'disabled':''} onclick="goToDeptPage(${state.currentPage-1})">‹</button>`;
    let sp = Math.max(1, state.currentPage-2);
    let ep = Math.min(totalPages, sp+4);
    if (ep-sp<4) sp = Math.max(1,ep-4);
    for (let p = sp; p <= ep; p++) {
        html += `<button class="page-btn ${p===state.currentPage?'active':''}" onclick="goToDeptPage(${p})">${p}</button>`;
    }
    html += `<button class="page-btn" ${state.currentPage===totalPages?'disabled':''} onclick="goToDeptPage(${state.currentPage+1})">›</button>`;
    html += `<button class="page-btn" ${state.currentPage===totalPages?'disabled':''} onclick="goToDeptPage(${totalPages})">»</button>`;
    html += '</div>';
    container.innerHTML = html;
}

window.goToDeptPage = function(page) {
    state.currentPage = page;
    renderDeptSearchTable();
    document.getElementById('dept-search-mode-container')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

function updateDeptSearchCharts() {
    updateDeptSearchUnivChart();
    updateDeptSearchMinChart();
}

function updateDeptSearchUnivChart() {
    const ctx = document.getElementById('deptSearchChart')?.getContext('2d');
    if (!ctx) return;

    // 대학별 그룹화하여 평균 환산점수 및 70% Cut 산출
    const univMap = {};
    state.filteredData.forEach(d => {
        if (!univMap[d.대학명]) {
            univMap[d.대학명] = { sum: 0, count: 0, cut70s: [] };
        }
        univMap[d.대학명].sum += d.환산점수;
        univMap[d.대학명].count += 1;
        if (d.cut70 != null) univMap[d.대학명].cut70s.push(d.cut70);
    });

    const stats = Object.entries(univMap).map(([univ, v]) => ({
        univ,
        avg: v.sum / v.count,
        cut70Avg: v.cut70s.length ? (v.cut70s.reduce((a, b) => a + b, 0) / v.cut70s.length) : null,
        count: v.count
    })).sort((a, b) => b.avg - a.avg).slice(0, 16);

    const labels = stats.map(s => `${s.univ} (${s.count}개)`);
    const avgs = stats.map(s => +s.avg.toFixed(2));
    const cut70s = stats.map(s => s.cut70Avg != null ? +s.cut70Avg.toFixed(2) : null);

    if (state.charts.deptSearch) state.charts.deptSearch.destroy();
    state.charts.deptSearch = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: '대학별 평균 환산점수',
                    data: avgs,
                    backgroundColor: 'rgba(30, 64, 175, 0.82)',
                    borderColor: '#1E40AF',
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    label: '70% Cut 평균',
                    data: cut70s,
                    backgroundColor: 'rgba(79, 70, 229, 0.75)',
                    borderColor: '#4F46E5',
                    borderWidth: 1,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: true, position: 'top', labels: { font: { family: 'Pretendard', size: 10 }, padding: 8 } },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y != null ? ctx.parsed.y+'점' : '-'}`
                    }
                }
            },
            scales: {
                y: { min: 0, max: 100, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { family: 'Pretendard', size: 10 } } },
                x: { grid: { display: false }, ticks: { font: { family: 'Pretendard', size: 10, weight: '600' }, maxRotation: 40 } }
            }
        }
    });
}

function updateDeptSearchMinChart() {
    const ctx = document.getElementById('deptMinChart')?.getContext('2d');
    if (!ctx) return;

    const withMin = state.filteredData.filter(d => d.최저여부 === 'Y').map(d => d.환산점수);
    const withoutMin = state.filteredData.filter(d => d.최저여부 === 'N').map(d => d.환산점수);

    const withAvg = withMin.length ? +(withMin.reduce((a,b)=>a+b,0)/withMin.length).toFixed(2) : 0;
    const withoutAvg = withoutMin.length ? +(withoutMin.reduce((a,b)=>a+b,0)/withoutMin.length).toFixed(2) : 0;

    if (state.charts.deptMin) state.charts.deptMin.destroy();
    state.charts.deptMin = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [`최저 있음(Y) (${withMin.length}개)`, `최저 없음(N) (${withoutMin.length}개)`],
            datasets: [{
                label: '평균 100점 환산점수',
                data: [withAvg, withoutAvg],
                backgroundColor: ['rgba(37,99,235,0.85)', 'rgba(220,38,38,0.85)'],
                borderColor: ['#2563EB', '#DC2626'],
                borderWidth: 1,
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => `평균: ${ctx.parsed.y}점`
                    }
                }
            },
            scales: {
                y: { min: 0, max: 100, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { family: 'Pretendard', size: 10 } } },
                x: { grid: { display: false }, ticks: { font: { family: 'Pretendard', size: 11, weight: '700' } } }
            }
        }
    });
}

// ═════════════════════════════════════════════════════════════════════════════
//  [MODE B: 대학 미검색 시 (대학명 중심 분류 뷰)]
// ═════════════════════════════════════════════════════════════════════════════

function renderUnivGroupedView() {
    const container = document.getElementById('univ-grouped-view');
    if (!container) return;

    const univMap = {};
    state.filteredData.forEach(item => {
        if (!univMap[item.대학명]) {
            univMap[item.대학명] = {
                name: item.대학명,
                region: item.지역구분,
                lineMeaning: item.합격점수라인의미,
                minRaw: item.최저여부,
                items: []
            };
        }
        univMap[item.대학명].items.push(item);
    });

    const univList = Object.values(univMap).map(u => {
        // 메디컬 제외 일반 학과 대상 평균 환산점수 계산 (메디컬 전용 대학이면 전체 기준)
        const nonMedItems = u.items.filter(d => !d.메디컬 && d.examType?.key !== '의치한약수');
        const targetItems = nonMedItems.length ? nonMedItems : u.items;
        const scores = targetItems.map(d => d.환산점수).filter(v => v > 0);
        const avgScore = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
        const maxDept = u.items.reduce((p, c) => (p.환산점수 > c.환산점수) ? p : c, u.items[0]);
        const minDept = u.items.reduce((p, c) => (p.환산점수 < c.환산점수) ? p : c, u.items[0]);
        const mathCount = u.items.filter(d => d.hasMathData).length;
        const gap = (maxDept.환산점수 - minDept.환산점수);

        // 대학 내 시험구분별 개수 및 평균
        const examSummary = {};
        u.items.forEach(d => {
            const exKey = d.examType?.label || d.시험구분;
            if (!examSummary[exKey]) examSummary[exKey] = { scores: [], theme: d.examType };
            examSummary[exKey].scores.push(d.환산점수);
        });

        return {
            ...u,
            avgScore,
            maxDept,
            minDept,
            gap,
            mathCount,
            examSummary
        };
    }).sort((a, b) => b.avgScore - a.avgScore);

    if (univList.length === 0) {
        container.innerHTML = `<div class="no-data-msg">🔍 선택하신 조건에 해당하는 대학이 없습니다. 필터를 초기화해 보세요.</div>`;
        return;
    }

    container.innerHTML = univList.map(u => {
        const isExpanded = state.expandedUnivs.has(u.name);

        // 시험 종류별 태그 배지 생성 (7종류 테마 색상)
        const examBadges = Object.entries(u.examSummary).map(([examName, obj]) => {
            const theme = obj.theme || getExamTheme(examName);
            const avg = (obj.scores.reduce((a, b) => a + b, 0) / obj.scores.length).toFixed(1);
            return `
                <span class="exam-summary-chip" style="background:${theme.bgColor}; color:${theme.color}; border:1px solid ${theme.borderColor}; font-size:0.72rem; padding:1px 6px; border-radius:4px; font-weight:700;">
                    ${examName}: <strong>${avg}점</strong> (${obj.scores.length}개)
                </span>
            `;
        }).join(' ');

        const gapFormatted = u.gap.toFixed(1);
        const gapBadgeStyle = u.gap >= 12 
            ? 'background:#FEE2E2; color:#991B1B; border:1px solid #FECACA;' 
            : (u.gap <= 5 
                ? 'background:#EFF6FF; color:#1E40AF; border:1px solid #BFDBFE;' 
                : 'background:#F1F5F9; color:#334155; border:1px solid #CBD5E1;');
        const gapText = u.gap >= 12 
            ? '스펙트럼 넓음 (틈새 공략 유리)' 
            : (u.gap <= 5 ? '점수 밀집 (실수 방지 중요)' : '보통');

        return `
        <div class="univ-group-card">
            <div class="univ-group-header">
                <div class="univ-header-left">
                    <div class="univ-title-line">
                        <span class="univ-name-text">${escapeHtml(u.name)}</span>
                        <span class="region-badge ${u.region}">${u.region}</span>
                        ${u.minRaw === 'Y' ? '<span class="badge-min-y">최저 있음</span>' : '<span class="badge-min-n">최저 없음</span>'}
                        ${u.mathCount > 0 ? '<span class="badge-tag" style="background:#EDE9FE; color:#7C3AED; font-size:0.68rem;">수학표본 '+u.mathCount+'개</span>' : ''}
                    </div>
                    <div class="univ-sub-line" style="margin-top:0.35rem;">
                        <span>포함 학과 <strong>${u.items.length}개</strong></span>
                        <span style="opacity:0.5;">•</span>
                        <span>시험별: ${examBadges}</span>
                    </div>
                </div>

                <div class="univ-header-right">
                    <div class="univ-score-block">
                        <span class="univ-score-label">대학 환산평균(메디컬제외)</span>
                        <span class="univ-score-val">${u.avgScore.toFixed(2)}점</span>
                    </div>
                    <button class="univ-focus-action-btn" onclick="handleSearch('${u.name}')" title="${escapeHtml(u.name)} 내부 학과 및 시험 상세 분석실로 이동">
                        🏢 대학 내부 상세분석 →
                    </button>
                </div>
            </div>

            <div class="univ-quick-stats-bar">
                <div class="stat-cell">
                    <span>📊 최고-최저 격차:</span>
                    <strong style="color:#1E3A8A; font-size:0.9rem;">+${gapFormatted}점</strong>
                    <span class="badge-tag" style="font-size:0.68rem; padding:1px 6px; ${gapBadgeStyle}">${gapText}</span>
                </div>
                <div class="stat-cell">
                    <span>👑 최고:</span>
                    <strong>${escapeHtml(u.maxDept.학과명)} (${u.maxDept.환산점수.toFixed(1)}점)</strong>
                </div>
                <div class="stat-cell">
                    <span>🎯 최저(틈새):</span>
                    <strong>${escapeHtml(u.minDept.학과명)} (${u.minDept.환산점수.toFixed(1)}점)</strong>
                </div>
                <button class="univ-toggle-accordion-btn" onclick="toggleUnivAccordion('${u.name}')">
                    ${isExpanded ? '학과 목록 접기 ▲' : `학과 목록 펼치기 (${u.items.length}개) ▼`}
                </button>
            </div>

            <div class="univ-dept-accordion-body" style="display:${isExpanded ? 'block' : 'none'};">
                <table class="scores-table" style="font-size:0.82rem; margin-top:0.5rem;">
                    <thead>
                        <tr style="background:#F3F4F6;">
                            <th>학과명</th>
                            <th>시험 종류</th>
                            <th>계열</th>
                            <th style="text-align:right;">원점수</th>
                            <th>100점환산</th>
                            <th>70%Cut / 최저선</th>
                            <th>꼬리 마진</th>
                            <th>수능수학 백분위</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${u.items.map(item => {
                            const theme = item.examType || getExamTheme(item);
                            const tailMargin = (item.cut70 != null && item.최저점 != null) ? (item.cut70 - item.최저점).toFixed(1) : null;
                            return `
                            <tr>
                                <td style="font-weight:700;">
                                    ${escapeHtml(item.학과명)}
                                    ${item.메디컬 ? '<span class="tag-medical-pill">의약</span>' : ''}
                                </td>
                                <td>
                                    <span class="exam-badge-pill" style="background:${theme.bgColor}; color:${theme.color}; border:1px solid ${theme.borderColor}; font-size:0.7rem; padding:1px 5px;">
                                        ${theme.label}
                                    </span>
                                </td>
                                <td><span class="field-badge">${escapeHtml(item.계열구분)}</span></td>
                                <td style="text-align:right;">${item.논술점수.toFixed(2)}</td>
                                <td>
                                    <strong style="color:${theme.color};">${item.환산점수.toFixed(2)}점</strong>
                                </td>
                                <td style="font-size:0.75rem;">
                                    ${item.cut70 != null ? `70%: ${item.cut70.toFixed(1)} / ` : ''}
                                    ${item.최저점 != null ? `최저: ${item.최저점.toFixed(1)}` : '-'}
                                </td>
                                <td>
                                    ${tailMargin && parseFloat(tailMargin) > 0 ? `<span style="font-size:0.7rem; color:#9D174D; background:#FCE7F3; border:1px solid #FBCFE8; padding:1px 5px; border-radius:3px; font-weight:700;">-${tailMargin}점</span>` : '<span style="color:#9CA3AF">-</span>'}
                                </td>
                                <td>
                                    ${item.hasMathData ? `<span class="math-pass-dot" onclick="openMathModal(${item._id})" style="cursor:pointer;">🟢 합: ${item.mathPassMed ?? '-'}</span>` : '<span style="color:#9CA3AF">-</span>'}
                                </td>
                            </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        `;
    }).join('');
}

function renderBrowseTable() {
    const tbody = document.getElementById('browse-table-body');
    if (!tbody) return;

    const total = state.filteredData.length;
    setText('browse-table-count-badge', `총 ${total.toLocaleString()}건`);

    if (total === 0) {
        tbody.innerHTML = `<tr><td colspan="11" class="no-data-msg">🔍 선택하신 조건에 해당하는 학과가 없습니다.</td></tr>`;
        return;
    }

    tbody.innerHTML = state.filteredData.map(item => {
        const pct = Math.min(Math.max(item.환산점수, 0), 100);
        const theme = item.examType || getExamTheme(item);
        const cut70Disp = item.cut70 != null ? `${item.cut70.toFixed(2)}` : '-';
        const minCutDisp = item.최저점 != null ? `${item.최저점.toFixed(2)}` : '-';

        return `
            <tr>
                <td style="font-weight:700;">
                    <a href="javascript:handleSearch('${escapeHtml(item.대학명)}')" style="color:var(--primary); text-decoration:underline;" title="클릭하여 ${escapeHtml(item.대학명)} 내부 상세분석실로 이동">
                        ${escapeHtml(item.대학명)}
                    </a>
                </td>
                <td>
                    <div style="display:flex; flex-direction:column; gap:2px; align-items:flex-start;">
                        <span class="exam-badge-pill" style="background:${theme.bgColor}; color:${theme.color}; border:1px solid ${theme.borderColor}; font-size:0.72rem; padding:1px 6px; font-weight:700;">
                            ${theme.label}
                        </span>
                        ${item.시험구분 && item.시험구분 !== '공통' && item.시험구분 !== '시험 1' && item.시험구분 !== '시험 2' ? `
                            <span class="badge-sub-exam" style="display:inline-block; font-size:0.65rem; color:${theme.color}; background:#FFFFFF; border:1px dashed ${theme.borderColor}; padding:0px 4px; border-radius:3px; font-weight:600;" title="대학별 고유 시험지 구분">
                                🏷️ ${escapeHtml(item.시험구분)}
                            </span>
                        ` : ''}
                    </div>
                </td>
                <td><span class="region-badge ${item.지역구분}">${item.지역구분}</span></td>
                <td><span class="field-badge">${escapeHtml(item.계열구분)}</span></td>
                <td style="font-weight:700;">
                    ${escapeHtml(item.학과명)}
                    ${item.메디컬 ? '<span class="tag-medical-pill">의약</span>' : ''}
                </td>
                <td>${item.최저여부 === 'Y' ? '<span class="badge-min-y">Y</span>' : '<span class="badge-min-n">N</span>'}</td>
                <td style="text-align:right;">${item.논술점수.toFixed(2)}</td>
                <td>
                    <div class="score-bar-cell">
                        <span class="score-num" style="color:${theme.color};">${item.환산점수.toFixed(2)}</span>
                        <div class="score-bar-bg"><div class="score-bar-fill" style="width:${pct}%; background:${theme.chartBg};"></div></div>
                    </div>
                </td>
                <td style="font-size:0.75rem;">70%: ${cut70Disp} / 최저: ${minCutDisp}</td>
                <td>${item.hasMathData ? `<span class="math-pass-dot" onclick="openMathModal(${item._id})" style="cursor:pointer;">🟢 ${item.mathPassMed ?? '-'}</span>` : '-'}</td>
                <td><div class="line-meaning-cell">${escapeHtml(item.합격점수라인의미)}</div></td>
            </tr>
        `;
    }).join('');
}

function updateBrowseCharts() {
    updateUnivChart();
    updateFieldDistChart();
    updateExamDistChart();
    updateMinCompChart();
    updateMathComparisonChart();
}

function updateUnivChart() {
    const ctx = document.getElementById('univChart')?.getContext('2d');
    if (!ctx) return;

    const univMap = {};
    state.filteredData.forEach(item => {
        if (!univMap[item.대학명]) univMap[item.대학명] = { sum: 0, count: 0, cut70s: [] };
        univMap[item.대학명].sum += item.환산점수;
        univMap[item.대학명].count += 1;
        if (item.cut70 != null) univMap[item.대학명].cut70s.push(item.cut70);
    });

    const stats = Object.entries(univMap).map(([name, v]) => ({
        name,
        avg: v.sum / v.count,
        cut70avg: v.cut70s.length ? v.cut70s.reduce((a,b)=>a+b,0)/v.cut70s.length : null,
        count: v.count
    })).sort((a,b) => b.avg - a.avg).slice(0, 15);

    if (state.charts.univ) state.charts.univ.destroy();
    state.charts.univ = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: stats.map(s => s.name),
            datasets: [
                { label: '평균 합격선', data: stats.map(s => +s.avg.toFixed(2)), backgroundColor: 'rgba(15,90,67,0.82)', borderColor: '#0F5A43', borderWidth: 1, borderRadius: 5 },
                { label: '70% Cut 평균', data: stats.map(s => s.cut70avg != null ? +s.cut70avg.toFixed(2) : null), backgroundColor: 'rgba(79,70,229,0.75)', borderColor: '#4F46E5', borderWidth: 1, borderRadius: 5 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true, position: 'top', labels: { font: { family: 'Pretendard', size: 10 }, padding: 8 } } },
            scales: {
                y: { min: 0, max: 100, ticks: { font: { family: 'Pretendard', size: 10 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
                x: { grid: { display: false }, ticks: { font: { family: 'Pretendard', size: 10, weight: '600' }, maxRotation: 40 } }
            }
        }
    });
}

function updateFieldDistChart() {
    const ctx = document.getElementById('fieldChart')?.getContext('2d');
    if (!ctx) return;

    const groups = {};
    state.filteredData.forEach(item => {
        const key = item.계열분류;
        const field = item.계열구분;
        if (!groups[field]) groups[field] = { 인문: [], '자연/이공': [] };
        if (groups[field][key]) groups[field][key].push(item.환산점수);
    });

    const fieldNames = Object.keys(groups).sort();
    const humAvgs = fieldNames.map(f => groups[f]['인문'].length ? avg(groups[f]['인문']) : null);
    const sciAvgs = fieldNames.map(f => groups[f]['자연/이공'].length ? avg(groups[f]['자연/이공']) : null);

    if (state.charts.field) state.charts.field.destroy();
    state.charts.field = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: fieldNames,
            datasets: [
                { label: '인문계 시험 평균', data: humAvgs, backgroundColor: 'rgba(217, 119, 6, 0.82)', borderColor: '#D97706', borderWidth: 1, borderRadius: 4 },
                { label: '자연계 시험 평균', data: sciAvgs, backgroundColor: 'rgba(37, 99, 235, 0.82)', borderColor: '#2563EB', borderWidth: 1, borderRadius: 4 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true, position: 'top', labels: { font: { family: 'Pretendard', size: 10 }, padding: 8 } } },
            scales: {
                y: { min: 0, max: 100, ticks: { font: { family: 'Pretendard', size: 10 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
                x: { grid: { display: false }, ticks: { font: { family: 'Pretendard', size: 10 }, maxRotation: 40 } }
            }
        }
    });
}

function updateExamDistChart() {
    const ctx = document.getElementById('examDistChart')?.getContext('2d');
    if (!ctx) return;

    const examGroups = {};
    state.filteredData.forEach(item => {
        const k = item.계열분류;
        if (!examGroups[k]) examGroups[k] = { scores: [], cut70s: [] };
        examGroups[k].scores.push(item.환산점수);
        if (item.cut70 != null) examGroups[k].cut70s.push(item.cut70);
    });

    const labels = ['인문', '자연/이공', '기타'].filter(k => examGroups[k]?.scores?.length);
    const scoreStats = labels.map(k => calcStats(examGroups[k].scores));
    const cut70Stats = labels.map(k => calcStats(examGroups[k].cut70s));

    if (state.charts.examDist) state.charts.examDist.destroy();
    state.charts.examDist = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: '평균 합격선', data: scoreStats.map(s => s ? +s.mean.toFixed(2) : null), backgroundColor: 'rgba(15,90,67,0.8)', borderColor: '#0F5A43', borderWidth: 2, borderRadius: 5 },
                { label: '70% Cut 평균', data: cut70Stats.map(s => s ? +s.mean.toFixed(2) : null), backgroundColor: 'rgba(79,70,229,0.75)', borderColor: '#4F46E5', borderWidth: 2, borderRadius: 5 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true, position: 'top', labels: { font: { family: 'Pretendard', size: 10 } } } },
            scales: {
                y: { min: 0, max: 100, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { family: 'Pretendard', size: 10 } } },
                x: { grid: { display: false }, ticks: { font: { family: 'Pretendard', size: 11, weight: '700' } } }
            }
        }
    });

    updateDistStatCards(labels, scoreStats, cut70Stats);
}

function updateDistStatCards(labels, scoreStats, cut70Stats) {
    const container = document.getElementById('dist-stat-cards');
    if (!container) return;

    container.innerHTML = labels.map((label, i) => {
        const s = scoreStats[i];
        const c = cut70Stats[i];
        if (!s) return '';

        const isHum = label === '인문';
        const color = isHum ? '#D97706' : (label === '자연/이공' ? '#2563EB' : '#6B7280');
        const bg    = isHum ? '#FEF3C7' : (label === '자연/이공' ? '#EFF6FF' : '#F3F4F6');

        return `
        <div class="dist-stat-card" style="border-left:4px solid ${color}; background:${bg};">
            <div class="dist-stat-header" style="color:${color};">
                <span>${isHum ? '📖 시험 1 (인문)' : (label === '자연/이공' ? '🔬 시험 2 (자연/이공)' : '📋 기타 시험')} 통계</span>
                <span class="dist-stat-n">n = ${s.n}</span>
            </div>
            <div class="dist-stat-grid">
                <div class="dist-stat-item"><div class="dist-stat-label">평균 합격선</div><div class="dist-stat-value" style="color:${color};">${s.mean.toFixed(2)}점</div></div>
                <div class="dist-stat-item"><div class="dist-stat-label">중앙값</div><div class="dist-stat-value">${s.median.toFixed(2)}점</div></div>
                <div class="dist-stat-item"><div class="dist-stat-label">표준편차 (σ)</div><div class="dist-stat-value">${s.std.toFixed(2)}</div></div>
                <div class="dist-stat-item"><div class="dist-stat-label">70% Cut 평균</div><div class="dist-stat-value" style="color:#4F46E5;">${c ? c.mean.toFixed(2)+'점' : '-'}</div></div>
                <div class="dist-stat-item"><div class="dist-stat-label">최저/최고</div><div class="dist-stat-value">${s.min.toFixed(1)} / ${s.max.toFixed(1)}</div></div>
                <div class="dist-stat-item"><div class="dist-stat-label">Q1 / Q3</div><div class="dist-stat-value">${s.q1.toFixed(1)} / ${s.q3.toFixed(1)}</div></div>
            </div>
        </div>`;
    }).join('');
}

function updateMinCompChart() {
    const ctx = document.getElementById('minCompChart')?.getContext('2d');
    if (!ctx) return;

    const withMin = state.filteredData.filter(d => d.최저여부 === 'Y').map(d => d.환산점수);
    const withoutMin = state.filteredData.filter(d => d.최저여부 === 'N').map(d => d.환산점수);

    if (state.charts.minComp) state.charts.minComp.destroy();
    state.charts.minComp = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['수능최저 있음 (Y)', '수능최저 없음 (N)'],
            datasets: [{
                label: '평균 100점 환산점수',
                data: [avg(withMin), avg(withoutMin)],
                backgroundColor: ['rgba(37,99,235,0.8)', 'rgba(220,38,38,0.8)'],
                borderColor: ['#2563EB', '#DC2626'],
                borderWidth: 1,
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { min: 0, max: 100, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { family: 'Pretendard', size: 10 } } },
                x: { grid: { display: false }, ticks: { font: { family: 'Pretendard', size: 11, weight: '700' } } }
            }
        }
    });
}

function updateMathComparisonChart() {
    const ctx = document.getElementById('mathComparisonChart')?.getContext('2d');
    if (!ctx) return;

    const sampleItems = state.filteredData
        .filter(d => d.hasMathData && d.mathPassMed !== null && d.mathFailMed !== null)
        .slice(0, 15);

    const noteEl = document.getElementById('math-insight-note');

    if (sampleItems.length === 0) {
        if (state.charts.mathComp) state.charts.mathComp.destroy();
        if (noteEl) noteEl.innerHTML = `<span style="color:#6B7280; font-size:0.85rem;">선택된 조건 내 수능 수학 합/불 표본이 없습니다.</span>`;
        return;
    }

    const labels = sampleItems.map(d => `${d.대학명} ${d.학과명.length > 7 ? d.학과명.slice(0,6)+'..' : d.학과명}`);
    const passMedians = sampleItems.map(d => d.mathPassMed);
    const failMedians = sampleItems.map(d => d.mathFailMed);

    const diffs = sampleItems.map(d => d.mathPassMed - d.mathFailMed);
    const avgDiff = (diffs.reduce((a, b) => a + b, 0) / diffs.length).toFixed(1);

    if (noteEl) {
        noteEl.innerHTML = `
            <div class="math-insight-content">
                <strong>💡 수능 수학 백분위 실측 인사이트:</strong> 
                합격자의 수능 수학 백분위 중앙값은 불합격자 대비 평균 
                <span class="highlight-badge">+${avgDiff}%p</span> 높게 형성됩니다. 
                수리논술 합격을 위해서는 최소 <strong>백분위 80~88선</strong>의 수학 연산력이 탄탄한 베이스가 됩니다.
            </div>
        `;
    }

    if (state.charts.mathComp) state.charts.mathComp.destroy();
    state.charts.mathComp = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: '합격자 수학 중앙값', data: passMedians, backgroundColor: 'rgba(5,150,105,0.85)', borderColor: '#059669', borderWidth: 1, borderRadius: 4 },
                { label: '불합격자 수학 중앙값', data: failMedians, backgroundColor: 'rgba(220,38,38,0.75)', borderColor: '#DC2626', borderWidth: 1, borderRadius: 4 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true, position: 'top', labels: { font: { family: 'Pretendard', size: 10 } } } },
            scales: {
                y: { min: 50, max: 100, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { family: 'Pretendard', size: 10 } } },
                x: { grid: { display: false }, ticks: { font: { family: 'Pretendard', size: 10, weight: '600' }, maxRotation: 40 } }
            }
        }
    });
}

// ── 모달 창 ───────────────────────────────────────────────────────────────────
window.openMathModal = function(id) {
    const item = state.allData.find(d => d._id === id);
    if (!item) return;

    const modal = document.getElementById('math-detail-modal');
    const titleEl = document.getElementById('modal-dept-title');
    const bodyEl = document.getElementById('modal-body-content');
    if (!modal || !bodyEl) return;

    if (titleEl) {
        titleEl.innerHTML = `🔬 ${escapeHtml(item.대학명)} ${escapeHtml(item.학과명)} <span style="font-size:0.8rem; font-weight:normal; color:#6B7280;">수능 수학 실측 백분위 (${item.시험구분})</span>`;
    }

    const passMed = item.mathPassMed ?? '-';
    const passAvg = item.mathPassAvg ? item.mathPassAvg.toFixed(1) : '-';
    const passMode = item.mathPassMode ?? '-';
    const passN = item.mathPassCount ? `${item.mathPassCount}명` : '-';

    const failMed = item.mathFailMed ?? '-';
    const failAvg = item.mathFailAvg ? item.mathFailAvg.toFixed(1) : '-';
    const failMode = item.mathFailMode ?? '-';
    const failN = item.mathFailCount ? `${item.mathFailCount}명` : '-';

    const diff = (item.mathPassMed && item.mathFailMed)
        ? `+${(item.mathPassMed - item.mathFailMed).toFixed(1)}%p`
        : '-';

    bodyEl.innerHTML = `
        <div class="modal-stat-grid">
            <div class="modal-stat-box pass-box">
                <div class="modal-box-title">🟢 최종 합격자 표본 (${passN})</div>
                <div class="modal-row"><span>중앙값 (Median)</span><strong>${passMed}</strong></div>
                <div class="modal-row"><span>평균 (Mean)</span><strong>${passAvg}</strong></div>
                <div class="modal-row"><span>최빈값 (Mode)</span><strong>${passMode}</strong></div>
            </div>
            <div class="modal-stat-box fail-box">
                <div class="modal-box-title">🔴 불합격자 표본 (${failN})</div>
                <div class="modal-row"><span>중앙값 (Median)</span><strong>${failMed}</strong></div>
                <div class="modal-row"><span>평균 (Mean)</span><strong>${failAvg}</strong></div>
                <div class="modal-row"><span>최빈값 (Mode)</span><strong>${failMode}</strong></div>
            </div>
        </div>
        <div class="modal-summary-box">
            <span>🎯 합격-불합격 중앙값 격차:</span> 
            <strong style="color:#059669; font-size:1.15rem;">${diff}</strong>
            <p style="margin-top:0.4rem; font-size:0.8rem; color:#4B5563;">
                • <strong>시험구분:</strong> ${item.시험구분} (${item.계열분류})<br>
                ${item.합격점수라인의미 ? `• <strong>출제 라인 성격:</strong> ${escapeHtml(item.합격점수라인의미)}` : ''}
            </p>
        </div>
    `;

    modal.style.display = 'flex';
};

window.closeMathModal = function(e) {
    if (e && e.target !== e.currentTarget) return;
    const modal = document.getElementById('math-detail-modal');
    if (modal) modal.style.display = 'none';
};

// ── 설명서(합격선 코멘트) 열기/닫기 토글 ──────────────────────────────────────────
window.toggleStrategyGuide = function() {
    state.strategyGuideOpen = !state.strategyGuideOpen;
    const guideCard = document.getElementById('strategy-guide-card');
    const dockGuideBtn = document.getElementById('dock-guide-btn');
    const headerBtn = document.getElementById('strategy-toggle-btn');

    if (guideCard) {
        guideCard.style.display = state.strategyGuideOpen ? 'block' : 'none';
        if (state.strategyGuideOpen) {
            guideCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    if (dockGuideBtn) {
        if (state.strategyGuideOpen) {
            dockGuideBtn.classList.add('active');
        } else {
            dockGuideBtn.classList.remove('active');
        }
    }

    if (headerBtn) {
        headerBtn.innerHTML = state.strategyGuideOpen 
            ? '💡 합격선 데이터 해석 코멘트 ▲' 
            : '💡 합격선 데이터 해석 코멘트 ▼';
    }
};

// ── 통계 & 이스케이프 유틸 ────────────────────────────────────────────────────
function calcStats(arr) {
    if (!arr || !arr.length) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const n = sorted.length;
    const mean = arr.reduce((s, v) => s + v, 0) / n;
    const median = n % 2 === 0 ? (sorted[n/2-1]+sorted[n/2])/2 : sorted[Math.floor(n/2)];
    const variance = arr.reduce((s, v) => s + (v-mean)**2, 0) / n;
    const std = Math.sqrt(variance);
    const q1 = sorted[Math.floor(n*0.25)];
    const q3 = sorted[Math.floor(n*0.75)];
    const iqr = q3 - q1;
    const outliers = sorted.filter(v => v < q1 - 1.5*iqr || v > q3 + 1.5*iqr);
    return { mean, median, std, q1, q3, min: sorted[0], max: sorted[n-1], outliers, n };
}

function avg(arr) {
    return arr.length ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : null;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', initApp);
