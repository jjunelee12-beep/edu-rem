import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  ExternalLink,
  ChevronRight,
} from "lucide-react";

import {
  NEWS_CATEGORIES,
  NewsTabs,
  NewsRow,
  NewsThumbnail,
  newsCategoryLabel,
  formatNewsDate,
  type NewsCategory,
} from "@/components/SocialWelfareNewsSection";

const CENTER_LOGO =
  "/images/employment-center/social-welfare-logo.png";

const LIST_PATH = "/social-welfare-news";

function getHomePath() {
  return ["welfareon.kr", "www.welfareon.kr"].includes(
    window.location.hostname
  )
    ? "/"
    : "/employment-center";
}

const PAGE_SIZE = 10;

let savedCategory: NewsCategory = "all";
let savedPage = 1;
let savedScroll = 0;
let restoreListScroll = false;

function readCategory(): NewsCategory {
  const value = new URLSearchParams(
    window.location.search
  ).get("category");

  return NEWS_CATEGORIES.find(
    item => item.value === value
  )?.value ?? savedCategory;
}

function NewsLayout({
  children,
  backPath,
}: {
  children: React.ReactNode;
  backPath: string;
}) {
  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-900">
      <div className="mx-auto min-h-screen max-w-[760px] bg-white">
        <header className="sticky top-0 z-20 flex h-[62px] items-center justify-between border-b border-slate-100 bg-white px-4">
          <Link
            href={backPath}
            aria-label="뒤로 가기"
            className="rounded-xl p-2 text-slate-700"
          >
            <ArrowLeft size={21} />
          </Link>

          <Link href={getHomePath()}>
            <img
              src={CENTER_LOGO}
              alt="사회복지통합지원센터"
              className="h-auto w-[160px] object-contain"
            />
          </Link>

          <div className="w-9" />
        </header>

        {children}

        <footer className="border-t border-slate-100 bg-slate-50 px-4 py-8 text-center">
          <p className="text-xs font-bold text-slate-700">
            사회복지통합지원센터
          </p>

          <p className="mt-2 text-[11px] leading-5 text-slate-500">
            사회복지 관련 정보를 제공하며,
            원문은 해당 출처에서 확인하실 수 있습니다.
          </p>

          <Link
            href={getHomePath()}
            className="mt-4 inline-block text-xs font-bold text-blue-700"
          >
            통합지원센터 홈으로
          </Link>
        </footer>
      </div>
    </div>
  );
}

function NewsList() {
  const [category, setCategory] =
    useState<NewsCategory>(readCategory);

  const [page, setPage] = useState(
  restoreListScroll ? savedPage : 1
);

  const query = trpc.socialWelfareNews.list.useQuery(
  {
    category,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
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

 useEffect(() => {
  if (!restoreListScroll) {
    window.scrollTo(0, 0);
  }
}, []);

useEffect(() => {
  if (!query.data || !restoreListScroll) return;

  const frame = requestAnimationFrame(() => {
    window.scrollTo(0, savedScroll);
    restoreListScroll = false;
  });

  return () => cancelAnimationFrame(frame);
}, [query.data]);

  const totalPages = Math.max(
  1,
  Math.ceil((query.data?.total ?? 0) / PAGE_SIZE)
);

useEffect(() => {
  if (query.data && page > totalPages) {
    setPage(totalPages);
    savedPage = totalPages;
  }
}, [query.data, page, totalPages]);

const changeCategory = (value: NewsCategory) => {
  savedCategory = value;
  savedPage = 1;
  savedScroll = 0;
  restoreListScroll = false;

  setCategory(value);
  setPage(1);

  window.history.replaceState(
    window.history.state,
    "",
    `${LIST_PATH}?category=${value}`
  );

  window.scrollTo(0, 0);
};

const changePage = (value: number) => {
  if (
    value < 1 ||
    value > totalPages ||
    value === page
  ) {
    return;
  }

  savedPage = value;
  savedScroll = 0;
  restoreListScroll = false;

  setPage(value);

  window.scrollTo({
    top: 0,
    behavior: "instant",
  });
};

const rememberList = () => {
  savedCategory = category;
  savedPage = page;
  savedScroll = window.scrollY;
  restoreListScroll = true;
};

  return (
    <NewsLayout backPath={getHomePath()}>
      <main className="min-h-[65vh] px-4 pb-10 pt-6">
        <p className="text-xs font-bold text-blue-700">
          WELFARE NEWS
        </p>

        <h1 className="mt-2 text-[25px] font-black">
          사회복지 최신 소식
        </h1>

        <p className="mb-6 mt-2 text-xs leading-5 text-slate-500">
          복지정책부터 자격증, 취업 관련 소식까지
          한곳에서 확인하세요.
        </p>

        <NewsTabs
  category={category}
  onChange={changeCategory}
/>

<div className="mt-4 flex items-center justify-between">
  <p className="text-xs text-slate-500">
    전체{" "}
    <span className="font-bold text-[#173b70]">
      {query.data?.total ?? 0}
    </span>
    건
  </p>

  <span className="text-[11px] text-slate-400">
    최신순
  </span>
</div>

<div className="mt-3 border-t border-slate-200">
          {query.isLoading ? (
            <p className="py-16 text-center text-sm text-slate-500">
              최신 소식을 불러오는 중입니다.
            </p>
          ) : query.isError ? (
            <button
              type="button"
              onClick={() => query.refetch()}
              className="w-full py-16 text-sm font-bold text-blue-600"
            >
              불러오지 못했습니다. 다시 시도하기
            </button>
          ) : query.data?.items.length ? (
            <div className="divide-y divide-slate-100">
              {query.data.items.map(article => (
                <NewsRow
                  key={article.id}
                  article={article}
                  onOpen={rememberList}
                />
              ))}
            </div>
          ) : (
            <p className="py-16 text-center text-sm text-slate-500">
              현재 등록된 소식이 없습니다.
            </p>
          )}
        </div>

        {query.data && totalPages > 1 && (
  <nav
    aria-label="뉴스 페이지 이동"
    className="mt-7 flex items-center justify-center gap-1"
  >
    <button
      type="button"
      aria-label="이전 페이지"
      disabled={page === 1 || query.isFetching}
      onClick={() => changePage(page - 1)}
      className="flex h-9 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 disabled:opacity-30"
    >
      <ChevronRight
        size={16}
        className="rotate-180"
      />
    </button>

    {Array.from(
      { length: totalPages },
      (_, index) => index + 1
    ).map(number => (
      <button
        key={number}
        type="button"
        aria-label={`${number}페이지`}
        aria-current={
          page === number ? "page" : undefined
        }
        disabled={query.isFetching}
        onClick={() => changePage(number)}
        className={`flex h-9 min-w-0 flex-1 max-w-[36px] items-center justify-center rounded-lg text-xs font-bold transition-colors ${
          page === number
            ? "bg-[#173b70] text-white"
            : "text-slate-500 hover:bg-slate-100"
        }`}
      >
        {number}
      </button>
    ))}

    <button
      type="button"
      aria-label="다음 페이지"
      disabled={
        page === totalPages || query.isFetching
      }
      onClick={() => changePage(page + 1)}
      className="flex h-9 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 disabled:opacity-30"
    >
      <ChevronRight size={16} />
    </button>
  </nav>
)}
      </main>
    </NewsLayout>
  );
}

function NewsDetail({ id }: { id: string }) {
  const query = trpc.socialWelfareNews.detail.useQuery(
    { id },
    {
      enabled: /^[a-f0-9]{24}$/.test(id),
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: false,
    }
  );

  const article = query.data;

  const relatedQuery =
    trpc.socialWelfareNews.list.useQuery(
      {
        category: article?.category ?? "all",
        limit: 4,
        offset: 0,
      },
      {
        enabled: Boolean(article),
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: false,
      }
    );

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  const backPath =
    `${LIST_PATH}?category=${savedCategory}`;

  return (
    <NewsLayout backPath={backPath}>
      <main className="min-h-[65vh] px-4 pb-10 pt-6">
        {query.isLoading ? (
          <p className="py-16 text-center text-sm text-slate-500">
            소식을 불러오고 있습니다.
          </p>
        ) : query.isError ? (
          <button
            type="button"
            onClick={() => query.refetch()}
            className="w-full py-16 text-sm font-bold text-blue-600"
          >
            불러오지 못했습니다. 다시 시도하기
          </button>
        ) : !article ? (
          <div className="py-16 text-center">
            <p className="text-sm font-bold">
              현재 확인할 수 없는 소식입니다.
            </p>

            <p className="mt-2 text-xs text-slate-500">
              최신 소식 목록에서 다른 정보를 확인해 주세요.
            </p>

            <Link
              href={backPath}
              className="mt-5 inline-block text-sm font-bold text-blue-700"
            >
              뉴스 목록으로
            </Link>
          </div>
        ) : (
          <>
            <article>
              <p className="text-xs font-extrabold text-blue-700">
                {newsCategoryLabel(article.category)}
              </p>

              <h1 className="mt-3 break-keep text-[23px] font-black leading-[1.5] text-slate-900">
                {article.title}
              </h1>

              <div className="mt-4 flex flex-wrap gap-2 border-b border-slate-200 pb-5 text-xs text-slate-500">
                <span>{article.source}</span>
                <span>·</span>
                <span>
                  {formatNewsDate(article.publishedAt)}
                </span>
              </div>

              <div className="my-6 flex items-center gap-4 rounded-2xl bg-slate-50 p-4">
                <NewsThumbnail article={article} />

                <div className="min-w-0">
                  <p className="text-xs font-bold text-blue-700">
                    정보 제공 출처
                  </p>

                  <p className="mt-1 text-sm font-black">
                    {article.source}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    사회복지 관련 최신 소식
                  </p>
                </div>
              </div>

              <div className="whitespace-pre-wrap break-words text-sm leading-8 text-slate-700">
                {article.summary ||
                  "해당 소식의 자세한 내용은 아래 원문 보기 버튼을 통해 공식 출처에서 확인하실 수 있습니다."}
              </div>

              <a
                href={article.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-[#173b70] py-4 text-sm font-bold text-white"
              >
                원문 보기
                <ExternalLink size={17} />
              </a>

              <p className="mt-3 text-center text-[11px] text-slate-500">
                원문은 외부 사이트에서 열립니다.
              </p>
            </article>

            <section className="mt-10 border-t border-slate-200 pt-6">
              <h2 className="text-[17px] font-black">
                함께 보면 좋은 소식
              </h2>

              <div className="mt-3 divide-y divide-slate-100">
                {relatedQuery.data?.items
                  .filter(item => item.id !== article.id)
                  .slice(0, 3)
                  .map(item => (
                    <NewsRow
                      key={item.id}
                      article={item}
                    />
                  ))}
              </div>
            </section>

            <Link
              href={backPath}
              className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-slate-200 py-3.5 text-sm font-bold text-slate-700"
            >
              뉴스 목록으로
              <ChevronRight size={16} />
            </Link>
          </>
        )}
      </main>
    </NewsLayout>
  );
}

export default function SocialWelfareNewsPage() {
  const [isDetail, params] = useRoute(
    "/social-welfare-news/:id"
  );

  return isDetail && params?.id
    ? <NewsDetail key={params.id} id={params.id} />
    : <NewsList />;
}