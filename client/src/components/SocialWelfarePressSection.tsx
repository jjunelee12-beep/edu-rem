import { ExternalLink } from "lucide-react";

type PressArticle = {
  id: string;
  title: string;
  date: string;
  url: string;
};

const PRESS_ARTICLES: PressArticle[] = [
  {
    id: "welfare-center",
    title: "위드웨이브, '사회복지 통합지원센터' 구축… 자격증 취득부터 취업까지 원스톱 지원",
    date: "2026.11.25",
    url: "https://www.startuptimes.kr/article/위드웨이브-사회복지-통합지원센터-구축-자격증-취득부터-취업까지-원스톱-지원",
  },
  {
    id: "student-portal",
    title: "위드웨이브, '학생일정포털' 개발…학점은행제 피해 예방 나선다",
    date: "2026.11.09",
    url: "https://www.startuptimes.kr/article/위드웨이브-학생일정포털-개발학점은행제-피해-예방-나선다",
  },
  {
    id: "educanvas-crm",
    title: "위드웨이브, 학점은행제 전용 SaaS '에듀캔버스 CRM' 출시",
    date: "2026.10.28",
    url: "https://www.startuptimes.kr/article/위드웨이브-학점은행제-전용-SaaS-에듀캔버스-CRM-출시",
  },
];

export default function SocialWelfarePressSection() {
  if (PRESS_ARTICLES.length === 0) {
    return null;
  }

  return (
    <section className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 text-[17px] font-black text-slate-900">
        <span className="h-5 w-1 rounded-full bg-blue-600" />
        관련 언론보도
      </h2>

      <div className="divide-y divide-slate-100 overflow-hidden rounded-[17px] border border-slate-200 bg-white">
        {PRESS_ARTICLES.map(article => (
  <a
    key={article.id}
    href={article.url}
    target="_blank"
    rel="noopener noreferrer"
    className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50"
  >
    <div className="min-w-0 flex-1">
      <p className="break-keep text-[13px] font-bold leading-5 text-slate-900 group-hover:text-blue-700 sm:text-[14px]">
        {article.title}
      </p>

      <p className="mt-1.5 text-[11px] text-slate-500">
        {article.date}
      </p>
    </div>

    <ExternalLink
      size={15}
      className="shrink-0 text-slate-400 group-hover:text-blue-600"
    />
  </a>
))}
      </div>
    </section>
  );
}