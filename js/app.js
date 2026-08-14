(function () {
	'use strict';

	var CFG = window.LP_CONFIG || {};
	var STORAGE_KEY = 'lp_leads';

	var $ = function (sel) { return document.querySelector(sel); };
	var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

	var els = {
		form: $('#leadForm'),
		name: $('#g_name'),
		tel2: $('#g_tel_2'),
		tel3: $('#g_tel_3'),
		age: $('#g_age'),
		gender: $('#g_gender'),
		memberCd: $('#g_member_cd'),
		agreeRequired: $('#agree_required'),
		agreeMarketing: $('#agree_marketing'),
		submitBtn: $('#submitBtn'),
		apply: $('#apply'),
	};

	var isSubmitting = false;

	/* =========================================================
	 * 입력 필터
	 * ======================================================= */

	// 숫자 외 제거
	function digitsOnly(el) {
		el.addEventListener('input', function () {
			var cleaned = el.value.replace(/[^0-9]/g, '');
			if (cleaned !== el.value) el.value = cleaned;
		});
	}
	digitsOnly(els.tel2);
	digitsOnly(els.tel3);
	digitsOnly(els.age);

	// 앞자리 4개 채우면 뒷자리로 자동 이동
	els.tel2.addEventListener('input', function () {
		if (els.tel2.value.length === 4) els.tel3.focus();
	});

	/* =========================================================
	 * 성별 토글
	 * ======================================================= */
	$$('.gender-btn').forEach(function (btn) {
		btn.addEventListener('click', function () {
			$$('.gender-btn').forEach(function (b) { b.classList.remove('active'); });
			btn.classList.add('active');
			els.gender.value = btn.dataset.gender;
		});
	});

	/* =========================================================
	 * 값 정규화 — 원본 페이지의 보정 로직을 그대로 옮김
	 * ======================================================= */

	// 국가번호(+82, 8210) 붙거나 010 이 중복 입력돼도 8자리로 정리
	function normalizePhone(tel1, tel2, tel3) {
		var full = (tel1 + tel2 + tel3).replace(/[^0-9]/g, '');

		if (full.indexOf('8210') === 0) full = full.substring(4);
		else if (full.indexOf('82') === 0) full = full.substring(2);

		while (full.indexOf('010') === 0) full = full.substring(3);

		if (full.length !== 8) return null;
		return '010-' + full.substring(0, 4) + '-' + full.substring(4, 8);
	}

	// 6자리(YYMMDD) 입력 시 세기 자동 보정 후 유효성 검사
	function normalizeBirth(raw) {
		var v = String(raw).replace(/[^0-9]/g, '');

		if (v.length === 6) {
			var yy = parseInt(v.substring(0, 2), 10);
			// 올해 두 자리(26)보다 크면 1900년대로 간주
			v = (yy > 26 ? '19' : '20') + v;
		}

		if (v.length !== 8) return null;
		if (v.indexOf('19') !== 0 && v.indexOf('20') !== 0) return null;

		var mm = parseInt(v.substring(4, 6), 10);
		var dd = parseInt(v.substring(6, 8), 10);
		if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return { invalidDate: true };

		return v;
	}

	/* =========================================================
	 * 검증
	 * ======================================================= */
	function validate() {
		if (!els.name.value.trim()) {
			alert('이름을 입력하십시오.');
			els.name.focus();
			return null;
		}
		if (!els.tel2.value) {
			alert('전화번호를 입력하십시오.');
			els.tel2.focus();
			return null;
		}
		if (!els.tel3.value) {
			alert('전화번호를 입력하십시오.');
			els.tel3.focus();
			return null;
		}
		if (!els.age.value) {
			alert('생년월일을 입력하십시오.');
			els.age.focus();
			return null;
		}

		var cellphone = normalizePhone('010', els.tel2.value, els.tel3.value);
		if (!cellphone) {
			alert('전화번호 8자리를 정확히 입력해주세요.');
			els.tel2.focus();
			return null;
		}

		var birth = normalizeBirth(els.age.value);
		if (!birth) {
			alert('생년월일 8자리를 정확히 입력해주세요. (19xx 또는 20xx 시작)');
			els.age.focus();
			return null;
		}
		if (birth.invalidDate) {
			alert('올바른 생년월일 형식이 아닙니다. 월(01~12)과 일(01~31)을 확인해주세요.');
			els.age.focus();
			return null;
		}

		if (!els.gender.value) {
			alert('성별을 선택해 주십시오.');
			return null;
		}
		if (!els.agreeRequired.checked) {
			alert('필수 동의란에 동의해 주십시오');
			els.agreeRequired.focus();
			return null;
		}

		return {
			g_name: els.name.value.trim(),
			cellphone: cellphone,
			g_age: birth,
			g_gender: els.gender.value,
			g_member_cd: els.memberCd.value,
			g_agr_yn: els.agreeMarketing.checked ? '예' : '아니오',
			g_url_gubun: getParam('urlGubun'),
			utm_source: getParam('utm_source'),
			utm_medium: getParam('utm_medium'),
			utm_campaign: getParam('utm_campaign'),
			utm_content: getParam('utm_content'),
			utm_term: getParam('utm_term'),
			product: (CFG.campaign && CFG.campaign.product) || '',
			adv_idx: (CFG.campaign && CFG.campaign.advIdx) || '',
			c_idx: (CFG.campaign && CFG.campaign.cIdx) || '',
			g_referer: document.referrer || '',
			g_usr_agent: navigator.userAgent,
			created_at: new Date().toISOString(),
		};
	}

	function getParam(key) {
		return new URLSearchParams(location.search).get(key) || '';
	}

	/* =========================================================
	 * 전송
	 * ======================================================= */

	// endpoint 가 없으면 localStorage 에 쌓는 mock 으로 동작
	function saveLocal(payload) {
		var list = [];
		try { list = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch (e) { list = []; }

		if (CFG.blockDuplicate && list.some(function (r) { return r.cellphone === payload.cellphone; })) {
			return { duplicate: true };
		}

		list.push(payload);
		localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
		console.log('[LP] 저장된 DB (mock)', payload);
		console.log('[LP] 누적 건수:', list.length);
		return { ok: true };
	}

	function send(payload) {
		if (!CFG.endpoint) {
			return Promise.resolve(saveLocal(payload));
		}
		return fetch(CFG.endpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		}).then(function (res) { return res.json(); });
	}

	// 광고 매체 전환 이벤트 — 픽셀 스니펫을 index.html 에 붙이면 자동으로 호출됨
	function fireConversion(payload) {
		try {
			if (typeof gtag === 'function') {
				gtag('event', 'generate_lead', { product: payload.product });
			}
			if (typeof fbq === 'function') {
				fbq('track', 'Lead');
			}
			if (typeof ttq !== 'undefined' && ttq.track) {
				ttq.track('SubmitForm');
			}
			if (window.karrotPixel) {
				window.karrotPixel.track('CompleteRegistration');
			}
		} catch (e) {
			console.warn('[LP] 전환 이벤트 실패', e);
		}
	}

	function showDone(payload) {
		var done = document.createElement('div');
		done.className = 'done';
		done.innerHTML =
			'<strong>신청이 완료되었습니다</strong>' +
			'<p>' + payload.g_name + '님, 입력하신 번호(' + payload.cellphone + ')로<br>' +
			'전문 설계사가 곧 연락드립니다.</p>';
		els.apply.replaceWith(done);
		done.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	function submit() {
		if (isSubmitting) return;

		var payload = validate();
		if (!payload) return;

		isSubmitting = true;
		els.submitBtn.classList.add('is-loading');

		send(payload)
			.then(function (res) {
				if (res && res.duplicate) {
					alert('이미 등록된 연락처가 존재합니다');
					els.tel2.value = '';
					els.tel3.value = '';
					els.tel2.focus();
					return;
				}

				alert('신청이 완료되었습니다');
				fireConversion(payload);

				if (CFG.thanksUrl) location.href = CFG.thanksUrl;
				else showDone(payload);
			})
			.catch(function (err) {
				console.error('[LP] 전송 실패', err);
				alert('일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
			})
			.finally(function () {
				isSubmitting = false;
				els.submitBtn.classList.remove('is-loading');
			});
	}

	els.submitBtn.addEventListener('click', submit);
	els.form.addEventListener('submit', function (e) {
		e.preventDefault();
		submit();
	});

	/* =========================================================
	 * 약관 팝업
	 * ======================================================= */
	var TERMS = {
		privacy: {
			title: '개인정보 제3자 제공 동의 (필수)',
			body:
				'<h3>1. 제공받는 자</h3><p>제휴 보험대리점 및 보험회사 (상담 배정된 설계사 소속사)</p>' +
				'<h3>2. 제공 목적</h3><p>보험 상품 비교견적 안내, 보장분석 및 가입 상담</p>' +
				'<h3>3. 제공 항목</h3><p>성명, 연락처, 생년월일, 성별, 신청인과의 관계</p>' +
				'<h3>4. 보유 및 이용 기간</h3><p>상담 완료 후 3개월 (관계 법령에 따른 보존 의무가 있는 경우 해당 기간까지)</p>' +
				'<h3>5. 동의 거부 권리</h3><p>동의를 거부하실 수 있으나, 이 경우 비교견적 서비스 이용이 제한됩니다.</p>',
		},
		marketing: {
			title: '광고성 정보수신 동의 (선택)',
			body:
				'<h3>1. 목적</h3><p>신규 상품·이벤트·혜택 안내</p>' +
				'<h3>2. 수신 방법</h3><p>전화, 문자메시지(SMS/MMS), 알림톡, 이메일</p>' +
				'<h3>3. 보유 및 이용 기간</h3><p>동의 철회 시까지</p>' +
				'<h3>4. 동의 거부 권리</h3><p>동의를 거부하셔도 비교견적 서비스는 정상 이용 가능합니다.</p>',
		},
	};

	var modal = $('#termsModal');
	var backdrop = $('#modalBackdrop');
	var currentTerms = null;

	function openTerms(key) {
		currentTerms = key;
		$('#termsTitle').textContent = TERMS[key].title;
		$('#termsBody').innerHTML = TERMS[key].body;
		modal.classList.add('is-open');
		backdrop.classList.add('is-open');
	}

	function closeTerms() {
		modal.classList.remove('is-open');
		backdrop.classList.remove('is-open');
	}

	$$('.view-terms').forEach(function (a) {
		a.addEventListener('click', function () { openTerms(a.dataset.terms); });
	});
	$('.modal-close').addEventListener('click', closeTerms);
	backdrop.addEventListener('click', closeTerms);
	$('.modal-agree').addEventListener('click', function () {
		if (currentTerms === 'privacy') els.agreeRequired.checked = true;
		if (currentTerms === 'marketing') els.agreeMarketing.checked = true;
		closeTerms();
	});

	/* =========================================================
	 * 하단 고정 CTA — 스크롤 500px 이후 노출, 폼 도달 시 숨김
	 * ======================================================= */
	var cta = $('#stickyCta');
	window.addEventListener('scroll', function () {
		var formTop = els.apply.getBoundingClientRect().top;
		var show = window.scrollY > 500 && formTop > window.innerHeight;
		cta.classList.toggle('is-visible', show);
	}, { passive: true });

	cta.querySelector('button').addEventListener('click', function () {
		els.apply.scrollIntoView({ behavior: 'smooth', block: 'start' });
		setTimeout(function () { els.name.focus(); }, 400);
	});

})();
