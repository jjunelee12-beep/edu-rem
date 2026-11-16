import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

type Tab = "guide" | "service" | "reviews" | "developer";
const tabs: { key: Tab; title: string }[] = [
  { key: "guide", title: "취득가이드" },
  { key: "service", title: "교육원 서비스" },
  { key: "reviews", title: "이용후기" },
];
const guideSections = [
  { title: "사회복지사 2급 취득 과정", body: "사회복지사 2급은 필요한 교과목을 이수하고, 사회복지현장실습과 학점인정 등 행정절차를 거친 뒤 자격증을 신청하는 과정입니다. 최종학력과 기존 이수학점에 따라 필요한 과정이 달라집니다." },
  { title: "자격증 신청 예상일", body: "수업 종료일과 자격증 신청 가능일은 다릅니다. 마지막 수업과 실습 종료, 학점인정, 필요한 학위 취득 및 협회 신청 시기를 모두 고려해야 합니다. 정확한 일정은 개인별 학습계획과 공식 신청 일정에 따라 확인하세요." },
  { title: "이론수업 안내", body: "일반적인 신규 취득 기준으로 총 17과목(필수 10과목, 선택 7과목)이 필요하며, 이 중 1과목은 사회복지현장실습입니다. 나머지 이론과목은 교육기관의 출석·평가 기준에 따라 온라인으로 수강할 수 있습니다. 학점은행제의 학기·연간 이수학점 제한도 확인해야 합니다." },
  { title: "사회복지현장실습", body: "사회복지현장실습은 현장 실습 160시간과 교육기관에서 정한 세미나 등 이수요건을 충족해야 합니다. 실습기관과 실습 교육기관의 일정이 맞아야 하며, 기관별 선이수 조건과 자격요건을 미리 확인해야 합니다." },
  { title: "행정절차 안내", body: "학습자등록과 학점인정신청은 정해진 접수기간에 진행합니다. 고등학교 졸업 후 학위도 취득하는 경우 학위신청까지 확인해야 합니다. 교육원에서 수업을 관리한다고 모든 신청이 자동으로 완료되는 것은 아니므로 직접 신청하거나 기관의 지원 여부를 확인하세요." },
  { title: "자격증 신청 방법", body: "모든 이수요건을 충족한 후 한국사회복지사협회 자격관리 절차에 따라 별도로 신청합니다. 신청 가능 시점과 실제 자격증 발급일은 다를 수 있습니다." },
];

function QualificationEstimate() {
  const [startDate] = useState(() => {
    const now = new Date();

    const koreaDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);

    return koreaDate;
  });

const isValidStartDate = (() => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return false;

  const [year, month, day] = startDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
})();

  const { data, isLoading, isError, isFetching } =
  trpc.socialWorkerGuide.getCalculationBasis.useQuery(
    { startDate },
    {
      enabled: isValidStartDate,
      refetchOnWindowFocus: false,
    }
  );

const currentData =
  isValidStartDate && data?.startDate === startDate
    ? data
    : null;

  return (
    <section className="swg-section" id="qualification-estimate">
      <span className="swg-eyebrow">자격증 신청 예상시기</span>
      <h2>오늘 시작하면 자격증은 언제 신청할 수 있을까요?</h2>


{isValidStartDate && (isLoading || isFetching) && (
  <p>예상 일정을 계산하고 있습니다.</p>
)}

{isError && (
  <p className="swg-note">
    예상 일정을 불러오지 못했습니다.
    잠시 후 다시 확인해 주세요.
  </p>
)}

{currentData && !isFetching && !isError && (
        <>
          <p>
            <strong>{currentData.semesterLabel} 기준</strong>
            {" · "}
            계산 기준일: {currentData.startDate}
          </p>

          <div className="swg-estimate-grid">
            {currentData.educationGroups.map((group) => (
              <article className="swg-estimate-card" key={group.key}>
                <h3>{group.label}</h3>

                <p>
                  {group.semesterCount === null
                    ? "학습기간 확인 필요"
                    : `최단 ${group.semesterCount}학기`}
                </p>

                <strong className="swg-estimate-date">
                  {group.expectedApplicationYear !== null &&
                  group.expectedApplicationMonth !== null
                    ? `${group.expectedApplicationYear}년 ${group.expectedApplicationMonth}월`
                    : "일정 확인 필요"}
                </strong>

                <small>자격증 신청 예상시기</small>

                <p className="swg-note">
                  {group.requiresDegree
                    ? "전문학사 학위 취득 절차 포함"
                    : "기존 학위 보유자 기준"}
                </p>
              </article>
            ))}
          </div>

          <p className="swg-note">{currentData.notice}</p>

          {!currentData.verifiedBySharedEngine && (
  <p className="swg-note">
    ※ 일부 학력의 예상 일정을 계산하지 못했습니다.
    과목 구성과 학위요건을 확인한 뒤 안내드리겠습니다.
  </p>
)}
        </>
      )}
    </section>
  );
}

function ImageSlot({ src, label }: { src: string; label: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return <div className="swg-image">{!failed ? <img src={src} alt={label} loading="lazy" onError={() => setFailed(true)} /> : <div className="swg-placeholder"><strong>사진 추가 예정</strong><span>{label}</span><small>{src}</small></div>}</div>;
}
export default function SocialWorkerGuide() {
  const [tab, setTab] = useState<Tab>("guide");
  const changeTab = (next: Tab) => { setTab(next); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  return <div className="swg-root"><style>{styles}</style>
    <header className="swg-header"><span>사회복지사 2급</span></header>
    <div className="swg-shell">
      <div className="swg-cover">
  {tab === "guide" ? (
    <img
      src="/images/social-worker-guide-banner.png"
      alt="사회복지사 2급 취득가이드"
    />
  ) : tab === "service" ? (
    <img
      src="/images/service-main-banner.png"
      alt="사회복지사 2급 교육원 서비스"
    />
  ) : (
    <div className="swg-cover-other">
      <small>
        {tab === "reviews" ? "이용후기" : "개발자 이야기"}
      </small>
      <h1>
  {tab === "reviews"
    ? "실제 이용후기"
    : "학생일정포털 개발자 이야기"}
</h1>
    </div>
  )}
</div>
      <nav className="swg-tabs" aria-label="안내 페이지 메뉴">{tabs.map(t => <button key={t.key} className={tab === t.key ? "active" : ""} onClick={() => changeTab(t.key)}>{t.title}</button>)}</nav>
      {tab === "guide" && <main className="swg-guide">
<section className="swg-panel swg-lead"><h2>수업만 끝나면 자격증을 신청할 수 있을까요?</h2><p>아닙니다. 사회복지사 2급은 수업·실습·행정절차를 모두 마친 뒤 신청합니다. <strong>모든 교육원에 공통으로 적용되는 취득절차</strong>입니다.</p><div className="swg-compare"><div><b>수업 종료일</b><span>수강 일정이 끝나는 날</span></div><strong>≠</strong><div className="primary"><b>자격증 신청 예상일</b><span>필수 과정과 행정절차를 마치고 협회에 신청할 수 있는 시기</span></div></div></section>
<QualificationEstimate />
<section className="swg-panel"><h2>사회복지사 2급 필수 취득절차</h2><p>교육원과 관계없이 아래 네 가지 단계를 모두 확인해야 합니다.</p><div className="swg-steps">{[["01","이론수업","swg-theory"],["02","현장실습","swg-practice"],["03","행정절차","swg-admin"],["04","자격증 신청","swg-apply"]].map(([n,t,id])=><button key={id} onClick={()=>jump(id)}><b>{n}</b><strong>{t}</strong><span>자세히 보기 ›</span></button>)}</div></section>
<section className="swg-panel" id="swg-theory"><small className="swg-kicker">01 / 이론수업</small><h2>이론수업은 어떻게 진행하나요?</h2><p>사회복지사 전공과목을 평가인정 교육기관에서 수강합니다. 실습을 제외한 이론과목은 기관 운영 기준에 따라 PC·모바일로 수강할 수 있습니다.</p><div className="swg-fact"><b>진행 방법</b><span>개강 후 주차별 강의 출석, 과제·토론·시험 등 평가 참여</span></div><div className="swg-fact"><b>이수 제한</b><span>한 학기 최대 24학점(통상 8과목), 연간 최대 42학점(통상 14과목)</span></div><div className="swg-fact"><b>주의 사항</b><span>중복과목, 학점인정 한도, 출석·성적 기준 확인</span></div><p className="swg-callout">교육원 수료와 국가평생교육진흥원 학점인정신청은 별도 절차입니다.</p></section>
<section className="swg-panel" id="swg-practice"><small className="swg-kicker">02 / 사회복지현장실습</small><h2>실습은 세 가지 일정이 맞아야 합니다.</h2><p>사회복지기관에서 실무를 경험하는 필수 과목으로, 현장실습 160시간과 실습교육원의 세미나·출석 기준을 충족해야 합니다.</p><div className="swg-fact"><b>선이수 조건</b><span>실습교육원에서 요구하는 선이수 과목을 먼저 충족해야 합니다. 통상 필수 4과목과 선택 2과목 이상을 요구하므로 모집요강을 확인하세요.</span></div><div className="swg-fact"><b>실습 시간</b><span>현장실습 160시간 + 교육기관의 세미나·출석 요건</span></div><h3>실습 진행 방법</h3><div className="swg-process"><p><b>1</b> 실습교육원 모집 일정 및 선이수 조건 확인</p><p><b>2</b> 실습기관 탐색·면접 및 기관 수락</p><p><b>3</b> 실습교육원 세미나·실습기관·본인 일정 조율</p><p><b>4</b> 승인된 일정에 따라 현장실습 및 세미나 이수</p></div><div className="swg-important">실습교육원 일정 + 실습기관 일정 + 본인 일정<br/><strong>세 가지가 모두 맞아야 진행할 수 있습니다.</strong></div><p className="swg-callout">실습기관은 아무 곳에서나 진행할 수 없습니다. 실습지도자, 기관 요건, 모집 인원 및 평일·주말 운영 여부를 확인해야 합니다.</p></section>
<section className="swg-panel" id="swg-admin"><small className="swg-kicker">03 / 행정절차</small><h2>행정절차는 왜 꼭 해야 하나요?</h2><p>교육원에서 이수한 과목을 국가평생교육진흥원 학점은행제에 공식적으로 등록·인정받는 절차입니다. 기한을 놓치면 학위취득과 자격증 신청이 늦어질 수 있습니다.</p><div className="swg-fact"><b>학습자등록</b><span>학점은행제 학습자로 등록</span></div><div className="swg-fact"><b>학점인정신청</b><span>이수한 과목·학점을 공식 인정받는 절차</span></div><div className="swg-fact"><b>학위신청</b><span>학위취득이 필요한 학습자가 전문학사 학위를 신청하는 절차</span></div><div className="swg-period"><b>학습자등록·학점인정신청</b><strong>통상 1월 · 4월 · 7월 · 10월</strong><span>정확한 시작·마감일은 분기별 공고 확인</span></div><div className="swg-period"><b>학위신청</b><strong>2월·8월 학위수여 일정에 맞춰 별도 신청</strong><span>고졸자는 전문학사 학위신청 기한 확인 필수</span></div><a className="swg-textlink" href="https://www.cb.or.kr" target="_blank" rel="noreferrer">학점은행제 공식 일정 확인하기 ↗</a></section>
<section className="swg-panel" id="swg-apply"><small className="swg-kicker">04 / 자격증 신청</small><h2>모든 요건을 갖춘 뒤 협회에 신청합니다.</h2><p>필요한 과목과 학력 요건을 충족한 뒤 한국사회복지사협회 자격관리 절차에 따라 별도로 신청합니다.</p><div className="swg-eligibility"><b>전문학사 학위 이상</b><strong>사회복지 전공과목 17과목</strong><span>필수 10과목 + 선택 7과목 (현장실습 포함)</span></div><div className="swg-eligibility"><b>고등학교 졸업</b><strong>전공과목 17과목 + 전문학사 학위취득</strong><span>전문학사: 총 80학점 이상, 전공 45학점 이상, 교양 15학점 이상 등 학위요건 충족</span></div><p className="swg-callout">자격증 신청 예상일은 실제 자격증 발급일과 다릅니다. 기존 이수학점과 개강·행정 일정에 따라 달라질 수 있습니다.</p><a className="swg-textlink" href="https://www.welfare.net/lic/" target="_blank" rel="noreferrer">한국사회복지사협회 자격관리 안내 ↗</a></section>
<section className="swg-panel swg-conclusion"><h2>수업 외에도 확인할 절차가 많습니다.</h2><p>과목 누락, 실습 일정 불일치, 행정절차 기한 누락은 자격증 신청 지연으로 이어질 수 있습니다. 본인의 진행상황을 직접 확인하세요.</p></section><Next title="실제 교육원에서는 어떻게 관리할까요?" button="교육원 서비스 확인하기" onClick={()=>changeTab("service")}/></main>}
      
{tab === "service" && (
  <main className="swg-service">

    <section className="swg-service-section">
      <span className="swg-eyebrow">교육원 서비스 안내</span>
      <h2>같은 수강료라면, 관리 방식까지 확인하세요.</h2>
      <p>
        사회복지사 2급은 수업만 듣는다고 끝나는 과정이 아닙니다.
        이론수업부터 실습, 행정절차, 자격증 신청까지
        여러 단계를 정확하게 진행해야 합니다.
      </p>
      <p>
        저희 교육원은 담당자의 안내뿐 아니라
        학습자가 직접 관리 내용을 확인할 수 있는
        학사관리시스템을 운영하고 있습니다.
      </p>
    </section>

    <section className="swg-service-section">
      <span className="swg-eyebrow">01 / 피해사례</span>
      <h2>실제로 이런 피해가 발생했습니다.</h2>
      <p>
        담당자 연락 두절, 과목 누락, 잘못된 학습설계로
        자격증 취득이 지연된 사례들입니다.
      </p>

      <ImageSlot
        src="/images/service-damage-cases.png"
        label="사회복지사 2급 관련 온라인 피해 상담 사례"
      />

      <p className="swg-service-note">
        실제 온라인 상담 게시글을 바탕으로 재구성한 사례입니다.
        모든 교육기관에서 동일한 문제가 발생한다는 의미는 아닙니다.
      </p>

      <div className="swg-service-message">
        <strong>인가받은 교육원인지 확인하는 것만으로 충분할까요?</strong>
        <p>
          정식 교육기관 여부도 중요하지만, 과목 누락과
          행정절차 지연을 예방하려면 본인의 학습계획과
          진행상황을 직접 확인할 수 있어야 합니다.
        </p>
      </div>
    </section>

    <section className="swg-service-section swg-service-solution">
      <ImageSlot
        src="/images/service-solution-banner.png"
        label="사회복지사 2급 학사관리시스템 도입"
      />
      <p>
        담당자 관리, 시스템 검사, 학습자 직접 확인을
        결합해 학습 과정의 누락과 혼선을 줄이도록 설계했습니다.
      </p>
    </section>

    <section className="swg-service-section">
      <span className="swg-eyebrow">02 / 학생일정포털</span>
      <h2>담당자가 관리하는 내용을 직접 확인하세요.</h2>
      <p>
        대학교에서 학사관리시스템을 운영하듯,
        사회복지사 2급 과정도 학습자가 자신의
        학사일정을 확인할 수 있어야 합니다.
      </p>

      <ImageSlot
        src="/images/service-student-portal.png"
        label="학생일정포털 모바일 화면"
      />

      <div className="swg-service-points">
        <div><b>01</b><span>자격증 신청 예상일 확인</span></div>
        <div><b>02</b><span>학기별 수업 및 실습 진행상황</span></div>
        <div><b>03</b><span>행정절차 안내 및 체크리스트</span></div>
        <div><b>04</b><span>학습설계 안전검사</span></div>
        <div><b>05</b><span>담당자 관리 내용 확인</span></div>
      </div>

      <h3>24시간 직접 체험해 보세요.</h3>
      <div className="swg-credentials">
        <div><span>이름</span><strong>테스트</strong></div>
        <div><span>전화번호</span><strong>010-9311-7148</strong></div>
      </div>

      <a
        className="swg-primary"
        href="https://edu-crm-five.vercel.app/portal/with-one"
        target="_blank"
        rel="noreferrer"
      >
        학생일정포털 체험하기
      </a>

      <a
        className="swg-service-link"
        href="https://www.startuptimes.kr/article/위드웨이브-학생일정포털-개발학점은행제-피해-예방-나선다"
        target="_blank"
        rel="noreferrer"
      >
        학생일정포털 관련 언론보도 확인하기
      </a>
    </section>

    <section className="swg-service-section">
      <span className="swg-eyebrow">03 / 실습배정지원센터</span>
      <h2>실습기관, 혼자 알아보지 마세요.</h2>
      <p>
        실습은 본인 일정, 실습교육원 일정,
        실습기관 일정이 모두 맞아야 진행할 수 있습니다.
      </p>
      <p>
        실습배정지원센터에서는 희망 지역과
        평일·주말 일정에 맞춰 실습기관을 탐색하고
        배정 절차를 지원합니다.
      </p>

      <ImageSlot
        src="/images/service-practice-map.png"
        label="실습배정지원센터 지역별 지도"
      />

      <ImageSlot
        src="/images/service-practice-detail.png"
        label="가까운 실습기관 상세정보"
      />

      <div className="swg-service-message">
        <strong>단순한 기관 목록 제공과는 다릅니다.</strong>
        <p>
          거리와 모집 조건을 함께 확인하고
          실습기관 면접 및 일정 조율을 지원합니다.
          최종 배정은 기관의 수락과 모집 상황에 따라 결정됩니다.
        </p>
      </div>
    </section>

    <section className="swg-service-section">
      <span className="swg-eyebrow">04 / 취업정보센터</span>
      <h2>자격증 취득 전부터 취업을 준비하세요.</h2>
      <p>
        고용24 채용정보를 연동해 거주지 주변의
        사회복지 분야 채용공고를 확인할 수 있습니다.
      </p>

      <ImageSlot
        src="/images/service-employment-center.png"
        label="취업정보센터 실제 운영 화면"
      />

      <div className="swg-service-points">
        <div><b>01</b><span>거주지 주변 채용공고 검색</span></div>
        <div><b>02</b><span>지도 기반 근무지역 확인</span></div>
        <div><b>03</b><span>자격증 준비와 취업 준비 병행</span></div>
      </div>

      <div className="swg-credentials">
        <div><span>이름</span><strong>테스트</strong></div>
        <div><span>전화번호</span><strong>010-9311-7148</strong></div>
      </div>

      <a
        className="swg-primary"
        href="https://edu-crm-five.vercel.app/employment-center"
        target="_blank"
        rel="noreferrer"
      >
        취업정보센터 체험하기
      </a>

      <h3>현장 실무교육도 준비할 수 있습니다.</h3>
      <ImageSlot
        src="/images/service-practical-training.png"
        label="사회복지사 실무교육 안내"
      />
      <p>
        실무교육을 희망하는 경우 관련 교육과정 안내 및
        연계를 지원합니다.
      </p>
    </section>

    <section className="swg-service-section">
      <span className="swg-eyebrow">05 / 관리 서비스 비교</span>
      <h2>어떤 차이가 있는지 비교해 보세요.</h2>
      <p>
        수강료뿐 아니라 학사관리 방식,
        실습 지원, 행정절차 안내,
        취업 준비 지원 여부까지 확인하는 것이 중요합니다.
      </p>

      <ImageSlot
        src="/images/service-comparison-table.png"
        label="일반적인 교육원 운영 방식과 자사 관리 서비스 비교"
      />

      <p className="swg-service-note">
        비교표의 타사 항목은 일반적인 운영 방식의 예시이며,
        실제 서비스는 교육기관마다 다를 수 있습니다.
      </p>
    </section>

    <section className="swg-service-section">
      <span className="swg-eyebrow">언론보도</span>
      <h2>학사관리시스템 개발 이야기</h2>
      <p>
        학점은행제 교육기관의 관리 부담과
        학습자의 정보 확인 문제를 개선하기 위해
        개발한 CRM 및 학생일정포털을 소개합니다.
      </p>

      <a
        className="swg-service-link"
        href="https://www.startuptimes.kr/article/위드웨이브-학점은행제-전용-SaaS-에듀캔버스-CRM-출시"
        target="_blank"
        rel="noreferrer"
      >
        학점은행제 CRM 출시 관련 언론보도
      </a>
    </section>

    <section className="swg-service-section">
      <span className="swg-eyebrow">자주 묻는 질문</span>
      <h2>이런 부분이 궁금하실 수 있습니다.</h2>

      <div className="swg-service-faq">
        <details>
          <summary>교육원마다 자격증 취득 기준이 다른가요?</summary>
          <p>
            아닙니다. 사회복지사 2급의 법정 취득요건은
            공통으로 적용됩니다. 다만 개강 일정과
            관리 서비스는 기관별로 다를 수 있습니다.
          </p>
        </details>
        <details>
          <summary>학생일정포털은 직접 이용할 수 있나요?</summary>
          <p>
            네. 제공된 체험 계정으로 실제 운영 화면을
            24시간 확인할 수 있습니다.
          </p>
        </details>
        <details>
          <summary>실습기관은 무조건 배정되나요?</summary>
          <p>
            실습기관의 모집 상황, 면접, 일정,
            실습교육원의 승인 여부에 따라 달라집니다.
          </p>
        </details>
      </div>
    </section>

    <Next
      title="실제 이용후기도 확인해 보세요."
      button="이용후기 확인하기"
      onClick={() => changeTab("reviews")}
    />
  </main>
)}

{tab === "reviews" && (
  <main>
    <section className="swg-section">
      <span className="swg-eyebrow">실제 이용후기</span>
      <h2>회원님들의 이용후기를 확인해 보세요.</h2>
      <p>교육원 이용후기를 확인하실 수 있습니다.</p>
    </section>

    <Next
      title="교육원 관리 서비스가 궁금하신가요?"
      button="교육원 서비스 확인하기"
      onClick={() => changeTab("service")}
    />
  </main>
)}

      {tab === "developer" && <main><div className="swg-intro"><span className="swg-eyebrow">개발자 이야기</span><h2>학습자가 자신의 과정을 직접 확인할 수 있도록.</h2><p>학점은행제 학습관리 현장에서 과목 누락, 일정 지연, 행정절차 혼선을 줄이기 위해 학생일정포털과 관리 시스템을 직접 개발했습니다.</p></div><section className="swg-section"><h2>개발하게 된 이유</h2><p>사회복지사 2급은 긴 시간 준비하는 과정입니다. 담당자가 꼼꼼하게 관리하는 것뿐 아니라, 학습자 스스로 자신의 학습계획과 신청 일정을 확인할 수 있어야 한다고 생각했습니다.</p><ImageSlot src="/social-worker-guide/developer.jpg" label="개발자 또는 실제 시스템 개발 화면"/></section><section className="swg-section"><h2>시스템과 함께하는 학습관리</h2><p>학습계획, 설계 안전검사, 실습 진행상황, 행정절차와 자격증 신청 예상일을 한 화면에서 확인할 수 있도록 지속적으로 개선하고 있습니다.</p></section><Next title="취득 과정을 다시 확인하고 싶으신가요?" button="취득가이드로 돌아가기" onClick={() => changeTab("guide")}/></main>}
      <footer className="swg-footer">사회복지사 2급 필수 취득가이드<br/>안내 내용은 개인별 학력·이수내역과 기관별 운영 기준에 따라 달라질 수 있습니다.</footer>
    </div>
  </div>;
}
function Next({title,button,onClick}:{title:string;button:string;onClick:()=>void}){return <section className="swg-next"><h2>{title}</h2><button className="swg-primary" onClick={onClick}>{button} →</button></section>}
const styles = `

.swg-estimate-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin: 24px 0;
}

.swg-estimate-card {
  padding: 24px 18px;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #fff;
  text-align: center;
}

.swg-estimate-card h3 {
  font-size: 17px;
  font-weight: 700;
  margin-bottom: 12px;
}

.swg-estimate-date {
  display: block;
  font-size: 27px;
  font-weight: 800;
  margin: 12px 0 4px;
  color: #175cd3;
}

.swg-estimate-card small {
  color: #667085;
}

@media (max-width: 600px) {
  .swg-estimate-grid {
    grid-template-columns: 1fr;
  }
}
.swg-root{min-height:100vh;background:#f5f7fa;color:#16263a;font-family:Pretendard,"Noto Sans KR",system-ui,sans-serif;word-break:keep-all}.swg-root *{box-sizing:border-box}.swg-header{height:56px;padding:0 18px;display:flex;justify-content:space-between;align-items:center;background:white;border-bottom:1px solid #e8edf3;font-weight:800;font-size:15px}.swg-header a{font-size:11px;color:#47647f;text-decoration:none;font-weight:500}.swg-shell{max-width:480px;margin:auto;background:white;min-height:100vh;box-shadow:0 0 20px #132c4710}.swg-cover{background:linear-gradient(130deg,#0e2948,#174e83);color:white;padding:38px 24px 36px;white-space:pre-line}.swg-cover small{font-size:12px;opacity:.8}.swg-cover h1{font-size:27px;line-height:1.42;letter-spacing:-1.1px;margin:14px 0;font-weight:800}.swg-cover p{font-size:13px;line-height:1.75;color:#e0eaf5;margin:0}.swg-tabs{display:grid;grid-template-columns:repeat(3,1fr);position:sticky;top:0;z-index:5;background:white;border-bottom:1px solid #e4eaf1}.swg-tabs button{border:0;background:white;color:#64748b;padding:16px 2px;font-size:14px;font-weight:700;cursor:pointer}.swg-tabs button.active{color:#1257a0;box-shadow:inset 0 -3px #1257a0}.swg-intro{padding:30px 22px 20px}.swg-eyebrow{font-size:12px;font-weight:800;color:#1764a7}.swg-root h2{font-size:21px;line-height:1.45;letter-spacing:-.6px;margin:10px 0 12px;font-weight:800}.swg-root p{font-size:14px;line-height:1.9;color:#4b5c6f;margin:0}.swg-toc{margin:4px 20px 18px;padding:17px 17px 8px;border:1px solid #e3eaf2;border-radius:13px;background:#fafcff}.swg-toc h3{font-size:15px;margin:0 0 9px}.swg-toc button{width:100%;display:flex;align-items:center;gap:12px;text-align:left;padding:13px 0;background:none;border:0;border-top:1px solid #e8edf3;color:#27394c;font-size:13px;cursor:pointer}.swg-toc button b{color:#2170b3;font-size:12px}.swg-toc button span:nth-child(2){flex:1}.swg-section{padding:34px 22px;border-bottom:9px solid #f5f7fa;scroll-margin-top:70px}.swg-section h3.swg-subtitle{font-size:14px;color:#426381;font-weight:700;margin:0 0 16px}.swg-note{background:#f3f7fc;border-radius:8px;padding:12px;margin-top:16px!important;font-size:12px!important}.swg-textlink{display:inline-block;color:#1265b0;font-weight:700;font-size:13px;margin-top:16px;text-decoration:none}.swg-incident{display:grid;gap:9px;margin-top:19px}.swg-incident article{display:flex;gap:14px;padding:15px;background:#fff7f7;border:1px solid #f7e2e2;border-radius:11px}.swg-incident article>b{color:#b53c42}.swg-incident h3{font-size:14px;margin:0 0 4px}.swg-incident p{font-size:12px;line-height:1.6}.swg-highlight{background:#eef5fd;color:#164775;font-size:14px;font-weight:700;line-height:1.8;border-radius:12px;padding:18px;margin-top:18px}.swg-image{border-radius:12px;overflow:hidden;background:#edf3f9;margin:17px 0;min-height:185px}.swg-image img{display:block;width:100%;height:auto;min-height:185px;object-fit:cover}.swg-placeholder{min-height:185px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:7px;color:#50718e;font-size:13px}.swg-placeholder small{font-size:10px;color:#8ca0b4}.swg-credentials{margin:17px 0;border:1px solid #e2eaf3;border-radius:11px;padding:12px 16px}.swg-credentials div{display:flex;justify-content:space-between;padding:8px 0;font-size:13px}.swg-credentials div+div{border-top:1px solid #edf1f5}.swg-credentials span{color:#64748b}.swg-primary{display:block;width:100%;text-align:center;background:#145a9d;color:white!important;border:0;border-radius:11px;padding:15px 12px;text-decoration:none;font-size:14px;font-weight:800;cursor:pointer}.swg-next{background:#102f50;color:white;padding:28px 22px 32px}.swg-next h2{font-size:18px;margin:0 0 17px}.swg-next .swg-primary{background:white;color:#124675!important}.swg-footer{padding:26px 20px 36px;text-align:center;color:#8a97a7;font-size:11px;line-height:1.9;background:#fafbfc}@media(min-width:520px){.swg-root{padding-bottom:40px}.swg-header{max-width:480px;margin:auto}.swg-shell{border-radius:0 0 16px 16px;overflow:clip}}
.swg-header{max-width:480px;margin:auto;font-size:18px;color:#102d53}.swg-cover{padding:0;background:#f1f6fc;white-space:normal}.swg-cover img{display:block;width:100%;height:auto}.swg-cover-other{padding:34px 22px;background:#123e70;color:white}.swg-cover-other h1{font-size:25px;margin:10px 0 0}.swg-tabs{top:0;z-index:40;box-shadow:0 3px 12px #102b4910}.swg-tabs button{font-size:15px;min-height:54px}.swg-tabs button.active{background:#103f79;color:white;box-shadow:none}.swg-shell{overflow:visible!important}.swg-guide{color:#102544}.swg-panel{padding:28px 20px;border-bottom:9px solid #f2f5fa;scroll-margin-top:65px}.swg-panel h2{font-size:23px;line-height:1.4;margin:0 0 14px}.swg-panel h3{font-size:18px;margin:22px 0 12px}.swg-panel p{font-size:16px;line-height:1.75;color:#344860}.swg-panel p strong{color:#0b4d96}.swg-compare{display:grid;grid-template-columns:minmax(0,1fr) 25px minmax(0,1fr);gap:6px;align-items:center;margin-top:20px}.swg-compare>div{background:#eef4fb;border-radius:12px;min-height:132px;padding:15px 10px;display:flex;flex-direction:column;justify-content:center;gap:9px}.swg-compare>strong{font-size:26px;text-align:center}.swg-compare b{font-size:16px}.swg-compare span{font-size:13px;line-height:1.55;color:#53667c}.swg-compare .primary{background:#103d79;color:white}.swg-compare .primary span{color:#e2ecfb}.swg-steps{display:grid;gap:8px;margin-top:19px}.swg-steps button{width:100%;display:flex;align-items:center;gap:14px;border:1px solid #dbe5f1;background:white;padding:12px;border-radius:10px;text-align:left}.swg-steps button b{background:#164b88;color:white;padding:9px;border-radius:6px}.swg-steps button strong{font-size:16px;flex:1}.swg-steps button span{font-size:12px;color:#53708e}.swg-kicker{display:block;color:#1263ad;font-size:13px;font-weight:800;margin-bottom:10px}.swg-fact{display:grid;grid-template-columns:104px minmax(0,1fr);gap:10px;padding:15px 0;border-bottom:1px solid #e2eaf3}.swg-fact b{color:#13467d;font-size:15px}.swg-fact span{font-size:15px;line-height:1.65;color:#344860}.swg-callout{background:#edf4fc;padding:16px;border-radius:10px;margin-top:18px!important;font-size:14px!important}.swg-process{display:grid;gap:9px}.swg-process p{display:flex;gap:12px;align-items:start;font-size:15px}.swg-process b{display:inline-grid;place-items:center;width:27px;height:27px;border-radius:50%;background:#e6f0fd;color:#15569c;flex:none}.swg-important{background:#103d79;color:#e5f1ff;text-align:center;border-radius:12px;padding:18px 12px;margin-top:18px;font-size:14px;line-height:1.85}.swg-important strong{color:white;font-size:17px}.swg-period,.swg-eligibility{display:grid;gap:8px;border:1px solid #dbe5f2;border-radius:12px;padding:17px;margin-top:12px}.swg-period b,.swg-eligibility b{color:#13467d;font-size:16px}.swg-period strong,.swg-eligibility strong{font-size:16px}.swg-period span,.swg-eligibility span{font-size:14px;color:#50657c;line-height:1.6}.swg-conclusion{background:#f0f5fb}.swg-guide .swg-section{padding:28px 20px}.swg-guide .swg-estimate-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:18px 0}.swg-guide .swg-estimate-card{padding:18px 7px;background:#edf5ff}.swg-guide .swg-estimate-card:nth-child(2){background:#e8f8f1}.swg-guide .swg-estimate-card h3{font-size:15px}.swg-guide .swg-estimate-date{font-size:clamp(19px,5.5vw,27px);white-space:nowrap}.swg-guide .swg-estimate-card p{font-size:12px}.swg-guide .swg-estimate-card .swg-note{font-size:11px!important;padding:7px}@media(max-width:370px){.swg-fact{grid-template-columns:86px 1fr}.swg-steps button{gap:8px}.swg-steps button strong{font-size:14px}.swg-steps button span{font-size:11px}}
/* 교육원 서비스 모바일 전용 */
.swg-service {
  background: #fff;
}


.swg-service-section {
padding: 30px 20px;
border-bottom: 8px solid #f3f6fa;
}

.swg-service-section h2 {
font-size: 23px;
line-height: 1.42;
letter-spacing: -0.7px;
margin: 10px 0 14px;
color: #102544;
}

.swg-service-section h3 {
font-size: 18px;
margin: 24px 0 12px;
color: #102544;
}

.swg-service-section p {
font-size: 16px;
line-height: 1.8;
color: #40536b;
margin: 0 0 13px;
}

.swg-service-section .swg-image {
min-height: 0;
margin: 18px 0;
border-radius: 13px;
background: #f4f7fb;
}

.swg-service-section .swg-image img {
width: 100%;
height: auto;
min-height: 0;
display: block;
object-fit: contain;
}

.swg-service-note {
font-size: 12px !important;
color: #77869a !important;
line-height: 1.6 !important;
}

.swg-service-message {
padding: 18px;
background: #f1f6fc;
border-left: 4px solid #1766b2;
border-radius: 8px;
margin-top: 20px;
}

.swg-service-message strong {
font-size: 17px;
line-height: 1.55;
color: #103d79;
}

.swg-service-message p {
font-size: 14px;
margin: 10px 0 0;
}

.swg-service-solution {
padding-top: 22px;
}

.swg-service-points {
margin: 20px 0;
border-top: 1px solid #e2e9f2;
}

.swg-service-points div {
display: flex;
gap: 15px;
align-items: center;
padding: 14px 0;
border-bottom: 1px solid #e2e9f2;
}

.swg-service-points b {
color: #1766b2;
font-size: 14px;
min-width: 24px;
}

.swg-service-points span {
font-size: 15px;
font-weight: 650;
color: #243b55;
}

.swg-service-link {
display: block;
margin-top: 12px;
padding: 14px;
border: 1px solid #cfdeef;
border-radius: 9px;
color: #145a9d;
text-align: center;
text-decoration: none;
font-size: 14px;
font-weight: 750;
}

.swg-service-faq {
margin-top: 18px;
border-top: 1px solid #e1e8f1;
}

.swg-service-faq details {
border-bottom: 1px solid #e1e8f1;
padding: 17px 2px;
}

.swg-service-faq summary {
cursor: pointer;
font-size: 16px;
font-weight: 700;
color: #182e4b;
line-height: 1.6;
}

.swg-service-faq details p {
font-size: 14px;
margin-top: 12px;
}

@media (max-width: 370px) {
.swg-service-section {
padding: 25px 16px;
}

.swg-service-section h2 {
font-size: 21px;
}
}
`;
