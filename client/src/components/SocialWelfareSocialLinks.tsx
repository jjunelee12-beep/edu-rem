import {
  MessageCircle,
  Instagram,
  Music2,
  BookOpen,
  Youtube,
} from "lucide-react";

const SOCIAL_LINKS = [
  {
    name: "카카오톡",
    icon: MessageCircle,
    color: "bg-[#FEE500] text-[#392020]",
    url: "https://open.kakao.com/o/sBXt0j9g",
  },
  {
    name: "인스타그램",
    icon: Instagram,
    color:
      "bg-gradient-to-br from-[#833AB4] via-[#E1306C] to-[#FCAF45] text-white",
    url: "https://www.instagram.com/working_job_certification/",
  },
  {
    name: "틱톡",
    icon: Music2,
    color: "bg-black text-white",
    url: "https://www.tiktok.com/@jjuneleestudy?lang=ko-KR",
  },
  {
    name: "블로그",
    icon: BookOpen,
    color: "bg-[#03C75A] text-white",
    url: "https://blog.naver.com/jjunelee",
  },
  {
    name: "유튜브",
    icon: Youtube,
    color: "bg-[#FF0000] text-white",
    url: "https://www.youtube.com/@준이쌤-i9r",
  },
];

export default function SocialWelfareSocialLinks() {
  return (
    <div className="mt-5 border-t border-slate-200 pt-4">
      <h4 className="mb-4 text-center text-[11px] font-bold text-slate-700">
        상담 및 SNS 채널
      </h4>

      <div className="flex items-start justify-center gap-4 sm:gap-6">
        {SOCIAL_LINKS.map(item => (
          <a
            key={item.name}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${item.name} 바로가기`}
            className="group flex flex-col items-center gap-1.5"
          >
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-full shadow-sm transition-transform group-hover:-translate-y-1 ${item.color}`}
            >
              <item.icon size={21} strokeWidth={2} />
            </span>

            <span className="text-[10px] font-medium text-slate-600">
              {item.name}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}