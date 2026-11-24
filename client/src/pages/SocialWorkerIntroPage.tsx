import type { ReactNode } from "react";
import { useEffect, useState } from "react";

const tabs = [
  {key:"intro", title:"사회복지사란?", heading:"사회복지사는 어떤 직업일까요?"},
  {key:"qualification", title:"자격요건", heading:"사회복지사가 되려면?"},
  {key:"education", title:"취득방법", heading:"사회복지사 2급은 어떻게 취득하나요?"},
  {key:"certificate", title:"자격증 발급", heading:"자격증은 어디에서 발급받나요?"},
  {key:"career", title:"취업분야", heading:"사회복지사는 어디에서 일할까요?"},
  {key:"salary", title:"급여 및 전망", heading:"사회복지사의 급여는 어떻게 결정될까요?"},
] as const;
type Tab = typeof tabs[number]["key"];
function ImageSlot({name,label}:{name:Tab;label:string}) {
  const [failed,setFailed]=useState(false);
  const src=`/images/social-worker/${name}.webp`;
  return <div className="swi-image">{failed ? <div className="swi-placeholder"><strong>사진 추가 예정</strong><span>{label}</span></div> : <img src={src} alt={label} onError={()=>setFailed(true)} />}</div>;
}
function Table({rows}:{rows:string[][]}) {return <table className="swi-table"><tbody>{rows.map(([label,...values],i)=><tr key={i}><th scope="row">{label}</th>{values.map((v,j)=><td key={j}>{v}</td>)}</tr>)}</tbody></table>}
function Panel({title,children}:{title:string;children:ReactNode}) {return <section className="swi-panel"><h2>{title}</h2>{children}</section>}
export default function SocialWorkerIntroPage(){
  const [tab,setTab]=useState<Tab>(()=>tabs.find(t=>t.key===new URLSearchParams(window.location.search).get("tab"))?.key ?? "intro");
  const [consultOpen,setConsultOpen]=useState(false);
  const index=tabs.findIndex(t=>t.key===tab);
  const current=tabs[index];
  const homeHref=["welfareon.kr","www.welfareon.kr"].includes(window.location.hostname)?"/":"/employment-center";
  function changeTab(next:Tab){setTab(next);const url=new URL(window.location.href);url.searchParams.set("tab",next);window.history.replaceState(window.history.state,"",url);window.scrollTo({top:0,behavior:"instant"});}
  useEffect(()=>{if(!consultOpen)return;const old=document.body.style.overflow;document.body.style.overflow="hidden";const close=(e:KeyboardEvent)=>{if(e.key==="Escape")setConsultOpen(false)};window.addEventListener("keydown",close);return()=>{document.body.style.overflow=old;window.removeEventListener("keydown",close)}},[consultOpen]);
  return <div className="swi-root"><style>{styles}</style><header className="swi-header"><a href={homeHref} className="swi-brand" aria-label="센터 홈으로 이동"><img className="swi-brand-logo" src="/images/employment-center/social-welfare-logo.png" alt="사회복지 통합지원센터"/></a><a href={homeHref} className="swi-home-link">센터 홈 ›</a></header><div className="swi-shell"><nav className="swi-tabs" aria-label="사회복지사 알아보기">{tabs.map(t=><button type="button" key={t.key} aria-pressed={tab===t.key} className={tab===t.key?"active":""} onClick={()=>changeTab(t.key)}>{t.title}</button>)}</nav><main className="swi-guide"><section className="swi-panel"><h2>{current.heading}</h2><ImageSlot key={tab} name={tab} label={current.title}/></section>
{tab==="intro" && <><Panel title="사회복지사의 정의"><p>사회복지사는 개인, 가족 및 지역사회가 겪는 다양한 사회적 문제를 해결하고 인간다운 삶을 영위할 수 있도록 전문적인 복지서비스를 제공하는 사람입니다.</p><p>아동, 청소년, 노인, 장애인 등 사회적 지원이 필요한 사람들을 대상으로 상담, 보호, 교육 및 복지서비스 연계 등의 업무를 수행합니다.</p></Panel><Panel title="사회복지사 국가자격증"><p>사회복지사는 보건복지부 소관의 국가자격증으로 사회복지사업법에 따라 자격 취득 기준이 정해져 있습니다. 2급은 대학 또는 학점은행제 등을 통해 학력 및 법정 교과목 요건을 충족하여 취득할 수 있으며 자격증 발급 업무는 한국사회복지사협회에서 수행합니다.</p><Table rows={[["자격증 명칭","사회복지사"],["자격증 종류","국가자격증"],["소관부처","보건복지부"],["자격관리기관","한국사회복지사협회"],["자격등급","1급 / 2급"],["관련 법령","사회복지사업법"]]}/></Panel><Panel title="사회복지사의 주요 업무"><ul><li>복지대상자 상담 및 사례관리</li><li>사회복지 프로그램 기획 및 운영</li><li>생활 및 자립 지원</li><li>지역사회 복지자원 발굴 및 연계</li><li>시설 운영 및 행정업무</li><li>복지서비스 제공 및 사후관리</li></ul></Panel></>}
{tab==="qualification" && <><Panel title="사회복지사 2급 자격요건"><p>일반적인 신규 취득자는 전문학사 이상 학력과 사회복지 관련 17과목 이수 요건을 충족해야 합니다.</p><Table rows={[["고등학교 졸업","전문학사 이상 학위 및 법정 교과목 이수"],["대학교 중퇴","기존 학점 활용 가능 여부 확인 후 학위 및 교과목 요건 충족"],["전문대학교 졸업","법정 교과목 이수"],["4년제 대학교 졸업","법정 교과목 이수"],["비전공 대학 졸업","기존 전공과 관계없이 법정 교과목 이수"]]}/><p>기존 인정 교과목이 있다면 추가 이수과목이 달라질 수 있습니다.</p></Panel><Panel title="사회복지사 1급과 2급의 차이"><Table rows={[["2급","학력 및 교과목 요건 충족, 별도 국가시험 없음"],["1급","응시자격 충족 후 국가시험 합격"],["실무경력","1급 응시자격에 따라 필요할 수 있음"]]}/><p>2급도 교과목별 평가와 현장실습을 정상적으로 이수해야 합니다.</p></Panel></>}
{tab==="education" && <><Panel title="교육과정별 취득방법"><Table rows={[["일반대학교","대학 교육과정"],["전문대학교","전문학사 과정과 자격요건 병행"],["사이버대학교","온라인 중심 대학 교육과정"],["방송통신대학교","원격교육 중심 대학 교육과정"],["학점은행제","기존 학력 및 이수학점 활용"]]}/><p>기관별 자격 관련 교과목 개설 여부를 확인해야 합니다.</p></Panel><Panel title="사회복지 관련 이수과목"><Table rows={[["필수","10과목 / 30학점"],["선택","7과목 / 21학점"],["합계","17과목 / 51학점"]]}/><h3>필수과목</h3><p>사회복지학개론, 인간행동과사회환경, 사회복지실천론, 사회복지실천기술론, 사회복지정책론, 사회복지행정론, 사회복지조사론, 사회복지법제와실천, 지역사회복지론, 사회복지현장실습</p><h3>선택과목 예시</h3><p>노인복지론, 아동복지론, 장애인복지론, 가족복지론, 정신건강론, 자원봉사론, 청소년복지론 등</p></Panel><Panel title="사회복지현장실습"><Table rows={[["기관실습","160시간 이상"],["실습세미나","30시간 이상"],["실습기관","보건복지부장관이 선정한 기관실습 실시기관"],["진행조건","교육기관별 선이수과목 등 충족"]]}/><p className="swi-callout">2020년 개정 이후 일반적인 신규 학습자 기준이며 기존 이수 이력에 따라 종전 기준이 적용될 수 있습니다.</p></Panel><Panel title="학점은행제 취득절차"><div className="swi-process">{["최종학력 및 기존 학점 확인","학습설계 및 수강신청","이론 교과목 이수","현장실습","학습자등록 및 학점인정","학위 취득(필요한 경우)","자격증 신청"].map((s,i)=><p key={s}><b>{i+1}</b>{s}</p>)}</div><a className="swi-primary" href="/social-worker-guide">사회복지사 2급 취득가이드 →</a></Panel></>}
{tab==="certificate" && <><Panel title="자격증 발급기관"><p>자격증은 수업을 이수한 대학교나 평생교육원에서 직접 발급하는 것이 아닙니다. 자격요건을 충족한 뒤 한국사회복지사협회 자격관리 절차에 따라 신청하고 심사를 거쳐 발급받습니다.</p></Panel><Panel title="자격증 발급절차"><div className="swi-process">{["학력 및 교과목 요건 충족","자격관리센터 접속","발급신청서 작성","구비서류 제출 및 수수료 납부","자격심사","자격증 발급"].map((s,i)=><p key={s}><b>{i+1}</b>{s}</p>)}</div></Panel><Panel title="주요 구비서류"><Table rows={[["발급신청서","자격관리센터 작성"],["학위·졸업증명서","학력 확인"],["성적증명서","교과목 이수 확인"],["실습확인서","현장실습 이수 확인"],["사진","자격증 발급용"]]}/><p>제출서류 및 수수료는 개인별 이수과정과 신청 시점의 협회 안내를 확인하세요.</p><a className="swi-textlink" href="https://www.welfare.net/lic/" target="_blank" rel="noreferrer">한국사회복지사협회 자격관리 안내 ↗</a><br/><a className="swi-textlink" href="https://www.cb.or.kr/" target="_blank" rel="noreferrer">국가평생교육진흥원 학점은행제 ↗</a><br/><a className="swi-textlink" href="https://www.mohw.go.kr/" target="_blank" rel="noreferrer">보건복지부 ↗</a></Panel></>}
{tab==="career" && <><Panel title="분야별 주요 취업처"><Table rows={[["노인복지","노인복지관, 요양원, 주간보호센터, 재가복지센터 — 상담 및 프로그램 운영"],["아동복지","지역아동센터, 아동복지시설 — 보호 및 교육 지원"],["청소년복지","청소년쉼터 등 — 보호 및 자립 지원"],["장애인복지","복지관, 거주시설, 직업재활시설 — 생활 및 재활 지원"],["지역사회복지","종합사회복지관 — 사례관리 및 지역복지사업"],["가족복지","가족센터 등 — 가족지원 및 서비스 연계"],["정신건강복지","정신건강복지센터 등 — 사회복귀 지원"],["의료사회복지","병원 등 — 환자 및 가족 지원"],["공공복지","지자체, 공공기관 — 복지행정 및 사업"]]}/><p className="swi-callout">기관과 직무에 따라 1급, 전문자격, 별도 시험 또는 경력이 필요할 수 있습니다.</p></Panel><Panel title="근무 형태"><ul><li>주 5일 상근 근무</li><li>교대 및 당직 근무</li><li>시간제 및 계약직 근무</li><li>방문 및 현장 업무</li><li>사무 및 행정 중심 업무</li></ul><p>관심 분야와 적성, 실제 채용조건을 함께 고려하세요.</p><a className="swi-primary" href="/employment-center?section=jobs">사회복지 일자리 찾기 →</a></Panel></>}
{tab==="salary" && <><Panel title="사회복지사의 급여체계"><p>급여는 시설 유형, 운영주체, 직급, 경력 및 근무지역에 따라 달라집니다. 보건복지부의 사회복지시설 종사자 인건비 가이드라인 적용 여부도 시설별로 다를 수 있습니다.</p><Table rows={[["시설 유형","복지관, 생활시설, 이용시설, 장기요양기관 등"],["직급","사회복지사, 선임, 팀장, 과장, 시설장 등"],["호봉","인정되는 실무경력"],["근무지역","지자체별 인건비 및 처우개선 지원"],["수당","시간외근무수당, 가족수당, 명절휴가비 등"],["근무 형태","상근, 교대, 시간제 등"]]}/><h3>호봉제란?</h3><p>인정되는 실무경력과 근무기간 등을 기준으로 기본급이 결정되는 급여체계입니다. 모든 시설이 동일한 호봉제를 운영하는 것은 아닙니다.</p></Panel><Panel title="사회복지사의 직업 전망"><p>고령화, 1인 가구 증가, 돌봄 수요 확대 등으로 복지서비스의 중요성이 높아지고 있습니다. 다만 분야별 채용 수요와 근무조건은 다르며 자격증만으로 취업이 보장되지는 않습니다.</p><h3>장점과 고려사항</h3><Table rows={[["장점","다양한 분야 진출, 비전공자 자격 취득, 경력을 통한 전문성 향상, 사회적 가치 실현"],["고려사항","시설별 처우 차이, 감정노동, 행정업무, 교대·당직 가능성"]]}/><a className="swi-primary" href="/employment-center?section=jobs">실제 채용정보 확인하기 →</a></Panel></>}
<section className="swi-panel"><button type="button" className="swi-primary" onClick={()=>index<tabs.length-1?changeTab(tabs[index+1].key):window.location.assign("/social-worker-guide")}>{index<tabs.length-1?tabs[index+1].title+" 알아보기":"사회복지사 2급 취득가이드"} →</button></section></main>
<div className="swi-fixed-consult">
  <button
    type="button"
    onClick={() => setConsultOpen(true)}
  >
    무료 상담 신청하기 →
  </button>
</div>

{consultOpen && (
  <div
    className="swi-consult-overlay"
    onClick={() => setConsultOpen(false)}
  >
    <div
      className="swi-consult-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="사회복지사 2급 무료 상담 신청"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="swi-consult-header">
        <strong>사회복지사 2급 무료 상담 신청</strong>

        <button
          type="button"
          onClick={() => setConsultOpen(false)}
          aria-label="상담 창 닫기"
        >
          ✕
        </button>
      </div>

      <iframe
  title="사회복지사 2급 상담 신청"
  src="/employment-center?section=consultation&embed=1"
  className="swi-consult-frame"
/>
    </div>
  </div>
)}

<footer className="swi-footer">사회복지 통합지원센터<br/>개인별 이수 이력과 기관별 기준에 따라 달라질 수 있습니다.</footer></div></div>;
}
const styles = `

.swi-estimate-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin: 24px 0;
}

.swi-estimate-card {
  padding: 24px 18px;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #fff;
  text-align: center;
}

.swi-estimate-card h3 {
  font-size: 17px;
  font-weight: 700;
  margin-bottom: 12px;
}

.swi-estimate-date {
  display: block;
  font-size: 27px;
  font-weight: 800;
  margin: 12px 0 4px;
  color: #175cd3;
}

.swi-estimate-card small {
  color: #667085;
}

@media (max-width: 600px) {
  .swi-estimate-grid {
    grid-template-columns: 1fr;
  }
}
.swi-root{min-height:100vh;background:#f5f7fa;color:#16263a;font-family:Pretendard,"Noto Sans KR",system-ui,sans-serif;word-break:keep-all}.swi-root *{box-sizing:border-box}.swi-header{height:56px;padding:0 18px;display:flex;justify-content:space-between;align-items:center;background:white;border-bottom:1px solid #e8edf3;font-weight:800;font-size:15px}.swi-header a{font-size:11px;color:#47647f;text-decoration:none;font-weight:500}.swi-shell{max-width:480px;margin:auto;background:white;min-height:100vh;box-shadow:0 0 20px #132c4710}.swi-cover{background:linear-gradient(130deg,#0e2948,#174e83);color:white;padding:38px 24px 36px;white-space:pre-line}.swi-cover small{font-size:12px;opacity:.8}.swi-cover h1{font-size:27px;line-height:1.42;letter-spacing:-1.1px;margin:14px 0;font-weight:800}.swi-cover p{font-size:13px;line-height:1.75;color:#e0eaf5;margin:0}.swi-tabs{display:grid;grid-template-columns:repeat(3,1fr);position:sticky;top:0;z-index:5;background:white;border-bottom:1px solid #e4eaf1}.swi-tabs button{border:0;background:white;color:#64748b;padding:16px 2px;font-size:14px;font-weight:700;cursor:pointer}.swi-tabs button.active{color:#1257a0;box-shadow:inset 0 -3px #1257a0}.swi-intro{padding:30px 22px 20px}.swi-eyebrow{font-size:12px;font-weight:800;color:#1764a7}.swi-root h2{font-size:21px;line-height:1.45;letter-spacing:-.6px;margin:10px 0 12px;font-weight:800}.swi-root p{font-size:14px;line-height:1.9;color:#4b5c6f;margin:0}.swi-toc{margin:4px 20px 18px;padding:17px 17px 8px;border:1px solid #e3eaf2;border-radius:13px;background:#fafcff}.swi-toc h3{font-size:15px;margin:0 0 9px}.swi-toc button{width:100%;display:flex;align-items:center;gap:12px;text-align:left;padding:13px 0;background:none;border:0;border-top:1px solid #e8edf3;color:#27394c;font-size:13px;cursor:pointer}.swi-toc button b{color:#2170b3;font-size:12px}.swi-toc button span:nth-child(2){flex:1}.swi-section{padding:34px 22px;border-bottom:9px solid #f5f7fa;scroll-margin-top:70px}.swi-section h3.swi-subtitle{font-size:14px;color:#426381;font-weight:700;margin:0 0 16px}.swi-note{background:#f3f7fc;border-radius:8px;padding:12px;margin-top:16px!important;font-size:12px!important}.swi-textlink{display:inline-block;color:#1265b0;font-weight:700;font-size:13px;margin-top:16px;text-decoration:none}.swi-incident{display:grid;gap:9px;margin-top:19px}.swi-incident article{display:flex;gap:14px;padding:15px;background:#fff7f7;border:1px solid #f7e2e2;border-radius:11px}.swi-incident article>b{color:#b53c42}.swi-incident h3{font-size:14px;margin:0 0 4px}.swi-incident p{font-size:12px;line-height:1.6}.swi-highlight{background:#eef5fd;color:#164775;font-size:14px;font-weight:700;line-height:1.8;border-radius:12px;padding:18px;margin-top:18px}.swi-image{border-radius:12px;overflow:hidden;background:#edf3f9;margin:17px 0;min-height:185px}.swi-image img{display:block;width:100%;height:auto;min-height:185px;object-fit:cover}.swi-placeholder{min-height:185px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:7px;color:#50718e;font-size:13px}.swi-placeholder small{font-size:10px;color:#8ca0b4}.swi-credentials{margin:17px 0;border:1px solid #e2eaf3;border-radius:11px;padding:12px 16px}.swi-credentials div{display:flex;justify-content:space-between;padding:8px 0;font-size:13px}.swi-credentials div+div{border-top:1px solid #edf1f5}.swi-credentials span{color:#64748b}.swi-primary{display:block;width:100%;text-align:center;background:#145a9d;color:white!important;border:0;border-radius:11px;padding:15px 12px;text-decoration:none;font-size:14px;font-weight:800;cursor:pointer}.swi-next{background:#102f50;color:white;padding:28px 22px 32px}.swi-next h2{font-size:18px;margin:0 0 17px}.swi-next .swi-primary{background:white;color:#124675!important}.swi-footer{padding:26px 20px 36px;text-align:center;color:#8a97a7;font-size:11px;line-height:1.9;background:#fafbfc}@media(min-width:520px){.swi-root{padding-bottom:40px}.swi-header{max-width:480px;margin:auto}.swi-shell{border-radius:0 0 16px 16px;overflow:clip}}
.swi-header{max-width:480px;margin:auto;font-size:18px;color:#102d53}.swi-cover{padding:0;background:#f1f6fc;white-space:normal}.swi-cover img{display:block;width:100%;height:auto}.swi-cover-other{padding:34px 22px;background:#123e70;color:white}.swi-cover-other h1{font-size:25px;margin:10px 0 0}.swi-tabs{top:0;z-index:40;box-shadow:0 3px 12px #102b4910}.swi-tabs button{font-size:15px;min-height:54px}.swi-tabs button.active{background:#103f79;color:white;box-shadow:none}.swi-shell{overflow:visible!important}.swi-guide{color:#102544}.swi-panel{padding:28px 20px;border-bottom:9px solid #f2f5fa;scroll-margin-top:65px}.swi-panel h2{font-size:23px;line-height:1.4;margin:0 0 14px}.swi-panel h3{font-size:18px;margin:22px 0 12px}.swi-panel p{font-size:16px;line-height:1.75;color:#344860}.swi-panel p strong{color:#0b4d96}.swi-compare{display:grid;grid-template-columns:minmax(0,1fr) 25px minmax(0,1fr);gap:6px;align-items:center;margin-top:20px}.swi-compare>div{background:#eef4fb;border-radius:12px;min-height:132px;padding:15px 10px;display:flex;flex-direction:column;justify-content:center;gap:9px}.swi-compare>strong{font-size:26px;text-align:center}.swi-compare b{font-size:16px}.swi-compare span{font-size:13px;line-height:1.55;color:#53667c}.swi-compare .primary{background:#103d79;color:white}.swi-compare .primary span{color:#e2ecfb}.swi-steps{display:grid;gap:8px;margin-top:19px}.swi-steps button{width:100%;display:flex;align-items:center;gap:14px;border:1px solid #dbe5f1;background:white;padding:12px;border-radius:10px;text-align:left}.swi-steps button b{background:#164b88;color:white;padding:9px;border-radius:6px}.swi-steps button strong{font-size:16px;flex:1}.swi-steps button span{font-size:12px;color:#53708e}.swi-kicker{display:block;color:#1263ad;font-size:13px;font-weight:800;margin-bottom:10px}.swi-fact{display:grid;grid-template-columns:104px minmax(0,1fr);gap:10px;padding:15px 0;border-bottom:1px solid #e2eaf3}.swi-fact b{color:#13467d;font-size:15px}.swi-fact span{font-size:15px;line-height:1.65;color:#344860}.swi-callout{background:#edf4fc;padding:16px;border-radius:10px;margin-top:18px!important;font-size:14px!important}.swi-process{display:grid;gap:9px}.swi-process p{display:flex;gap:12px;align-items:start;font-size:15px}.swi-process b{display:inline-grid;place-items:center;width:27px;height:27px;border-radius:50%;background:#e6f0fd;color:#15569c;flex:none}.swi-important{background:#103d79;color:#e5f1ff;text-align:center;border-radius:12px;padding:18px 12px;margin-top:18px;font-size:14px;line-height:1.85}.swi-important strong{color:white;font-size:17px}.swi-period,.swi-eligibility{display:grid;gap:8px;border:1px solid #dbe5f2;border-radius:12px;padding:17px;margin-top:12px}.swi-period b,.swi-eligibility b{color:#13467d;font-size:16px}.swi-period strong,.swi-eligibility strong{font-size:16px}.swi-period span,.swi-eligibility span{font-size:14px;color:#50657c;line-height:1.6}.swi-conclusion{background:#f0f5fb}.swi-guide .swi-section{padding:28px 20px}.swi-guide .swi-estimate-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:18px 0}.swi-guide .swi-estimate-card{padding:18px 7px;background:#edf5ff}.swi-guide .swi-estimate-card:nth-child(2){background:#e8f8f1}.swi-guide .swi-estimate-card h3{font-size:15px}.swi-guide .swi-estimate-date{font-size:clamp(19px,5.5vw,27px);white-space:nowrap}.swi-guide .swi-estimate-card p{font-size:12px}.swi-guide .swi-estimate-card .swi-note{font-size:11px!important;padding:7px}@media(max-width:370px){.swi-fact{grid-template-columns:86px 1fr}.swi-steps button{gap:8px}.swi-steps button strong{font-size:14px}.swi-steps button span{font-size:11px}}
/* 교육원 서비스 모바일 전용 */
.swi-service {
  background: #fff;
}


.swi-service-section {
padding: 30px 20px;
border-bottom: 8px solid #f3f6fa;
}

.swi-service-section h2 {
font-size: 23px;
line-height: 1.42;
letter-spacing: -0.7px;
margin: 10px 0 14px;
color: #102544;
}

.swi-service-section h3 {
font-size: 18px;
margin: 24px 0 12px;
color: #102544;
}

.swi-service-section p {
font-size: 16px;
line-height: 1.8;
color: #40536b;
margin: 0 0 13px;
}

.swi-service-section .swi-image {
min-height: 0;
margin: 18px 0;
border-radius: 13px;
background: #f4f7fb;
}

.swi-service-section .swi-image img {
width: 100%;
height: auto;
min-height: 0;
display: block;
object-fit: contain;
}

.swi-service-note {
font-size: 12px !important;
color: #77869a !important;
line-height: 1.6 !important;
}

.swi-service-message {
padding: 18px;
background: #f1f6fc;
border-left: 4px solid #1766b2;
border-radius: 8px;
margin-top: 20px;
}

.swi-service-message strong {
font-size: 17px;
line-height: 1.55;
color: #103d79;
}

.swi-service-message p {
font-size: 14px;
margin: 10px 0 0;
}

.swi-service-solution {
padding-top: 22px;
}

.swi-service-points {
margin: 20px 0;
border-top: 1px solid #e2e9f2;
}

.swi-service-points div {
display: flex;
gap: 15px;
align-items: center;
padding: 14px 0;
border-bottom: 1px solid #e2e9f2;
}

.swi-service-points b {
color: #1766b2;
font-size: 14px;
min-width: 24px;
}

.swi-service-points span {
font-size: 15px;
font-weight: 650;
color: #243b55;
}

.swi-service-link {
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

.swi-service-faq {
margin-top: 18px;
border-top: 1px solid #e1e8f1;
}

.swi-service-faq details {
border-bottom: 1px solid #e1e8f1;
padding: 17px 2px;
}

.swi-service-faq summary {
cursor: pointer;
font-size: 16px;
font-weight: 700;
color: #182e4b;
line-height: 1.6;
}

.swi-service-faq details p {
font-size: 14px;
margin-top: 12px;
}

@media (max-width: 370px) {
.swi-service-section {
padding: 25px 16px;
}

.swi-service-section h2 {
font-size: 21px;
}
}
.swi-reviews {
background: #fff;
color: #102544;
}

.swi-review-hero img {
display: block;
width: 100%;
height: auto;
}

.swi-review-kicker {
display: inline-block;
color: #1767d6;
font-size: 11px;
font-weight: 850;
letter-spacing: 1.1px;
margin-bottom: 9px;
}

.swi-review-section-heading {
margin-bottom: 23px;
}

.swi-review-section-heading h2 {
font-size: 23px;
font-weight: 850;
letter-spacing: -0.9px;
line-height: 1.35;
margin: 0 0 9px;
color: #0d2850;
}

.swi-review-section-heading p {
font-size: 14px;
color: #66788e;
line-height: 1.7;
}

.swi-review-stats-section {
padding: 32px 20px 30px;
background: linear-gradient(180deg, #f5f9ff, #fff);
}

.swi-review-stats {
display: grid;
grid-template-columns: repeat(2, minmax(0, 1fr));
gap: 11px;
}

.swi-review-stats article {
display: flex;
flex-direction: column;
align-items: flex-start;
gap: 8px;
background: #fff;
border: 1px solid #dce8f9;
border-radius: 17px;
padding: 20px 15px;
box-shadow: 0 5px 20px rgba(20, 72, 130, .05);
}

.swi-review-stats article > span {
font-size: 13px;
font-weight: 750;
color: #536c89;
}

.swi-review-stats article > strong {
font-size: clamp(20px, 5.5vw, 28px);
font-weight: 900;
color: #1267df;
letter-spacing: -1px;
}

.swi-review-stats article > small {
font-size: 11px;
color: #8898aa;
}

.swi-review-stat-note {
margin-top: 13px !important;
font-size: 11px !important;
color: #8995a5 !important;
}

.swi-review-gallery {
padding: 35px 14px 32px;
border-top: 8px solid #f3f6fb;
}

.swi-review-gallery .swi-review-section-heading {
padding: 0 6px;
}

.swi-review-gallery-image {
overflow: hidden;
border-radius: 15px;
border: 1px solid #e1eaf6;
background: #edf5ff;
}

.swi-review-gallery-image img {
display: block;
width: 100%;
height: auto;
}

.swi-review-disclaimer {
font-size: 11px !important;
line-height: 1.65 !important;
color: #8492a4 !important;
padding: 13px 6px 0;
}

.swi-review-check {
padding: 36px 21px;
background: linear-gradient(145deg, #103d7c, #075db6);
color: #fff;
}

.swi-review-check .swi-review-kicker {
color: #9ed3ff;
}

.swi-review-check h2 {
color: #fff;
font-size: 25px;
line-height: 1.4;
letter-spacing: -1px;
margin: 0 0 14px;
}

.swi-review-check h2 em {
font-style: normal;
color: #ffe06b;
}

.swi-review-check > p {
color: #dcecff;
font-size: 14px;
line-height: 1.85;
}

.swi-review-check-items {
display: grid;
gap: 9px;
margin: 24px 0;
}

.swi-review-check-items div {
display: flex;
align-items: center;
gap: 10px;
padding: 12px 13px;
background: rgba(255,255,255,.09);
border: 1px solid rgba(255,255,255,.14);
border-radius: 11px;
font-size: 13px;
font-weight: 650;
}

.swi-review-check-items span {
display: grid;
place-items: center;
width: 23px;
height: 23px;
flex: none;
border-radius: 50%;
background: #fff;
color: #1766d2;
font-weight: 900;
}

.swi-review-service-btn {
width: 100%;
border: 0;
border-radius: 12px;
background: #fff;
color: #104c94;
font-size: 15px;
font-weight: 850;
padding: 17px 14px;
display: flex;
align-items: center;
justify-content: center;
gap: 10px;
cursor: pointer;
}

.swi-review-service-btn span {
font-size: 20px;
}

.swi-review-developer {
padding: 40px 20px 35px;
background: #f8faff;
}

.swi-review-story {
padding: 22px 0;
border-bottom: 1px solid #dfe8f4;
}

.swi-review-story-number {
font-size: 11px;
font-weight: 850;
color: #2375d9;
letter-spacing: .7px;
margin-bottom: 11px;
}

.swi-review-story h3 {
margin: 0 0 14px;
color: #102d55;
font-size: 19px;
font-weight: 850;
letter-spacing: -.6px;
line-height: 1.5;
}

.swi-review-story p {
margin-bottom: 12px;
color: #4c6079;
font-size: 14px;
line-height: 1.9;
}

.swi-review-story-featured {
margin: 20px -5px 0;
padding: 23px 17px;
background: #eaf3ff;
border: 1px solid #d4e6fc;
border-radius: 16px;
}

.swi-review-story-featured h3 span {
color: #1168d4;
}

.swi-review-built {
margin-top: 28px;
padding: 23px 16px 12px;
background: #fff;
border: 1px solid #e0eaf6;
border-radius: 17px;
box-shadow: 0 8px 24px rgba(17,67,123,.04);
}

.swi-review-built h3 {
margin: 0 0 17px;
font-size: 17px;
color: #102c54;
}

.swi-review-built > div {
display: grid;
grid-template-columns: 26px minmax(0,1fr);
gap: 3px 10px;
padding: 14px 0;
border-top: 1px solid #edf1f7;
}

.swi-review-built b {
grid-row: span 2;
font-size: 12px;
color: #2475d9;
}

.swi-review-built span {
font-size: 14px;
font-weight: 800;
color: #183654;
}

.swi-review-built small {
font-size: 12px;
color: #78899b;
line-height: 1.6;
}

.swi-review-philosophy {
margin-top: 24px;
padding: 24px 20px;
background: #103e7d;
color: #fff;
border-radius: 17px;
}

.swi-review-philosophy strong {
display: block;
font-size: 17px;
line-height: 1.75;
letter-spacing: -.4px;
}

.swi-review-philosophy p {
color: #d9e9ff;
margin-top: 13px;
font-size: 13px;
line-height: 1.85;
}

.swi-review-author {
margin-top: 22px;
padding: 25px 20px;
background: #fff;
border: 1px solid #dce7f5;
border-radius: 17px;
text-align: left;
}

.swi-review-author > span {
font-size: 12px;
font-weight: 800;
color: #2671c6;
}

.swi-review-author h3 {
margin: 8px 0 12px;
font-size: 25px;
letter-spacing: -.8px;
color: #0c2c56;
}

.swi-review-author h3 small {
font-size: 14px;
color: #526a84;
font-weight: 650;
}

.swi-review-author a {
display: inline-block;
color: #1269cf;
font-size: 19px;
font-weight: 850;
text-decoration: none;
margin-bottom: 13px;
}

.swi-review-author p {
font-size: 13px;
color: #63778c;
line-height: 1.8;
}

@media (max-width: 370px) {
.swi-review-stats-section,
.swi-review-developer {
padding-left: 16px;
padding-right: 16px;
}

.swi-review-check {
padding-left: 17px;
padding-right: 17px;
}

.swi-review-section-heading h2 {
font-size: 21px;
}

.swi-review-check h2 {
font-size: 23px;
}
}

/* =========================================
   실제 이용후기 - 모바일 리디자인
   기존 CSS 맨 아래에 추가
========================================= */

.swi-reviews {
  background: #ffffff;
  color: #102544;
  overflow: hidden;
}

/* 상단 이미지 배너 */
.swi-review-hero {
  width: 100%;
  background: #eef5ff;
  overflow: hidden;
}

.swi-review-hero img {
  display: block;
  width: 100%;
  height: auto;
}

/* 공통 제목 */
.swi-review-section-heading {
  margin-bottom: 22px;
}

.swi-review-kicker {
  display: inline-flex;
  align-items: center;
  margin-bottom: 10px;
  color: #1769d6;
  font-size: 11px;
  font-weight: 850;
  letter-spacing: 1.3px;
}

.swi-review-section-heading h2 {
  margin: 0 0 10px;
  font-size: 24px;
  font-weight: 850;
  line-height: 1.4;
  letter-spacing: -1px;
  color: #0d2850;
}

.swi-review-section-heading p {
  margin: 0;
  font-size: 14px;
  line-height: 1.8;
  color: #697c92;
}

/* =========================================
   01. 수강생 실제 후기
========================================= */

.swi-review-gallery {
  padding: 38px 18px 36px;
  background: linear-gradient(
    180deg,
    #ffffff 0%,
    #f3f8ff 100%
  );
  border-top: 0;
}

.swi-review-gallery .swi-review-section-heading {
  padding: 0 3px;
}

.swi-review-gallery-image {
  overflow: hidden;
  border-radius: 17px;
  border: 1px solid #dce8f8;
  background: #ffffff;
  box-shadow: 0 10px 30px rgba(16, 61, 121, 0.08);
}

.swi-review-gallery-image img {
  display: block;
  width: 100%;
  height: auto;
}

.swi-review-disclaimer {
  padding: 15px 3px 0;
  margin: 0;
  font-size: 11px !important;
  line-height: 1.7 !important;
  color: #8796a9 !important;
}

/* =========================================
   02. 실제 관리 서비스 확인
========================================= */

.swi-review-check {
  position: relative;
  padding: 42px 22px 40px;
  background: linear-gradient(
    145deg,
    #0a2852 0%,
    #103e7e 55%,
    #1465bd 100%
  );
  color: #ffffff;
  overflow: hidden;
}

.swi-review-check::before {
  content: "";
  position: absolute;
  width: 230px;
  height: 230px;
  right: -120px;
  top: -115px;
  border-radius: 50%;
  background: rgba(255,255,255,0.05);
  pointer-events: none;
}

.swi-review-check .swi-review-kicker {
  position: relative;
  color: #9bcaff;
}

.swi-review-check h2 {
  position: relative;
  margin: 0 0 17px;
  font-size: 26px;
  font-weight: 850;
  line-height: 1.45;
  letter-spacing: -1px;
  color: #ffffff;
}

.swi-review-check h2 em {
  font-style: normal;
  color: #ffe16b;
}

.swi-review-check > p {
  position: relative;
  font-size: 14px;
  line-height: 1.9;
  color: #dceaff;
}

.swi-review-check-items {
  position: relative;
  display: grid;
  gap: 10px;
  margin: 26px 0;
}

.swi-review-check-items div {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 49px;
  padding: 12px 13px;
  border: 1px solid rgba(255,255,255,0.16);
  border-radius: 12px;
  background: rgba(255,255,255,0.08);
  color: #ffffff;
  font-size: 13px;
  font-weight: 650;
  line-height: 1.5;
}

.swi-review-check-items span {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 25px;
  height: 25px;
  border-radius: 50%;
  background: #ffffff;
  color: #1464c4;
  font-size: 14px;
  font-weight: 900;
}

.swi-review-service-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 18px 19px;
  border: none;
  border-radius: 13px;
  background: #ffffff;
  color: #104887;
  font-size: 15px;
  font-weight: 850;
  box-shadow: 0 6px 20px rgba(0,0,0,0.12);
  cursor: pointer;
}

.swi-review-service-btn span {
  font-size: 21px;
  line-height: 1;
}

/* =========================================
   03. 개발자 이야기
========================================= */

.swi-review-developer {
  padding: 46px 20px 42px;
  background: #f7faff;
}

.swi-review-developer > .swi-review-section-heading {
  padding-bottom: 23px;
  margin-bottom: 5px;
  border-bottom: 1px solid #dfe8f5;
}

.swi-review-story {
  position: relative;
  padding: 28px 2px;
  border-bottom: 1px solid #e0e8f2;
}

.swi-review-story-number {
  display: inline-block;
  margin-bottom: 12px;
  color: #176bd5;
  font-size: 11px;
  font-weight: 850;
  letter-spacing: 0.6px;
}

.swi-review-story h3 {
  margin: 0 0 16px;
  color: #102d55;
  font-size: 20px;
  font-weight: 850;
  line-height: 1.5;
  letter-spacing: -0.7px;
}

.swi-review-story p {
  margin: 0 0 13px;
  color: #4b6079;
  font-size: 14px;
  line-height: 1.95;
}

.swi-review-story p:last-child {
  margin-bottom: 0;
}

/* 직접 개발 강조 카드 */
.swi-review-story-featured {
  margin: 24px 0 0;
  padding: 26px 21px;
  border: 1px solid #cbdfff;
  border-radius: 19px;
  background: linear-gradient(
    145deg,
    #e7f2ff,
    #f7fbff
  );
  box-shadow: 0 8px 24px rgba(19,91,181,0.06);
}

.swi-review-story-featured h3 {
  font-size: 21px;
  line-height: 1.55;
}

.swi-review-story-featured h3 span {
  color: #1266d2;
}

/* =========================================
   04. 직접 개발한 4가지 시스템
========================================= */

.swi-review-built {
  margin-top: 27px;
  padding: 24px 17px 10px;
  border: 1px solid #dce7f5;
  border-radius: 19px;
  background: #ffffff;
  box-shadow: 0 8px 26px rgba(15,63,120,0.05);
}

.swi-review-built h3 {
  margin: 0 0 17px;
  color: #102d55;
  font-size: 18px;
  font-weight: 850;
  letter-spacing: -0.5px;
}

.swi-review-built > div {
  display: grid;
  grid-template-columns: 31px minmax(0,1fr);
  column-gap: 11px;
  row-gap: 4px;
  padding: 16px 0;
  border-top: 1px solid #edf1f7;
}

.swi-review-built b {
  grid-row: span 2;
  display: grid;
  place-items: center;
  align-self: start;
  width: 28px;
  height: 28px;
  border-radius: 9px;
  background: #e9f2ff;
  color: #176bd6;
  font-size: 11px;
  font-weight: 850;
}

.swi-review-built span {
  color: #153454;
  font-size: 15px;
  font-weight: 850;
}

.swi-review-built small {
  color: #75879b;
  font-size: 12px;
  line-height: 1.65;
}

/* =========================================
   05. 개발 철학
========================================= */

.swi-review-philosophy {
  position: relative;
  margin-top: 26px;
  padding: 29px 22px;
  border-radius: 19px;
  background: linear-gradient(
    135deg,
    #123f80,
    #08274e
  );
  color: #ffffff;
  overflow: hidden;
}

.swi-review-philosophy::before {
  content: "“";
  position: absolute;
  top: -16px;
  right: 15px;
  color: rgba(255,255,255,0.09);
  font-size: 125px;
  font-family: Georgia, serif;
  line-height: 1;
}

.swi-review-philosophy strong {
  position: relative;
  display: block;
  font-size: 18px;
  font-weight: 850;
  line-height: 1.8;
  letter-spacing: -0.5px;
  color: #ffffff;
}

.swi-review-philosophy p {
  position: relative;
  margin-top: 17px;
  color: #d4e7ff;
  font-size: 13px;
  line-height: 1.9;
}

/* =========================================
   06. 개발자 연락처
========================================= */

.swi-review-author {
  margin-top: 24px;
  padding: 28px 23px;
  border: 1px solid #dce6f4;
  border-radius: 19px;
  background: #ffffff;
  box-shadow: 0 8px 26px rgba(17,67,123,0.05);
}

.swi-review-author > span {
  display: inline-block;
  color: #176bd3;
  font-size: 12px;
  font-weight: 800;
}

.swi-review-author h3 {
  margin: 12px 0 10px;
  color: #102d55;
  font-size: 26px;
  font-weight: 900;
  letter-spacing: -0.8px;
}

.swi-review-author h3 small {
  margin-left: 5px;
  color: #64768b;
  font-size: 14px;
  font-weight: 650;
}

.swi-review-author a {
  display: inline-block;
  margin-bottom: 18px;
  color: #176bd3;
  font-size: 20px;
  font-weight: 850;
  text-decoration: none;
  letter-spacing: -0.4px;
}

.swi-review-author p {
  padding-top: 16px;
  border-top: 1px solid #e8eef6;
  color: #60748b;
  font-size: 13px;
  line-height: 1.9;
}

/* 작은 모바일 대응 */
@media (max-width: 370px) {
  .swi-review-gallery {
    padding-left: 14px;
    padding-right: 14px;
  }

  .swi-review-check {
    padding: 36px 17px;
  }

  .swi-review-check h2 {
    font-size: 23px;
  }

  .swi-review-developer {
    padding: 38px 16px;
  }

  .swi-review-story h3 {
    font-size: 18px;
  }

  .swi-review-philosophy strong {
    font-size: 16px;
  }
}


/* 통합지원센터 브랜드 */
.swi-header .swi-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #102d53;
  font-size: 15px;
  font-weight: 850;
  text-decoration: none;
}

.swi-brand-icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  background: #145a9d;
  color: white;
  border-radius: 9px;
  font-size: 18px;
}

.swi-header .swi-home-link {
  font-size: 12px;
  color: #145a9d;
  font-weight: 750;
  white-space: nowrap;
}

/* 예상시기 공통 기준 */
.swi-basis-notice {
  margin-top: 18px;
  padding: 17px;
  background: #f1f6fd;
  border: 1px solid #dce8f7;
  border-radius: 12px;
}

.swi-basis-notice strong {
  display: block;
  color: #124b88;
  font-size: 15px;
  margin-bottom: 10px;
}

.swi-basis-notice p {
  font-size: 13px;
  line-height: 1.8;
  margin-top: 9px;
}

/* 하단 상담 버튼 */
.swi-root {
  padding-bottom: 90px;
}

.swi-fixed-consult {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 480px;
  z-index: 100;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  background: rgba(255,255,255,.97);
  border-top: 1px solid #e2e8f0;
  box-shadow: 0 -4px 18px rgba(0,0,0,.06);
}

.swi-fixed-consult button {
  width: 100%;
  border: 0;
  border-radius: 12px;
  background: #145a9d;
  color: white;
  font-size: 16px;
  font-weight: 800;
  padding: 15px;
  cursor: pointer;
}

/* 상담 팝업 */
.swi-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(15,23,42,.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.swi-modal {
  position: relative;
  width: 100%;
  max-width: 420px;
  background: white;
  border-radius: 18px;
  padding: 28px 22px;
  box-shadow: 0 20px 60px rgba(0,0,0,.2);
}

.swi-modal-close {
  position: absolute;
  right: 18px;
  top: 16px;
  border: 0;
  background: transparent;
  font-size: 20px;
  cursor: pointer;
}

.swi-modal p {
  font-size: 14px;
  line-height: 1.7;
}

.swi-consult-preparing {
  margin-top: 20px !important;
  padding: 14px;
  background: #f1f6fd;
  border-radius: 10px;
  text-align: center;
}

/* 사회복지 통합지원센터 상단 로고 */
.swi-header {
  height: 64px;
  max-width: 480px;
  margin: 0 auto;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #ffffff;
}

.swi-header .swi-brand {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  text-decoration: none;
}

.swi-brand-logo {
  display: block;
  width: auto;
  max-width: 220px;
  height: 42px;
  object-fit: contain;
  object-position: left center;
}

.swi-header .swi-home-link {
  flex-shrink: 0;
  margin-left: 12px;
  font-size: 12px;
  font-weight: 700;
  color: #145a9d;
  text-decoration: none;
}

@media (max-width: 370px) {
  .swi-brand-logo {
    max-width: 190px;
    height: 38px;
  }
}
/* 취득 가이드 상담 팝업 */
.swi-consult-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  background: rgba(15, 23, 42, 0.65);
}

.swi-consult-dialog {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 480px;
  height: min(90dvh, 800px);
  overflow: hidden;
  border-radius: 20px;
  background: #ffffff;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
}

.swi-consult-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  padding: 16px;
  border-bottom: 1px solid #e2e8f0;
  color: #102d53;
  font-size: 14px;
}

.swi-consult-header button {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: #f1f5f9;
  color: #475569;
  cursor: pointer;
}

.swi-consult-frame {
  display: block;
  flex: 1;
  width: 100%;
  min-height: 0;
  border: 0;
  background: white;
}

@media (max-width: 480px) {
  .swi-consult-overlay {
    padding: 8px;
  }

  .swi-consult-dialog {
    height: 92dvh;
    border-radius: 16px;
  }
}

.swi-tabs{grid-template-columns:repeat(3,minmax(0,1fr));}.swi-tabs button{font-size:13px;min-height:48px;padding:12px 2px}.swi-panel p+p{margin-top:12px}.swi-panel ul{padding-left:20px;list-style:disc;color:#344860;font-size:15px;line-height:1.9}.swi-panel .swi-image{aspect-ratio:16/9;min-height:0}.swi-panel .swi-image img{height:100%;min-height:0;object-fit:cover}.swi-panel .swi-placeholder{height:100%;min-height:0}.swi-table{width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;line-height:1.65;table-layout:fixed}.swi-table th,.swi-table td{border:1px solid #dbe5f2;padding:12px 9px;text-align:left;vertical-align:top;overflow-wrap:anywhere}.swi-table th{background:#edf4fc;color:#13467d;width:32%}.swi-root .swi-footer{padding-bottom:110px}.swi-root .swi-panel h2{color:#102544}.swi-root .swi-panel h3{color:#13467d}.swi-root .swi-panel a{overflow-wrap:anywhere}@media(min-width:768px){.swi-root .swi-shell,.swi-root .swi-header{max-width:900px}.swi-root .swi-tabs{grid-template-columns:repeat(6,minmax(0,1fr))}.swi-root .swi-fixed-consult{max-width:900px}.swi-root .swi-panel{padding:32px 36px}.swi-root .swi-panel .swi-image{max-height:340px}}
`;