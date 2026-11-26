import { ExternalLink } from "lucide-react";

const WELFARE_LINKS = [
  {
    name: "국가평생교육진흥원 학점은행제",
    description: "학습자등록·학점인정·학위신청",
    url: "https://www.cb.or.kr/",
  },
  {
    name: "사회복지사 자격관리센터",
    description: "자격증 신청 및 발급현황 확인",
    url: "https://lic.welfare.net/",
  },
  {
    name: "한국사회복지사협회",
    description: "사회복지사 교육 및 관련 정보",
    url: "https://www.welfare.net/",
  },
  {
    name: "보건복지부",
    description: "사회복지 정책 및 제도 확인",
    url: "https://www.mohw.go.kr/",
  },
  {
    name: "복지넷",
    description: "사회복지시설 및 복지현장 정보",
    url: "https://www.bokji.net/",
  },
  {
    name: "복지로",
    description: "복지서비스 및 지원제도 조회",
    url: "https://www.bokjiro.go.kr/",
  },
  {
    name: "고용24",
    description: "채용정보 및 직업훈련 지원",
    url: "https://www.work24.go.kr/",
  },
  {
    name: "1365 자원봉사포털",
    description: "지역별 봉사활동 조회 및 신청",
    url: "https://www.1365.go.kr/",
  },
  {
    name: "VMS 사회복지자원봉사",
    description: "사회복지 봉사활동 및 실적 관리",
    url: "https://www.vms.or.kr/",
  },
  {
    name: "민간자격정보서비스",
    description: "등록민간자격 및 발급기관 조회",
    url: "https://www.pqi.or.kr/",
  },
];

export default function SocialWelfareLinksSection() {
  return (
    <section className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 text-[17px] font-black text-slate-900">
        <span className="h-5 w-1 rounded-full bg-blue-600" />
        사회복지 관련 기관 바로가기
      </h2>

      <div className="grid grid-cols-2 gap-2.5">
        {WELFARE_LINKS.map(item => (
          <a
            key={item.name}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex min-h-[76px] items-center gap-2 rounded-[15px] border border-slate-200 bg-white px-3 py-3 transition-colors hover:border-blue-200 hover:bg-blue-50"
          >
            <div className="min-w-0 flex-1">
              <p className="break-keep text-[12px] font-extrabold leading-[1.5] text-slate-900">
                {item.name}
              </p>

              <p className="mt-1 break-keep text-[10px] leading-[1.5] text-slate-500">
                {item.description}
              </p>
            </div>

            <ExternalLink
              size={13}
              className="shrink-0 text-slate-400 group-hover:text-blue-600"
            />
          </a>
        ))}
      </div>
    </section>
  );
}