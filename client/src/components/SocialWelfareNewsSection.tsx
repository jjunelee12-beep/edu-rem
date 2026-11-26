import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { ChevronRight, Newspaper } from "lucide-react";

export const NEWS_CATEGORIES = [
  { value: "all", label: "전체" },
  { value: "policy", label: "복지정책·제도" },
  { value: "education", label: "자격증·교육" },
  { value: "employment", label: "취업·복지현장" },
] as const;

export type NewsCategory =
  (typeof NEWS_CATEGORIES)[number]["value"];

export type NewsArticle = {
  id: string;
  title: string;
  summary: string;
  source: string;
  originalUrl: string;
  imageUrl: string;
  publishedAt: string;
  category: Exclude<NewsCategory, "all">;
};

export function newsCategoryLabel(category: string) {
  return NEWS_CATEGORIES.find(
    item => item.value === category
  )?.label ?? "사회복지";
}

export function formatNewsDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function NewsTabs({
  category,
  onChange,
}: {
  category: NewsCategory;
  onChange: (value: NewsCategory) => void;
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-2">
      {NEWS_CATEGORIES.map(item => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          aria-pressed={category === item.value}
          className={`shrink-0 rounded-full px-3 py-2 text-[11px] font-bold transition-colors ${
            category === item.value
              ? "bg-[#173b70] text-white"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function NewsThumbnail({
  article,
}: {
  article: NewsArticle;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="relative aspect-[4/3] w-[96px] shrink-0 overflow-hidden rounded-xl bg-[#edf2f9] sm:w-[120px]">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-[#315b90]">
        <Newspaper size={24} />
        <span className="text-[10px] font-bold">
          {newsCategoryLabel(article.category)}
        </span>
      </div>

      {!failed && article.imageUrl && (
        <img
          src={article.imageUrl}
          alt=""
loading="lazy"
decoding="async"
referrerPolicy="no-referrer"
onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </div>
  );
}

export function NewsRow({
  article,
  onOpen,
}: {
  article: NewsArticle;
  onOpen?: () => void;
}) {
  return (
    <Link
      href={`/social-welfare-news/${article.id}`}
      onClick={onOpen}
      className="flex items-center gap-3 py-3 text-left"
    >
      <NewsThumbnail article={article} />

      <div className="min-w-0 flex-1">
        <p className="mb-1 text-[10px] font-extrabold text-blue-700">
          {newsCategoryLabel(article.category)}
        </p>

        <h3 className="line-clamp-2 break-keep text-[13px] font-extrabold leading-[1.5] text-slate-900">
          {article.title}
        </h3>

        <p className="mt-2 text-[10px] text-slate-500">
          {article.source} · {formatNewsDate(article.publishedAt)}
        </p>
      </div>

      <ChevronRight
        size={15}
        className="shrink-0 text-slate-400"
      />
    </Link>
  );
}

let savedHomeCategory: NewsCategory = "all";

export default function SocialWelfareNewsSection() {
  const [category, setCategory] =
    useState<NewsCategory>(savedHomeCategory);

  const query = trpc.socialWelfareNews.list.useQuery(
  {
    category,
    limit: 3,
    offset: 0,
  },
  {
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.lastUpdatedAt === null
        ? 30000
        : false,
  }
);

  const changeCategory = (value: NewsCategory) => {
    savedHomeCategory = value;
    setCategory(value);
  };

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[17px] font-black text-slate-900">
          <span className="h-5 w-1 rounded-full bg-blue-600" />
          사회복지 최신 소식
        </h2>

        <Link
          href={`/social-welfare-news?category=${category}`}
          className="flex items-center gap-1 text-[11px] font-bold text-slate-500"
        >
          전체보기
          <ChevronRight size={14} />
        </Link>
      </div>

      <div className="rounded-[18px] border border-slate-200 bg-white p-3">
        <NewsTabs
          category={category}
          onChange={changeCategory}
        />

        {query.isLoading ? (
          <div className="space-y-3 py-3">
            {[1, 2, 3].map(item => (
              <div
                key={item}
                className="h-[78px] animate-pulse rounded-xl bg-slate-100"
              />
            ))}
          </div>
        ) : query.isError ? (
          <p className="py-8 text-center text-xs text-slate-500">
            최신 소식을 불러오지 못했습니다.
            <button
              type="button"
              onClick={() => query.refetch()}
              className="mt-2 block w-full font-bold text-blue-600"
            >
              다시 불러오기
            </button>
          </p>
        ) : query.data?.items.length ? (
          <div className="divide-y divide-slate-100">
            {query.data.items.map(article => (
              <NewsRow
                key={article.id}
                article={article}
              />
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-xs text-slate-500">
            새로운 소식을 준비하고 있습니다.
          </p>
        )}

        <Link
          href={`/social-welfare-news?category=${category}`}
          className="mt-2 flex items-center justify-center gap-1 rounded-xl bg-slate-50 py-3 text-xs font-bold text-[#173b70]"
        >
          사회복지 뉴스 더보기
          <ChevronRight size={15} />
        </Link>
      </div>
    </section>
  );
}