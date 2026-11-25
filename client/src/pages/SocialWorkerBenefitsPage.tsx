import { useMemo, useState, useEffect, type ReactNode } from 'react';
import { Link } from 'wouter';
import { guides, assess, type Guide, type Category, type Profile } from './socialWorkerBenefitsData';
const categories: ('전체'|Category)[]=['전체',...Array.from(new Set(guides.map(g=>g.category)))];
const key='welfare-benefits-checklist-v5';
const input='rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm';
function readChecks():Record<string,number[]>{try{const v=JSON.parse(localStorage.getItem(key)||'{}');return v && typeof v==='object'&&!Array.isArray(v)?v:{};}catch{return {};}}
function currentId(){return new URLSearchParams(window.location.search).get('guide');}
export default function SocialWorkerBenefitsPage(){
 const [category,setCategory]=useState<typeof categories[number]>('전체');
 const [query,setQuery]=useState('');
 const [id,setId]=useState(currentId);
 const [checks,setChecks]=useState(readChecks);
 const [profile,setProfile]=useState<Profile>({certificate:'unknown',degree:'unknown',career:''});
 const [copied,setCopied]=useState(false);
 const selected=guides.find(g=>g.id===id);
 useEffect(()=>{const sync=()=>{setId(currentId());setCopied(false);};window.addEventListener('popstate',sync);return()=>window.removeEventListener('popstate',sync);},[]);
 useEffect(()=>{try{localStorage.setItem(key,JSON.stringify(checks));}catch{}},[checks]);
 const results=useMemo(()=>{const tokens=query.toLowerCase().trim().split(/\s+/).filter(Boolean);return guides.filter(g=>(category==='전체'||g.category===category)&&tokens.every(t=>[g.title,g.summary,g.condition,g.category,...g.steps,...(g.details||[]).flat()].join(' ').toLowerCase().includes(t)));},[category,query]);
 function open(g:Guide|null){const u=new URL(window.location.href);if(g)u.searchParams.set('guide',g.id);else u.searchParams.delete('guide');window.history.pushState(null,'',u);setId(g?.id||null);setCopied(false);window.scrollTo(0,0);}
 const checked=selected&&Array.isArray(checks[selected.id])?[...new Set(checks[selected.id].filter(i=>Number.isInteger(i)&&i>=0&&i<selected.steps.length))]:[];
 return <main className="min-h-screen bg-slate-50 text-slate-900"><div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
 <Link href="/employment-center" className="text-sm text-slate-600 hover:underline">← 사회복지통합지원센터</Link>
 <header className="my-6"><p className="text-sm font-bold text-blue-700">자격증 활용백과</p><h1 className="mt-2 text-2xl font-black sm:text-4xl">사회복지사 자격증·학위 활용백과</h1><p className="mt-3 text-sm text-slate-600">교육시간 단축 · 국가시험 · 전문자격 · 복지시설 창업</p></header>
 <p className="mb-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">법정 활용 경로 안내입니다. 법령 개정 및 개별 심사에 따라 적용 기준이 달라질 수 있습니다. 시설 계약 전 관할 지자체와 현행 기준을 확인하세요.</p>
 <section className="mb-5 rounded-2xl border bg-white p-4"><h2 className="font-bold">내 조건으로 활용 가능성 확인</h2><p className="my-2 text-xs text-slate-500">입력값은 서버로 전송하지 않습니다. 결과는 사회복지사 활용 경로에 한정한 참고 안내입니다.</p><div className="grid gap-3 sm:grid-cols-3"><label className="grid gap-1 text-xs">보유 자격<select className={input} value={profile.certificate} onChange={e=>setProfile(p=>({...p,certificate:e.target.value as Profile['certificate']}))}><option value="unknown">선택</option><option value="none">미보유</option><option value="2">사회복지사 2급</option><option value="1">사회복지사 1급</option></select></label>
<label className="grid gap-1 text-xs">
  최종학위
  <select
    className={input}
    value={profile.degree}
    onChange={e =>
      setProfile(p => ({
        ...p,
        degree: e.target.value as Profile['degree']
      }))
    }
  >
    <option value="unknown">선택</option>
    <option value="socialBachelor">사회복지학 학사</option>
    <option value="other">기타 학력</option>
  </select>
</label>
<label className="grid gap-1 text-xs">장애인재활 관련 재직경력(년)<input className={input} type="number" min="0" max="80" step="0.1" value={profile.career} onChange={e=>setProfile(p=>({...p,career:e.target.value}))}/></label></div></section>
 {selected?<article className="rounded-2xl border bg-white p-5 sm:p-8"><div className="flex flex-wrap justify-between gap-3"><button onClick={()=>open(null)} className="text-sm font-bold text-blue-700">← 가이드 목록</button><button className="text-sm text-blue-700" onClick={async()=>{try{await navigator.clipboard.writeText(window.location.href);setCopied(true);}catch{setCopied(false);}}}>{copied?'복사 완료':'가이드 링크 복사'}</button></div><p className="mt-5 text-xs text-slate-500">{selected.category}</p><h2 className="mt-2 text-3xl font-black">{selected.title}</h2><p className="my-3 font-bold text-blue-700">{selected.summary}</p><p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800">{assess(selected,profile)}</p>
 {selected.hours&&<div className="my-5 rounded-xl bg-slate-50 p-4"><div className="grid grid-cols-2 gap-3">{selected.hours.map((h,i)=><div key={i}><p className="text-xs text-slate-500">{i?'사회복지사 경로':'일반 과정'}</p><p className="text-3xl font-black">{h}시간</p></div>)}</div><p className="mt-3 font-bold text-blue-700">{selected.hours[0]-selected.hours[1]}시간 단축 · {Math.round(100*(1-selected.hours[1]/selected.hours[0]))}% 절감</p></div>}
 <Section title="적용 조건">{selected.condition}</Section>{selected.details&&<Section title="상세 기준"><dl className="divide-y">{selected.details.map(([k,v])=><div key={k} className="py-3"><dt className="font-bold">{k}</dt><dd className="mt-1">{v}</dd></div>)}</dl></Section>}
 <Section title="진행 절차 및 준비 체크리스트"><div className="flex justify-between"><p>{checked.length} / {selected.steps.length} 완료 · 이 기기에 저장</p><button onClick={()=>setChecks(old=>({...old,[selected.id]:[]}))} className="text-blue-700">초기화</button></div><progress className="my-3 w-full" value={checked.length} max={selected.steps.length}/><ol className="space-y-3">{selected.steps.map((s,i)=><li key={i}><label className="flex gap-3"><input type="checkbox" checked={checked.includes(i)} onChange={e=>{const on=e.target.checked;setChecks(old=>({...old,[selected.id]:on?[...checked,i]:checked.filter(n=>n!==i)}));}}/><span>{i+1}. {s}</span></label></li>)}</ol></Section>
 {([['준비서류',selected.documents],['주의사항',selected.cautions]] as const).map(([title,items])=><Section key={title} title={title}><ul className="list-disc space-y-2 pl-5">{items.map((s,i)=><li key={i}>{s}</li>)}</ul></Section>)}
 <Section title="자주 묻는 질문">{selected.faq?.map(f=><details key={f.q} className="mb-2 rounded-xl border p-3"><summary className="cursor-pointer font-bold">{f.q}</summary><p className="mt-2">{f.a}</p></details>)}</Section><Section title="공식 근거 및 신청처"><p className="mb-3 text-xs">{selected.verified?`핵심 기준 확인일: ${selected.verified}`:'공식 원문 및 적용 기준 확인'}</p>{selected.sources.map(s=><a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="mb-2 block rounded-xl border p-3 text-blue-700">{s.label} ↗</a>)}</Section></article>:<><input aria-label="가이드 검색" className={input+' w-full'} value={query} onChange={e=>setQuery(e.target.value)} placeholder="자격증, 시설, 활용 조건 검색"/><nav className="my-4 flex flex-wrap gap-2">{categories.map(c=><button key={c} aria-pressed={category===c} onClick={()=>setCategory(c)} className={'rounded-full border px-3 py-2 text-sm '+(category===c?'bg-blue-700 text-white':'bg-white')}>{c}</button>)}</nav><p className="mb-3 text-xs text-slate-500">총 {results.length}개 가이드</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{results.map(g=><button key={g.id} onClick={()=>open(g)} className="flex flex-col items-start rounded-2xl border bg-white p-5 text-left hover:border-blue-500"><span className="text-xs text-slate-500">{g.category} · {g.verified?'핵심 기준 확인':'조건별 확인'}</span><h2 className="mt-2 text-lg font-black">{g.title}</h2><p className="my-2 font-bold text-blue-700">{g.summary}</p><p className="mb-3 text-sm text-slate-600">{g.condition}</p><p className="mb-4 text-xs text-blue-800">{assess(g,profile)}</p><span className="mt-auto w-full border-t pt-3 text-sm font-bold">상세 가이드 보기 →</span></button>)}</div>{!results.length&&<p className="py-10 text-center text-sm">검색 결과가 없습니다.</p>}</>}
 </div></main>;
}
function Section({title,children}:{title:string;children:ReactNode}){return <section className="mt-6 border-t pt-5"><h3 className="mb-3 text-lg font-black">{title}</h3><div className="text-sm leading-6 text-slate-700">{children}</div></section>}
