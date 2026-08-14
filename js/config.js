/**
 * 캠페인/전송 설정
 * 랜딩 페이지를 복제해서 캠페인을 늘릴 때 이 파일만 바꾸면 되도록 분리해 둠.
 */
window.LP_CONFIG = {
	// DB 저장 API. null 이면 실제 전송 없이 localStorage 에만 쌓임(개발용 mock).
	// 예: '/api/leads'
	endpoint: null,

	// 캠페인 식별자 — DB 테이블에 같이 저장할 값
	campaign: {
		product: 'cancer',      // 상품 구분 (암보험)
		advIdx: '',             // 광고주 idx
		cIdx: '',               // 캠페인 idx
	},

	// 같은 번호 재신청 차단 (서버 붙이기 전 브라우저 단 임시 차단)
	blockDuplicate: true,

	// 제출 후 이동할 URL. null 이면 페이지 내 완료 화면으로 전환.
	thanksUrl: null,
};
