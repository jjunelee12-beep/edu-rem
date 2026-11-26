import { useEffect, useRef, useState } from "react";

type Review = {
  id: string;
  title: string;
  content: string;
  author?: string;
};

// 실제 등록자 후기 확인 후 true로 변경
const REVIEWS_VERIFIED = false;

const REVIEWS: Review[] = [
  {
    id: "review-1",
    title: "수업만 들으면 자격증이 나오는 줄 알았어요.",
    content:
      "다른 곳에서 상담받았을 때는 수업만 들으면 자격증이 나오는 줄 알았어요. 취득 가이드를 보고 이론수업뿐만 아니라 현장실습, 행정절차, 자격증 신청까지 반드시 진행해야 하는 과정이 있다는 걸 알게 됐어요.",
  },
  {
    id: "review-2",
    title: "교육원마다 취득기간이 다른 줄 알았어요.",
    content:
      "처음에는 교육원마다 자격증을 더 빨리 취득할 수 있는 줄 알았어요. 그런데 모든 교육원이 동일한 학점은행제 제도와 한국사회복지사협회 기준을 적용받고, 같은 학력과 이수 일정이라면 자격증 신청 시기도 동일하다는 걸 알게 됐어요. 제 자격증 신청 예상일까지 정확하게 확인할 수 있어서 좋았어요.",
  },
  {
    id: "review-3",
    title: "실제로 어떻게 관리하는지 궁금했어요.",
    content:
      "상담받는 곳마다 관리를 잘해준다고 하는데 실제로 어떻게 관리하는지는 확인하기 어려웠어요. 학사관리시스템을 통해 담당자가 관리하는 내용과 제 학사일정을 직접 확인할 수 있다는 점이 좋았어요.",
  },
  {
    id: "review-4",
    title: "행정절차는 어떻게 해야 할지 막막했어요.",
    content:
      "학습자등록이나 학점인정 신청을 해야 한다는데 인터넷을 찾아봐도 이해하기 어려웠어요. 학사관리시스템에서 제가 해야 하는 행정절차와 신청 기간, 신청 방법까지 확인할 수 있어서 편했어요.",
  },
  {
    id: "review-5",
    title: "실습기관을 구하는 게 가장 걱정됐어요.",
    content:
      "다른 곳에서는 실습기관을 직접 알아봐야 한다고 해서 시작하기 전부터 걱정이 많았어요. 거주지 주변 실습기관 정보와 실습 배정 진행 상황을 확인할 수 있어서 막막했던 부분이 해결됐어요.",
  },
  {
    id: "review-6",
    title: "필수과목이 누락될까 봐 걱정됐어요.",
    content:
      "인터넷에서 과목을 잘못 수강해서 자격증 취득이 늦어졌다는 글을 봤어요. 담당자의 안내에만 의존하지 않고 제가 이수해야 하는 과목과 남은 취득요건을 직접 확인할 수 있어서 안심됐어요.",
  },
  {
    id: "review-7",
    title: "자격증을 따면 어디에 취업할 수 있을까요?",
    content:
      "사회복지사 자격증을 취득하면 좋다는 이야기는 많이 들었지만 실제로 어디에 취업할 수 있는지는 몰랐어요. 집 주변의 복지시설과 실제 채용공고를 확인하면서 자격증 취득 이후의 계획까지 세울 수 있었어요.",
  },
  {
    id: "review-8",
    title: "수업이 끝나면 바로 신청하는 줄 알았어요.",
    content:
      "처음 상담받았을 때는 수강기간만 안내받아서 수업이 끝나면 바로 자격증을 신청할 수 있는 줄 알았어요. 수업 종료일과 자격증 신청일이 다르다는 걸 알게 됐고, 행정절차까지 포함된 전체 일정을 미리 확인할 수 있어서 좋았어요.",
  },
];

export default function SocialWelfareReviewSection() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const container = scrollRef.current;

    if (!container || REVIEWS.length < 2) return;

    const motionPreference = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

    let frame = 0;
    let previousTime = 0;
    let position = container.scrollLeft;

    const animate = (time: number) => {
      const elapsed = previousTime
        ? Math.min(time - previousTime, 50)
        : 0;

      previousTime = time;

      if (
        !pausedRef.current &&
        !motionPreference.matches &&
        !document.hidden
      ) {
        const firstCard =
          container.children[0] as HTMLElement;

        const repeatedCard =
          container.children[REVIEWS.length] as HTMLElement;

        if (firstCard && repeatedCard) {
          const loopWidth =
            repeatedCard.offsetLeft -
            firstCard.offsetLeft;

          position += elapsed * 0.025;

          if (loopWidth > 0 && position >= loopWidth) {
            position %= loopWidth;
          }

          container.scrollLeft = position;
        }
      } else {
        position = container.scrollLeft;
      }

      frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frame);
  }, []);

  const move = (direction: number) => {
    const container = scrollRef.current;
    if (!container) return;

    pausedRef.current = true;
    setPaused(true);

    const firstCard =
      container.children[0] as HTMLElement;

    const distance = (firstCard?.offsetWidth ?? 280) + 12;

    container.scrollBy({
      left: direction * distance,
      behavior: "smooth",
    });
  };

  const togglePause = () => {
    const next = !paused;

    pausedRef.current = next;
    setPaused(next);
  };

  return (
    <section className="mt-8 min-w-0 overflow-hidden">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[17px] font-black text-slate-900">
          <span className="h-5 w-1 rounded-full bg-blue-600" />

          {REVIEWS_VERIFIED
            ? "등록자들의 생생한 후기"
            : "등록자"}
        </h2>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            aria-label="이전 후기"
            onClick={() => move(-1)}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-sm text-slate-600"
          >
            ‹
          </button>

          <button
            type="button"
            aria-label={paused ? "자동 이동 재생" : "자동 이동 정지"}
            onClick={togglePause}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-[10px] text-slate-600"
          >
            {paused ? "▶" : "Ⅱ"}
          </button>

          <button
            type="button"
            aria-label="다음 후기"
            onClick={() => move(1)}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-sm text-slate-600"
          >
            ›
          </button>
        </div>
      </div>

      <div
        className="overflow-hidden rounded-[20px] bg-[#f1f5f9] py-4"
        onMouseEnter={() => {
          pausedRef.current = true;
        }}
        onMouseLeave={() => {
          pausedRef.current = paused;
        }}
      >
        <div
          ref={scrollRef}
          onTouchStart={() => {
            pausedRef.current = true;
            setPaused(true);
          }}
          className="relative flex w-full gap-3 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {[...REVIEWS, ...REVIEWS].map((review, index) => (
            <article
              key={`${review.id}-${index}`}
              aria-hidden={index >= REVIEWS.length}
              className="flex w-[280px] max-w-[85%] shrink-0 flex-col rounded-[18px] border border-slate-200 bg-white p-5 sm:w-[300px]"
            >
              <span
                aria-hidden="true"
                className="h-9 select-none text-[54px] font-black leading-none text-[#b9cce5]"
              >
                “
              </span>

              <h3 className="mt-2 min-h-[48px] break-keep text-[16px] font-extrabold leading-6 text-[#173b70]">
                {review.title}
              </h3>

              <p className="mt-3 flex-1 break-keep text-[13px] leading-[1.85] text-slate-600">
                {review.content}
              </p>

              <div className="mt-5 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                <span className="text-[12px] font-bold text-slate-700">
                  {REVIEWS_VERIFIED
                    ? review.author || "익명 등록자"
                    : ""}
                </span>

                <span className="text-[11px] text-slate-400">
                  사회복지사 2급
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>

      {!REVIEWS_VERIFIED && (
        <p className="mt-2 text-[11px] text-slate-500">
        </p>
      )}
    </section>
  );
}