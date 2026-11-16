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
const incidents = [
  { title: "담당자 변경·연락 두절", body: "관리 내용이 제대로 인수인계되지 않으면 학습계획 확인이 어려워질 수 있습니다." },
  { title: "필수과목 누락·설계 오류", body: "과목 누락이나 중복 수강으로 추가 비용과 일정 지연이 발생할 수 있습니다." },
  { title: "행정절차 신청기간 누락", body: "학점인정이나 학위신청 시기를 놓치면 자격증 신청 일정이 늦어질 수 있습니다." },
];
const services = [
  { title: "학생일정포털", subtitle: "학습자가 직접 확인하는 학사관리시스템", body: "자격증 신청 예상일, 수강·이수과목, 학습계획, 실습 진행상황, 설계 안전검사와 행정절차 체크리스트를 확인할 수 있습니다.", image: "/social-worker-guide/student-portal.jpg", placeholder: "학생일정포털 실제 화면" },
  { title: "실습배정지원센터", subtitle: "실습기관 탐색부터 일정 확인까지", body: "희망 지역과 평일·주말 일정에 맞는 실습기관을 살펴보고, 기관별 조건과 배정 절차를 안내합니다. 실제 배정 여부는 기관 사정과 심사에 따라 달라집니다.", image: "/social-worker-guide/practice-center.jpg", placeholder: "실습배정지원센터 실제 화면" },
  { title: "취업정보센터", subtitle: "자격증 취득 전부터 준비하는 취업", body: "고용24 연동 채용정보를 지도에서 확인하고, 거주지 주변 사회복지 분야 채용공고를 살펴볼 수 있습니다.", image: "/social-worker-guide/employment-center.jpg", placeholder: "취업정보센터 실제 화면" },
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
    <header className="swg-header"><span>사회복지사 2급</span><a href="https://www.cb.or.kr" target="_blank" rel="noreferrer">학점은행제 공식 안내</a></header>
    <div className="swg-shell">
      <div className="swg-cover"><small>사회복지사 2급 필수 취득가이드</small><h1>{tab === "guide" ? "처음 준비할 때\n꼭 알아야 할 모든 것" : tab === "service" ? "사회복지사 2급,\n이제는 안전하게 준비하세요." : tab === "reviews" ? "실제 이용후기를\n확인해 보세요." : "학습자를 위한\n시스템을 만들었습니다."}</h1><p>{tab === "guide" ? "취득조건부터 실습·행정절차·자격증 신청까지 한눈에 확인하세요." : tab === "service" ? "담당자 관리 + 시스템 검사 + 회원 직접 확인" : tab === "reviews" ? "후기 자료는 개인정보를 가린 뒤 순차적으로 공개합니다." : "왜 학생이 직접 확인하는 학사관리시스템이 필요했을까요?"}</p></div>
      <nav className="swg-tabs" aria-label="안내 페이지 메뉴">{tabs.map(t => <button key={t.key} className={tab === t.key ? "active" : ""} onClick={() => changeTab(t.key)}>{t.title}</button>)}</nav>
      {tab === "guide" && <main><div className="swg-intro"><span className="swg-eyebrow">취득가이드</span><h2>사회복지사 2급, 어떻게 준비할까요?</h2><p>처음 알아보시는 분도 쉽게 이해할 수 있도록 순서대로 정리했습니다.</p></div><section className="swg-toc"><h3>목차</h3>{guideSections.map((s,i) => <button key={s.title} onClick={() => jump(`guide-${i}`)}><b>{String(i+1).padStart(2,"0")}</b><span>{s.title}</span><span>›</span></button>)}</section><QualificationEstimate />{guideSections.map((s,i) => <section className="swg-section" id={`guide-${i}`} key={s.title}><span className="swg-eyebrow">0{i+1} / 06</span><h2>{s.title}</h2><p>{s.body}</p>{i === 3 && <p className="swg-note">※ 실습 가능 기관, 선이수 과목 및 세미나 기준은 신청하는 교육기관에 확인해야 합니다.</p>}{i === 4 && <a className="swg-textlink" href="https://www.cb.or.kr" target="_blank" rel="noreferrer">국가평생교육진흥원 학점은행제 확인하기 ↗</a>}{i === 5 && <a className="swg-textlink" href="https://www.welfare.net/lic/" target="_blank" rel="noreferrer">사회복지사 자격관리 안내 확인하기 ↗</a>}</section>)}<Next title="실제 교육원에서는 어떻게 관리할까요?" button="교육원 서비스 확인하기" onClick={() => changeTab("service")}/></main>}
      {tab === "service" && <main><div className="swg-intro"><span className="swg-eyebrow">교육원 관리 서비스</span><h2>저희 교육원의 관리는 이렇게 진행됩니다.</h2><p>이론수업부터 실습·행정절차·자격증 신청·취업 준비까지, 실제 운영 중인 시스템으로 관리 과정을 확인할 수 있도록 돕습니다.</p></div><section className="swg-toc"><h3>목차</h3>{["대표적인 피해 사례", "안전한 관리 방식", "학생일정포털", "실습배정지원센터", "취업정보센터", "실제 시스템 체험"].map((t,i)=><button key={t} onClick={()=>jump(`service-${i}`)}><b>{String(i+1).padStart(2,"0")}</b><span>{t}</span><span>›</span></button>)}</section><section className="swg-section" id="service-0"><span className="swg-eyebrow">왜 관리가 중요할까요?</span><h2>대표적인 피해 사례</h2><p>사회복지사 2급은 여러 학기에 걸쳐 준비하는 과정입니다. 작은 누락도 추가 비용이나 취득 지연으로 이어질 수 있습니다.</p><div className="swg-incident">{incidents.map((v,i)=><article key={v.title}><b>{String(i+1).padStart(2,"0")}</b><div><h3>{v.title}</h3><p>{v.body}</p></div></article>)}</div></section><section className="swg-section" id="service-1"><span className="swg-eyebrow">관리 원칙</span><h2>담당자 관리 + 시스템 검사 + 회원 직접 확인</h2><p>담당자의 설명에만 의존하지 않고, 실제 학습계획과 진행상황을 회원님도 직접 확인할 수 있도록 구성했습니다.</p><div className="swg-highlight">보여주기식 안내가 아닌, 실제 운영 중인 시스템을 통해 관리 과정을 투명하게 보여드립니다.</div></section>{services.map((s,i)=><section className="swg-section" id={`service-${i+2}`} key={s.title}><span className="swg-eyebrow">전문 관리 시스템 0{i+1}</span><h2>{s.title}</h2><h3 className="swg-subtitle">{s.subtitle}</h3><ImageSlot src={s.image} label={s.placeholder}/><p>{s.body}</p></section>)}<section className="swg-section" id="service-5"><span className="swg-eyebrow">24시간 체험</span><h2>직접 확인하고 결정하세요.</h2><p>학생일정포털 체험 계정으로 관리 화면을 살펴보실 수 있습니다. 체험 화면은 예시 데이터로 구성되어 있습니다.</p><div className="swg-credentials"><div><span>이름</span><strong>테스트</strong></div><div><span>전화번호</span><strong>010-9311-7148</strong></div></div><a className="swg-primary" href="/portal/with-one" target="_blank" rel="noreferrer">학생일정포털 체험하기 ↗</a></section><Next title="실제 이용하신 분들의 이야기도 확인해 보세요." button="이용후기 보러가기" onClick={() => changeTab("reviews")}/></main>}
      {tab === "reviews" && <main><div className="swg-intro"><span className="swg-eyebrow">이용후기</span><h2>실제 이용후기를 확인해 보세요.</h2><p>학습관리, 실습 지원, 학생일정포털 이용 경험을 소개합니다. 확인된 후기만 개인정보를 가린 뒤 게시합니다.</p></div>{["학습관리 이용후기", "실습 지원 이용후기", "학생일정포털 이용후기"].map((t,i)=><section className="swg-section" key={t}><span className="swg-eyebrow">REVIEW 0{i+1}</span><h2>{t}</h2><ImageSlot src={`/social-worker-guide/review-${i+1}.jpg`} label={`${t} 사진`}/></section>)}<Next title="이 시스템을 직접 개발한 이유가 궁금하신가요?" button="개발자 이야기 바로보기" onClick={() => changeTab("developer")}/></main>}
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
.swg-root{min-height:100vh;background:#f5f7fa;color:#16263a;font-family:Pretendard,"Noto Sans KR",system-ui,sans-serif;word-break:keep-all}.swg-root *{box-sizing:border-box}.swg-header{height:56px;padding:0 18px;display:flex;justify-content:space-between;align-items:center;background:white;border-bottom:1px solid #e8edf3;font-weight:800;font-size:15px}.swg-header a{font-size:11px;color:#47647f;text-decoration:none;font-weight:500}.swg-shell{max-width:480px;margin:auto;background:white;min-height:100vh;box-shadow:0 0 20px #132c4710}.swg-cover{background:linear-gradient(130deg,#0e2948,#174e83);color:white;padding:38px 24px 36px;white-space:pre-line}.swg-cover small{font-size:12px;opacity:.8}.swg-cover h1{font-size:27px;line-height:1.42;letter-spacing:-1.1px;margin:14px 0;font-weight:800}.swg-cover p{font-size:13px;line-height:1.75;color:#e0eaf5;margin:0}.swg-tabs{display:grid;grid-template-columns:repeat(3,1fr);position:sticky;top:0;z-index:5;background:white;border-bottom:1px solid #e4eaf1}.swg-tabs button{border:0;background:white;color:#64748b;padding:16px 2px;font-size:14px;font-weight:700;cursor:pointer}.swg-tabs button.active{color:#1257a0;box-shadow:inset 0 -3px #1257a0}.swg-intro{padding:30px 22px 20px}.swg-eyebrow{font-size:12px;font-weight:800;color:#1764a7}.swg-root h2{font-size:21px;line-height:1.45;letter-spacing:-.6px;margin:10px 0 12px;font-weight:800}.swg-root p{font-size:14px;line-height:1.9;color:#4b5c6f;margin:0}.swg-toc{margin:4px 20px 18px;padding:17px 17px 8px;border:1px solid #e3eaf2;border-radius:13px;background:#fafcff}.swg-toc h3{font-size:15px;margin:0 0 9px}.swg-toc button{width:100%;display:flex;align-items:center;gap:12px;text-align:left;padding:13px 0;background:none;border:0;border-top:1px solid #e8edf3;color:#27394c;font-size:13px;cursor:pointer}.swg-toc button b{color:#2170b3;font-size:12px}.swg-toc button span:nth-child(2){flex:1}.swg-section{padding:34px 22px;border-bottom:9px solid #f5f7fa;scroll-margin-top:70px}.swg-section h3.swg-subtitle{font-size:14px;color:#426381;font-weight:700;margin:0 0 16px}.swg-note{background:#f3f7fc;border-radius:8px;padding:12px;margin-top:16px!important;font-size:12px!important}.swg-textlink{display:inline-block;color:#1265b0;font-weight:700;font-size:13px;margin-top:16px;text-decoration:none}.swg-incident{display:grid;gap:9px;margin-top:19px}.swg-incident article{display:flex;gap:14px;padding:15px;background:#fff7f7;border:1px solid #f7e2e2;border-radius:11px}.swg-incident article>b{color:#b53c42}.swg-incident h3{font-size:14px;margin:0 0 4px}.swg-incident p{font-size:12px;line-height:1.6}.swg-highlight{background:#eef5fd;color:#164775;font-size:14px;font-weight:700;line-height:1.8;border-radius:12px;padding:18px;margin-top:18px}.swg-image{border-radius:12px;overflow:hidden;background:#edf3f9;margin:17px 0;min-height:185px}.swg-image img{display:block;width:100%;height:auto;min-height:185px;object-fit:cover}.swg-placeholder{min-height:185px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:7px;color:#50718e;font-size:13px}.swg-placeholder small{font-size:10px;color:#8ca0b4}.swg-credentials{margin:17px 0;border:1px solid #e2eaf3;border-radius:11px;padding:12px 16px}.swg-credentials div{display:flex;justify-content:space-between;padding:8px 0;font-size:13px}.swg-credentials div+div{border-top:1px solid #edf1f5}.swg-credentials span{color:#64748b}.swg-primary{display:block;width:100%;text-align:center;background:#145a9d;color:white!important;border:0;border-radius:11px;padding:15px 12px;text-decoration:none;font-size:14px;font-weight:800;cursor:pointer}.swg-next{background:#102f50;color:white;padding:28px 22px 32px}.swg-next h2{font-size:18px;margin:0 0 17px}.swg-next .swg-primary{background:white;color:#124675!important}.swg-footer{padding:26px 20px 36px;text-align:center;color:#8a97a7;font-size:11px;line-height:1.9;background:#fafbfc}@media(min-width:520px){.swg-root{padding-bottom:40px}.swg-header{max-width:480px;margin:auto}.swg-shell{border-radius:0 0 16px 16px;overflow:clip}}`;
