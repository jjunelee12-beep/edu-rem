import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";

type PortalTab = "home" | "myWork" | "practice" | "administration" | "community";
type View =
  | "main"
  | "detail"
  | "compose"
  | "editPost"
  | "profile"
  | "profileEdit"
  | "onboarding";
type ProfileSection = "posts" | "comments" | "bookmarks";
type TextBlock = {
  id: string;
  type: "text";
  text: string;
  align: "left" | "center" | "right";
  bold: boolean;
  underline: boolean;
  color: string;
  fontSize: number;
};
type ImageBlock = {
  id: string;
  type: "image";

  /**
   * 새로 추가한 이미지면 File 존재.
   * 기존 게시글 이미지면 null.
   */
  file: File | null;

  /**
   * 화면 미리보기 주소.
   *
   * 신규 이미지:
   * blob:...
   *
   * 기존 이미지:
   * R2 공개 URL
   */
  previewUrl: string;

  /**
   * 기존 게시글에 이미 등록되어 있던
   * communityAttachments.id
   *
   * 신규 이미지면 null.
   */
  attachmentId: number | null;

  /**
 * 기존 게시글에 이미 등록된 이미지인지 여부.
 * 수정 시 삭제하면 deletedAttachmentIds에 담아
 * 게시글 저장 성공 시 attachment를 함께 삭제한다.
 */
existing: boolean;
};
type EditorBlock = TextBlock | ImageBlock;

const IMAGE_TYPES = new Set(["image/jpeg","image/png","image/webp","image/gif"]);
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_IMAGES = 10;
const uid = (p:string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
const newText = (): TextBlock => ({
  id: uid("text"),
  type: "text",
  text: "",
  align: "left",
  bold: false,
  underline: false,
  color: "#0f172a",
  fontSize: 17,
});

function buildEditorBlocksFromPost(
  post: any,
  attachments: any[]
): EditorBlock[] {
  const attachmentMap =
    new Map<number, any>(
      (
        Array.isArray(attachments)
          ? attachments
          : []
      ).map(
        (attachment: any) => [
          Number(attachment.id),
          attachment,
        ]
      )
    );

  const sourceBlocks =
    Array.isArray(
      post?.contentData?.blocks
    )
      ? post.contentData.blocks
      : null;

  /**
   * blocks 포맷으로 저장된 게시글.
   */
  if (
    sourceBlocks &&
    sourceBlocks.length > 0
  ) {
    const result: EditorBlock[] =
      sourceBlocks
        .map(
          (
            block: any,
            index: number
          ): EditorBlock | null => {
            if (
              block?.type ===
              "image"
            ) {
              const attachmentId =
                Number(
                  block.attachmentId ||
                    0
                );

              const attachment =
                attachmentMap.get(
                  attachmentId
                );

              if (
                !attachment ||
                !attachment.url
              ) {
                return null;
              }

              return {
                id:
                  `existing-image-${attachmentId}-${index}`,

                type:
                  "image",

                file:
                  null,

                previewUrl:
                  String(
                    attachment.url
                  ),

                attachmentId,

                existing:
                  true,
              };
            }

            if (
              block?.type ===
              "text"
            ) {
              const fontSize =
                Number(
                  block.fontSize ||
                    17
                );

              return {
                id:
                  `existing-text-${index}`,

                type:
                  "text",

                text:
                  String(
                    block.text ||
                      ""
                  ),

                align:
                  block.align ===
                    "center" ||
                  block.align ===
                    "right"
                    ? block.align
                    : "left",

                bold:
                  block.bold ===
                  true,

underline:
  block.underline ===
  true,
                color:
                  String(
                    block.color ||
                      "#0f172a"
                  ),

                fontSize:
  Number.isFinite(fontSize)
    ? Math.min(100, Math.max(1, fontSize))
    : 17,
              };
            }

            return null;
          }
        )
        .filter(
          (
            block
          ): block is EditorBlock =>
            Boolean(block)
        );

    /**
     * 글 끝이 이미지인 경우에도
     * 이후 글을 계속 작성할 수 있게
     * 빈 텍스트 블록 하나 추가.
     */
    if (
      result.length === 0 ||
      result[
        result.length - 1
      ]?.type === "image"
    ) {
      result.push(
        newText()
      );
    }

    return result;
  }

  /**
   * 예전 plain text 게시글 대응.
   */
  const fallback: EditorBlock[] =
    [
      {
        ...newText(),

        text:
          String(
            post?.content ||
              ""
          ),
      },
    ];

  /**
   * blocks 포맷이 없는 옛 게시글인데
   * attachment가 있는 경우 뒤에 표시.
   */
  (
    Array.isArray(attachments)
      ? attachments
      : []
  ).forEach(
    (
      attachment: any,
      index: number
    ) => {
      const attachmentId =
        Number(
          attachment?.id ||
            0
        );

      const url =
        String(
          attachment?.url ||
            ""
        );

      if (
        !attachmentId ||
        !url
      ) {
        return;
      }

      fallback.push({
        id:
          `existing-image-${attachmentId}-${index}`,

        type:
          "image",

        file:
          null,

        previewUrl:
          url,

        attachmentId,

        existing:
          true,
      });
    }
  );

if (
  fallback[
    fallback.length - 1
  ]?.type === "image"
) {
  fallback.push(
    newText()
  );
}

  return fallback;
}

function errorText(error:unknown, fallback:string) {
  const e = error as any;
  return e?.message || e?.data?.message || e?.shape?.message || fallback;
}
function shortDate(value:unknown) {
  const d = new Date(String(value||"")); if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now()-d.getTime();
  if (diff>=0 && diff<60000) return "방금 전";
  if (diff>=0 && diff<3600000) return `${Math.max(1,Math.floor(diff/60000))}분 전`;
  if (diff>=0 && diff<86400000) return `${Math.max(1,Math.floor(diff/3600000))}시간 전`;
  return new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
}
function fullDate(value:unknown) {
  const d = new Date(String(value||"")); if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).format(d);
}
function checkImage(file:File) {
  if (!IMAGE_TYPES.has(file.type)) throw new Error("JPG, PNG, WEBP, GIF 이미지만 등록할 수 있습니다.");
  if (file.size<=0 || file.size>MAX_IMAGE_SIZE) throw new Error("이미지는 한 장당 최대 5MB까지 등록할 수 있습니다.");
}
async function uploadImage(file:File, token:string) {
  checkImage(file);
  const body = new FormData(); body.append("file",file);
  const res = await fetch("/api/student-portal/community/image",{method:"POST",headers:{Authorization:`Bearer ${token}`},body});
  const json = await res.json().catch(()=>null);
  if (!res.ok || !json?.success) throw new Error(String(json?.message||"이미지 업로드에 실패했습니다."));
  return { fileName:String(json.fileName||file.name), fileUrl:String(json.fileUrl||""), mimeType:String(json.mimeType||file.type), sizeBytes:Number(json.sizeBytes||file.size) };
}

export default function StudentPortalCommunity({token,portal,primaryColor,onNavigateTab}:{token:string;portal:any;primaryColor:string;onNavigateTab:(tab:PortalTab)=>void}) {
  const [view,setView] = useState<View>("main");
  const [boardId,setBoardId] = useState<number|null>(null);
  const [postId,setPostId] = useState<number|null>(null);
  const [profileSection,setProfileSection] = useState<ProfileSection>("posts");
  const [searchOpen,setSearchOpen] = useState(false);
  const [search,setSearch] = useState("");

const [
  editingPost,
  setEditingPost,
] =
  useState<{
    post: any;
    attachments: any[];
  } | null>(
    null
  );

  const bootstrap = trpc.studentPortal.community.bootstrap.useQuery({token},{enabled:Boolean(token),retry:false});
  const posts = trpc.studentPortal.community.posts.useQuery({token,boardId,limit:50},{enabled:Boolean(token)&&view==="main"&&Boolean(bootstrap.data?.profile),retry:false});
  const post =
  trpc.studentPortal.community.post.useQuery(
    {
      token,
      postId:
        postId || 0,
    },
    {
      enabled:
        Boolean(token) &&
        (
          view ===
            "detail" ||
          view ===
            "editPost"
        ) &&
        Boolean(postId),

      retry:
        false,
    }
  );
  const activity = trpc.studentPortal.community.myActivity.useQuery({token,limit:100},{enabled:Boolean(token)&&view==="profile",retry:false});

  useEffect(()=>{ if (bootstrap.isSuccess && !bootstrap.data?.profile) setView("onboarding"); },[bootstrap.isSuccess,bootstrap.data?.profile]);
  const openPost =
  (
    id: number
  ) => {
    setEditingPost(
      null
    );

    setPostId(
      id
    );

    setView(
      "detail"
    );

    window.scrollTo({
      top:
        0,

      behavior:
        "smooth",
    });
  };

const openMain =
  () => {
    setEditingPost(
      null
    );

    setPostId(
      null
    );

    setView(
      "main"
    );

    window.scrollTo({
      top:
        0,

      behavior:
        "smooth",
    });
  };

  if (bootstrap.isLoading) return <Centered text="커뮤니티를 불러오고 있습니다."/>;
  if (bootstrap.isError || !bootstrap.data) return <ErrorPage title="커뮤니티를 불러오지 못했습니다." message={errorText(bootstrap.error,"잠시 후 다시 확인해주세요.")} onRetry={()=>bootstrap.refetch()}/>;

  const data=bootstrap.data, profile=data.profile;
  if (profile && profile.communityStatus!=="active") return <Blocked status={profile.communityStatus} reason={profile.moderationReason} primaryColor={primaryColor} onHome={()=>onNavigateTab("home")}/>;
  if (view==="onboarding" || view==="profileEdit" || !profile) return <ProfileEditor mode={profile?"edit":"onboarding"} token={token} primaryColor={primaryColor} profile={profile} onBack={profile?()=>setView("profile"):undefined} onSaved={async()=>{await bootstrap.refetch();setView(profile?"profile":"main");}}/>;
  if (
  view === "compose"
) {
  return (
    <Composer
      mode="create"

      token={
        token
      }

      primaryColor={
        primaryColor
      }

      boards={
        data.boards
      }

      initialBoardId={
        boardId
      }

      initialPost={
        null
      }

      initialAttachments={
        []
      }

      onClose={
        openMain
      }

      onPublished={
        async id => {
          await posts.refetch();

          setEditingPost(
            null
          );

          setPostId(
            id
          );

          setView(
            "detail"
          );
        }
      }
    />
  );
}
if (
  view ===
    "editPost" &&
  editingPost
) {
  return (
    <Composer
      mode="edit"

      token={
        token
      }

      primaryColor={
        primaryColor
      }

      boards={
        data.boards
      }

      initialBoardId={
        Number(
          editingPost
            .post
            ?.boardId ||
            0
        )
      }

      initialPost={
        editingPost.post
      }

      initialAttachments={
        editingPost.attachments
      }

      onClose={() => {
        setView(
          "detail"
        );
      }}

      onPublished={
        async id => {
          await Promise.all([
            posts.refetch(),
            post.refetch(),
          ]);

          setEditingPost(
            null
          );

          setPostId(
            id
          );

          setView(
            "detail"
          );
        }
      }
    />
  );
}
  if (
  view === "detail" &&
  postId
) {
  return (
    <PostDetail
      token={
        token
      }

      primaryColor={
        primaryColor
      }

      boards={
        data.boards
      }

      query={
        post
      }

      onBack={
        openMain
      }

      onEdit={(
        targetPost: any,
        targetAttachments: any[]
      ) => {
        setEditingPost({
          post:
            targetPost,

          attachments:
            targetAttachments,
        });

        setView(
          "editPost"
        );

        window.scrollTo({
          top:
            0,

          behavior:
            "smooth",
        });
      }}

      onDeleted={
        async () => {
          await posts.refetch();

          openMain();
        }
      }

      allowStudentComments={
        data.settings
          ?.allowStudentComments ===
        true
      }
    />
  );
}
  if (view==="profile") return <MyProfile primaryColor={primaryColor} profile={profile} query={activity} section={profileSection} onSection={setProfileSection} onBack={openMain} onEdit={()=>setView("profileEdit")} onOpenPost={openPost} onNavigateTab={onNavigateTab}/>;

  return <MainView portal={portal} primaryColor={primaryColor} data={data} profile={profile} query={posts} boardId={boardId} setBoardId={setBoardId} searchOpen={searchOpen} setSearchOpen={setSearchOpen} search={search} setSearch={setSearch} onPost={openPost} onCompose={()=>setView("compose")} onProfile={()=>setView("profile")} onNavigateTab={onNavigateTab}/>;
}

function MainView({portal,primaryColor,data,profile,query,boardId,setBoardId,searchOpen,setSearchOpen,search,setSearch,onPost,onCompose,onProfile,onNavigateTab}:any) {
  const boards=Array.isArray(data.boards)?data.boards:[];
  const rows=Array.isArray(query.data?.posts)?query.data.posts:[];
  const boardMap=useMemo(()=>new Map(boards.map((b:any)=>[Number(b.id),b])),[boards]);
  const q=String(search||"").trim().toLowerCase();
  const visible=rows.filter((p:any)=>!q||[p.title,p.content,p.authorNickname].some(v=>String(v||"").toLowerCase().includes(q)));
  const notices=visible.filter((p:any)=>boardMap.get(Number(p.boardId))?.boardType==="notice"||p.isPinned);
  const normals=visible.filter((p:any)=>!(boardMap.get(Number(p.boardId))?.boardType==="notice"||p.isPinned));
  const cover=data.settings?.coverImageUrl||data.settings?.backgroundImageUrl||"/images/portal/portal-community.png";
  const title=data.settings?.communityName||"커뮤니티";
  const desc=data.settings?.description||"등록회원과 함께 만드는 소중한 이야기 공간입니다.";

  return <main className="min-h-screen bg-white pb-[94px]">
    <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur">
      <div className="flex h-[66px] items-center gap-2 px-4">
        <button type="button" onClick={()=>onNavigateTab("home")} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          {portal.companyLogoUrl?<img src={portal.companyLogoUrl} alt="" className="h-9 w-9 rounded-xl object-contain"/>:<span className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black text-white" style={{backgroundColor:primaryColor}}>{String(portal.companyName||"C").slice(0,1)}</span>}
          <span className="truncate text-[15px] font-extrabold text-slate-950">{portal.companyName||portal.portalName}</span>
        </button>
        <button type="button" onClick={()=>setSearchOpen(!searchOpen)} className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-slate-700 active:bg-slate-100" aria-label="검색">⌕</button>
        <button type="button" onClick={onProfile} className="h-10 w-10 overflow-hidden rounded-full bg-slate-100" aria-label="내 프로필"><Avatar image={profile.profileImageUrl} name={profile.nickname} size="sm"/></button>
      </div>
      {searchOpen?<div className="border-t border-slate-100 px-4 py-3"><div className="flex h-11 items-center gap-2 rounded-xl bg-slate-100 px-3"><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} autoFocus placeholder="게시글 검색" className="min-w-0 flex-1 bg-transparent text-[15px] font-medium outline-none placeholder:text-slate-400"/>{search?<button type="button" onClick={()=>setSearch("")} className="text-lg text-slate-400">×</button>:null}</div></div>:null}
    </header>

    <section className="relative h-[220px] overflow-hidden"><img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover"/><div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-black/5"/><div className="absolute inset-x-0 bottom-0 px-5 pb-5 text-white"><div className="text-[28px] font-black tracking-[-0.04em] drop-shadow">{title}</div><div className="mt-1 max-w-[355px] text-[14px] font-semibold leading-6 text-white/95 drop-shadow">{desc}</div></div></section>

    <div className="sticky top-[66px] z-30 border-b border-slate-200 bg-white"><div className="flex overflow-x-auto px-2"><Tab active={boardId===null} color={primaryColor} onClick={()=>setBoardId(null)}>전체</Tab>{boards.map((b:any)=><Tab key={b.id} active={boardId===Number(b.id)} color={primaryColor} onClick={()=>setBoardId(Number(b.id))}>{b.name}</Tab>)}</div></div>

    {query.isLoading?<Centered text="게시글을 불러오고 있습니다." small/>:query.isError?<InlineError message={errorText(query.error,"게시글을 불러오지 못했습니다.")} onRetry={()=>query.refetch()}/>:visible.length===0?<Empty text={q?"검색 결과가 없습니다.":"아직 등록된 게시글이 없습니다."}/>:<>
      {boardId===null&&notices.length>0?<section className="border-b border-slate-200 bg-slate-50/80 px-4 py-2">{notices.slice(0,2).map((p:any)=><button key={p.id} type="button" onClick={()=>onPost(Number(p.id))} className="flex w-full items-center gap-3 py-2 text-left"><span className="rounded-md bg-red-50 px-2 py-1 text-[11px] font-black text-red-500">공지</span><span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-extrabold text-slate-900">{p.title}</span><span className="mt-0.5 block text-[11px] text-slate-400">{p.authorNickname} · {shortDate(p.createdAt)}</span></span><span className="text-[11px] text-slate-400">조회 {Number(p.viewCount||0)}</span></button>)}</section>:null}
      <div className="divide-y divide-slate-200">{(boardId===null?normals:visible).map((p:any)=><PostRow key={p.id} post={p} board={boardMap.get(Number(p.boardId))} onClick={()=>onPost(Number(p.id))}/>)}</div>
    </>}

    {data.settings?.allowStudentPosts!==false?<button type="button" onClick={onCompose} className="fixed bottom-[92px] z-40 flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold text-white shadow-xl max-[480px]:right-4 min-[481px]:left-[calc(50%+180px)]" style={{backgroundColor:primaryColor}} aria-label="글쓰기">✎</button>:null}
    <BottomNav color={primaryColor} onNavigate={onNavigateTab}/>
  </main>;
}

function PostRow({post,board,onClick}:{post:any;board:any;onClick:()=>void}) {
  return <button type="button" onClick={onClick} className="w-full px-4 py-4 text-left active:bg-slate-50"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><div className="text-[11px] font-extrabold text-blue-600">{board?.name||"게시판"}</div><div className="mt-1 line-clamp-1 text-[16px] font-extrabold tracking-[-0.02em] text-slate-950">{post.title}</div><div className="mt-2 flex items-center gap-2"><Avatar image={post.authorProfileImageUrl} name={post.authorNickname} size="xs"/><span className="min-w-0 text-[12px] text-slate-400"><b className="text-slate-600">{post.authorNickname}</b> · {shortDate(post.createdAt)}</span></div><div className="mt-2 line-clamp-2 text-[13px] font-medium leading-5 text-slate-500">{post.content}</div></div>{post.thumbnailUrl?<img src={post.thumbnailUrl} alt="" className="h-[78px] w-[78px] shrink-0 rounded-xl object-cover"/>:null}</div><div className="mt-3 flex items-center justify-between text-[12px] text-slate-400"><span className="flex gap-4"><span>♡ {Number(post.helpfulCount || 0)}</span><span>💬 {Number(post.commentCount||0)}</span></span><span>조회 {Number(post.viewCount||0)}</span></div></button>;
}

function PostDetail({
  token,
  primaryColor,
  boards,
  query,
  onBack,
  onDeleted,
onEdit,
  allowStudentComments,
}:any) {
  const [comment,setComment]=useState(""); const [replyTo,setReplyTo]=useState<number|null>(null); const [editId,setEditId]=useState<number|null>(null); const [editText,setEditText]=useState(""); const [err,setErr]=useState<string|null>(null);
  const create=trpc.studentPortal.community.createComment.useMutation(); const update=trpc.studentPortal.community.updateComment.useMutation(); const remove=trpc.studentPortal.community.deleteComment.useMutation(); const react=trpc.studentPortal.community.toggleReaction.useMutation(); const bookmark=trpc.studentPortal.community.toggleBookmark.useMutation(); const deletePost=trpc.studentPortal.community.deletePost.useMutation();
  if(query.isLoading) return <Centered text="게시글을 불러오고 있습니다."/>;
  if(query.isError||!query.data?.post) return <ErrorPage title="게시글을 불러오지 못했습니다." message={errorText(query.error,"삭제되었거나 확인할 수 없는 게시글입니다.")} onBack={onBack} onRetry={()=>query.refetch()}/>;
  const p=query.data.post, comments=Array.isArray(query.data.comments)?query.data.comments:[], attachments=Array.isArray(query.data.attachments)?query.data.attachments:[], state=query.data.myState||{}, board=boards.find((b:any)=>Number(b.id)===Number(p.boardId));
  const roots=comments.filter((c:any)=>!c.parentCommentId); const replies=new Map<number,any[]>(); comments.filter((c:any)=>c.parentCommentId).forEach((c:any)=>{const k=Number(c.parentCommentId);replies.set(k,[...(replies.get(k)||[]),c]);});
  const submit=async()=>{const text=comment.trim();if(!text)return;setErr(null);try{await create.mutateAsync({token,postId:Number(p.id),parentCommentId:replyTo,content:text});setComment("");setReplyTo(null);await query.refetch();}catch(e){setErr(errorText(e,"댓글을 등록하지 못했습니다."));}};
  const deleteComment=async(id:number)=>{if(!window.confirm("댓글을 삭제할까요?"))return;try{await remove.mutateAsync({token,commentId:id});await query.refetch();}catch(e){setErr(errorText(e,"댓글을 삭제하지 못했습니다."));}};
  const saveComment=async(id:number)=>{const text=editText.trim();if(!text)return;try{await update.mutateAsync({token,commentId:id,content:text});setEditId(null);setEditText("");await query.refetch();}catch(e){setErr(errorText(e,"댓글을 수정하지 못했습니다."));}};
  return (
  <main className="min-h-screen bg-white pb-24">
    <TopBar
      title="커뮤니티"

      onBack={
        onBack
      }

      right={
        p.isMine ? (
          <div className="flex items-center gap-3">
            <button
              type="button"

              onClick={() =>
                onEdit(
                  p,
                  attachments
                )
              }

              className="text-[13px] font-bold text-blue-600"
            >
              수정
            </button>

            <button
              type="button"

              onClick={
                async () => {
                  if (
                    !window.confirm(
                      "이 게시글을 삭제할까요?"
                    )
                  ) {
                    return;
                  }

                  try {
                    await deletePost.mutateAsync({
                      token,

                      postId:
                        Number(
                          p.id
                        ),
                    });

                    await onDeleted();
                  } catch (
                    e
                  ) {
                    setErr(
                      errorText(
                        e,
                        "게시글을 삭제하지 못했습니다."
                      )
                    );
                  }
                }
              }

              className="text-[13px] font-bold text-red-500"
            >
              삭제
            </button>
          </div>
        ) : null
      }
    />
    <article className="px-4 pt-4"><div className="text-[12px] font-extrabold text-blue-600">{board?.name||"게시판"}</div><h1 className="mt-2 text-[23px] font-black leading-[1.35] tracking-[-0.035em] text-slate-950">{p.title}</h1><div className="mt-4 flex items-center gap-3 border-b border-slate-200 pb-4"><Avatar image={p.authorProfileImageUrl} name={p.authorNickname} size="md"/><div className="min-w-0"><div className="truncate text-[14px] font-extrabold text-slate-800">{p.authorNickname}</div><div className="mt-0.5 text-[11px] text-slate-400">{fullDate(p.createdAt)} · 조회 {Number(p.viewCount||0)}</div></div></div>
    <Body post={p} attachments={attachments}/>
    <div className="mt-7 grid grid-cols-[1fr_56px] gap-2 border-b border-slate-200 pb-5"><button type="button" disabled={react.isPending} onClick={async()=>{try{await react.mutateAsync({token,postId:Number(p.id),reactionType:"helpful"});await query.refetch();}catch(e){setErr(errorText(e,"반응을 저장하지 못했습니다."));}}} className={`h-12 rounded-xl border text-[14px] font-extrabold ${state.helpful?"border-red-200 bg-red-50 text-red-500":"border-slate-200 text-slate-700"}`}>♡ 도움됐어요 {Number(p.helpfulCount||0)}</button><button type="button" onClick={async()=>{try{if(navigator.share){await navigator.share({title:p.title,text:p.content,url:location.href});}else{await navigator.clipboard.writeText(location.href);window.alert("현재 주소를 복사했습니다.");}}catch{}}} className="h-12 rounded-xl border border-slate-200 text-lg">⌯</button></div>
    <div className="flex items-center justify-between border-b border-slate-200 py-4"><b className="text-[17px]">댓글 {Number(p.commentCount || 0)}</b><button type="button" onClick={async()=>{try{await bookmark.mutateAsync({token,postId:Number(p.id)});await query.refetch();}catch(e){setErr(errorText(e,"게시글을 저장하지 못했습니다."));}}} className="text-[12px] font-bold text-slate-500">{state.bookmarked?"🔖 저장됨":"♡ 저장"}</button></div>
    {roots.length===0?<Empty text="첫 댓글을 남겨보세요."/>:<div className="divide-y divide-slate-100">{roots.map((c:any)=><div key={c.id} className="py-4"><Comment item={c} edit={editId===Number(c.id)} editText={editText} setEditText={setEditText} onReply={()=>{setReplyTo(Number(c.id));setComment("");}} onEdit={()=>{setEditId(Number(c.id));setEditText(String(c.content||""));}} onCancel={()=>{setEditId(null);setEditText("");}} onSave={()=>saveComment(Number(c.id))} onDelete={()=>deleteComment(Number(c.id))}/>{(replies.get(Number(c.id))||[]).map((r:any)=><div key={r.id} className="ml-10 mt-3 border-l-2 border-slate-100 pl-3"><Comment item={r} compact edit={editId===Number(r.id)} editText={editText} setEditText={setEditText} onReply={()=>{setReplyTo(Number(c.id));setComment("");}} onEdit={()=>{setEditId(Number(r.id));setEditText(String(r.content||""));}} onCancel={()=>{setEditId(null);setEditText("");}} onSave={()=>saveComment(Number(r.id))} onDelete={()=>deleteComment(Number(r.id))}/></div>)}</div>)}</div>}
    </article>
    {err?<div className="mx-4 mb-3 rounded-xl bg-red-50 px-4 py-3 text-[13px] font-bold text-red-600">{err}</div>:null}
    {allowStudentComments ? (
  <div className="fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 border-t border-slate-200 bg-white px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2">
    {replyTo ? (
      <div className="mb-2 flex justify-between rounded-lg bg-blue-50 px-3 py-2 text-[11px] font-bold text-blue-600">
        <span>
          답글 작성 중
        </span>

        <button
          type="button"
          onClick={() =>
            setReplyTo(null)
          }
        >
          취소
        </button>
      </div>
    ) : null}

    <div className="flex gap-2">
      <textarea
        value={comment}
        onChange={event =>
          setComment(
            event.target.value
          )
        }
        rows={1}
        placeholder="댓글을 입력해주세요..."
        className="min-h-[44px] flex-1 resize-none rounded-xl bg-slate-100 px-3 py-3 text-[14px] outline-none"
      />

      <button
        type="button"
        disabled={
          !comment.trim() ||
          create.isPending
        }
        onClick={
          submit
        }
        className="h-11 rounded-xl px-4 text-[13px] font-extrabold text-white disabled:opacity-40"
        style={{
          backgroundColor:
            primaryColor,
        }}
      >
        등록
      </button>
    </div>
  </div>
) : (
  <div className="border-t border-slate-200 px-4 py-5 text-center text-[12px] font-medium text-slate-400">
    현재 이 커뮤니티에서는 등록회원 댓글 작성이 비활성화되어 있습니다.
    </div>
)}
  </main>
);
}

function Body({
  post,
  attachments,
}: {
  post: any;
  attachments: any[];
}) {
  const map = useMemo(
    () =>
      new Map(
        attachments.map((a: any) => [
          Number(a.id),
          a,
        ])
      ),
    [attachments]
  );

  const blocks =
    Array.isArray(
      post.contentData?.blocks
    )
      ? post.contentData.blocks
      : null;

  if (!blocks?.length) {
    return (
      <div className="py-6">
        <div className="whitespace-pre-wrap text-[16px] font-medium leading-8 text-slate-800">
          {post.content}
        </div>

        {attachments.length ? (
          <div className="mt-5 space-y-3">
            {attachments.map(
              (a: any) => (
                <img
                  key={a.id}
                  src={a.url}
                  alt=""
                  className="w-full rounded-xl object-cover"
                />
              )
            )}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4 py-6">
      {blocks.map(
        (
          b: any,
          i: number
        ) => {
          if (
            b?.type ===
            "image"
          ) {
            const a =
              map.get(
                Number(
                  b.attachmentId ||
                    0
                )
              );

            return a?.url ? (
              <img
                key={`i-${i}`}
                src={a.url}
                alt=""
                className="w-full rounded-xl object-cover"
              />
            ) : null;
          }

          if (
            b?.type ===
            "text"
          ) {
            return (
              <div
                key={`t-${i}`}
                className="whitespace-pre-wrap leading-8"
                style={{
                  textAlign:
                    b.align ===
                      "center" ||
                    b.align ===
                      "right"
                      ? b.align
                      : "left",

                  fontSize:
                    Math.min(
                      100,
                      Math.max(
                        1,
                        Number(
                          b.fontSize
                        ) || 17
                      )
                    ),

                  fontWeight:
                    b.bold
                      ? 800
                      : 500,

                  textDecoration:
                    b.underline
                      ? "underline"
                      : "none",

                  color:
                    String(
                      b.color ||
                        "#1e293b"
                    ),
                }}
              >
                {String(
                  b.text || ""
                )}
              </div>
            );
          }

          return null;
        }
      )}
    </div>
  );
}

function Comment({
  item,
  compact = false,
  edit,
  editText,
  setEditText,
  onReply,
  onEdit,
  onCancel,
  onSave,
  onDelete,
}: any) {
  const isDeleted =
    item.status === "deleted";

  return (
    <div className="flex gap-3">
      {!isDeleted ? (
        <Avatar
          image={
            item.authorProfileImageUrl
          }
          name={
            item.authorNickname
          }
          size={
            compact
              ? "xs"
              : "sm"
          }
        />
      ) : (
        <span
          className={
            compact
              ? "h-7 w-7 shrink-0"
              : "h-9 w-9 shrink-0"
          }
        />
      )}

      <div className="min-w-0 flex-1">
        {isDeleted ? (
          <div className="py-2 text-[13px] font-medium text-slate-400">
            삭제된 댓글입니다.
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <b className="text-[13px] text-slate-800">
                {
                  item.authorNickname
                }
              </b>

              <span className="text-[10px] text-slate-400">
                {
                  shortDate(
                    item.createdAt
                  )
                }
              </span>
            </div>

            {edit ? (
              <>
                <textarea
                  value={
                    editText
                  }
                  onChange={
                    e =>
                      setEditText(
                        e.target.value
                      )
                  }
                  className="mt-2 min-h-[80px] w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] outline-none"
                />

                <div className="mt-2 flex justify-end gap-3 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={
                      onCancel
                    }
                    className="text-slate-400"
                  >
                    취소
                  </button>

                  <button
                    type="button"
                    onClick={
                      onSave
                    }
                    className="text-blue-600"
                  >
                    저장
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mt-1 whitespace-pre-wrap text-[13px] font-medium leading-6 text-slate-600">
                  {
                    item.content
                  }
                </div>

                <div className="mt-2 flex gap-3 text-[10px] font-bold text-slate-400">
                  <button
                    type="button"
                    onClick={
                      onReply
                    }
                  >
                    답글
                  </button>

                  {item.isMine ? (
                    <>
                      <button
                        type="button"
                        onClick={
                          onEdit
                        }
                      >
                        수정
                      </button>

                      <button
                        type="button"
                        onClick={
                          onDelete
                        }
                      >
                        삭제
                      </button>
                    </>
                  ) : null}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Composer({
  mode = "create",
  token,
  primaryColor,
  boards,
  initialBoardId,
  initialPost,
  initialAttachments,
  onClose,
  onPublished,
}: any) {
  const isEdit =
    mode ===
    "edit";

  const writable =
    boards.filter(
      (b: any) =>
        b.writePermission ===
        "all"
    );

  const initialEditorBlocks =
    useMemo(
      () => {
        if (
          isEdit &&
          initialPost
        ) {
          return buildEditorBlocksFromPost(
            initialPost,
            initialAttachments
          );
        }

        return [
          newText(),
        ];
      },
      [
        isEdit,
        initialPost,
        initialAttachments,
      ]
    );

  const [
    boardId,
    setBoardId,
  ] =
    useState<number>(
      writable.some(
        (b: any) =>
          Number(b.id) ===
          Number(
            initialBoardId
          )
      )
        ? Number(
            initialBoardId
          )
        : Number(
            writable[0]
              ?.id ||
              0
          )
    );

  const [
    title,
    setTitle,
  ] =
    useState(
      isEdit
        ? String(
            initialPost
              ?.title ||
              ""
          )
        : ""
    );

  const [
    blocks,
    setBlocks,
  ] =
    useState<
      EditorBlock[]
    >(
      initialEditorBlocks
    );

  const firstTextBlock =
    initialEditorBlocks.find(
      (
        block
      ): block is TextBlock =>
        block.type ===
        "text"
    );

  const [
    activeId,
    setActiveId,
  ] =
    useState(
      firstTextBlock
        ?.id ||
        ""
    );

  const [
    err,
    setErr,
  ] =
    useState<
      string | null
    >(
      null
    );

  const [
    saving,
    setSaving,
  ] =
    useState(
      false
    );

const [
  deletedAttachmentIds,
  setDeletedAttachmentIds,
] =
  useState<number[]>(
    []
  );

  const fileRef =
    useRef<
      HTMLInputElement | null
    >(
      null
    );

  const create =
    trpc.studentPortal
      .community
      .createPost
      .useMutation();

  const update =
    trpc.studentPortal
      .community
      .updatePost
      .useMutation();

  const remove =
    trpc.studentPortal
      .community
      .deletePost
      .useMutation();

  const register =
    trpc.studentPortal
      .community
      .registerImage
      .useMutation();

  const active =
    blocks.find(
      b =>
        b.type ===
          "text" &&
        b.id ===
          activeId
    ) as
      | TextBlock
      | undefined;

  const imageCount =
    blocks.filter(
      b =>
        b.type ===
        "image"
    ).length;

  const patch =
    (
      p:
        Partial<TextBlock>
    ) =>
      setBlocks(
        old =>
          old.map(
            b =>
              b.type ===
                "text" &&
              b.id ===
                activeId
                ? {
                    ...b,
                    ...p,
                  }
                : b
          )
      );

  const addFiles =
    (
      files: File[]
    ) => {
      setErr(
        null
      );

      try {
        if (
          imageCount +
            files.length >
          MAX_IMAGES
        ) {
          throw new Error(
            `사진은 최대 ${MAX_IMAGES}장까지 등록할 수 있습니다.`
          );
        }

        files.forEach(
          checkImage
        );

        const imgs:
          ImageBlock[] =
          files.map(
            file => ({
              id:
                uid(
                  "img"
                ),

              type:
                "image",

              file,

              previewUrl:
                URL.createObjectURL(
                  file
                ),

              attachmentId:
                null,

              existing:
                false,
            })
          );

        const next =
          newText();

        setBlocks(
          old => {
            const idx =
              old.findIndex(
                b =>
                  b.id ===
                  activeId
              );

            const copy =
              [
                ...old,
              ];

            copy.splice(
              idx >= 0
                ? idx + 1
                : copy.length,

              0,

              ...imgs,

              next
            );

            return copy;
          }
        );

        setActiveId(
          next.id
        );
      } catch (
        e
      ) {
        setErr(
          errorText(
            e,
            "사진을 추가하지 못했습니다."
          )
        );
      }
    };

const handleEditorPaste =
  (
    event:
      React.ClipboardEvent<
        HTMLTextAreaElement
      >
  ) => {
    const items =
      Array.from(
        event.clipboardData
          .items ||
          []
      );

    const imageFiles =
      items
        .filter(
          item =>
            item.type.startsWith(
              "image/"
            )
        )
        .map(
          item =>
            item.getAsFile()
        )
        .filter(
          (
            file
          ): file is File =>
            Boolean(file)
        );

    if (
      imageFiles.length ===
      0
    ) {
      return;
    }

    event.preventDefault();

    addFiles(
      imageFiles
    );
  };

  const publish =
    async () => {
      const t =
        title.trim();

      const plain =
        blocks
          .filter(
            (
              b
            ): b is TextBlock =>
              b.type ===
              "text"
          )
          .map(
            b =>
              b.text.trim()
          )
          .filter(
            Boolean
          )
          .join(
            "\n\n"
          )
          .trim();

      if (
        !boardId
      ) {
        setErr(
          "게시판을 선택해주세요."
        );

        return;
      }

      if (
        !t
      ) {
        setErr(
          "제목을 입력해주세요."
        );

        return;
      }

      if (
        !plain
      ) {
        setErr(
          "내용을 입력해주세요."
        );

        return;
      }

      setSaving(
        true
      );

      setErr(
        null
      );

      let pid:
        number | null =
        isEdit
          ? Number(
              initialPost
                ?.id ||
                0
            )
          : null;

      let createdNewPost =
        false;

      try {
        /**
         * 신규 글이면 먼저 텍스트만으로
         * 게시글 Row를 생성한다.
         */
        if (
          !isEdit
        ) {
          const first = {
            version:
              1,

            blocks:
              blocks
                .filter(
                  (
                    b
                  ): b is TextBlock =>
                    b.type ===
                    "text"
                )
                .map(
                  b => ({
                    type:
                      "text",

                    text:
                      b.text,

                    align:
                      b.align,

                    bold:
                      b.bold,

underline:
  b.underline,

                    color:
                      b.color,

                    fontSize:
                      b.fontSize,
                  })
                ),
          };

          const created =
            await create.mutateAsync({
              token,
              boardId,
              title:
                t,
              content:
                plain,
              contentFormat:
                "blocks",
              contentData:
                first,
            });

          pid =
            Number(
              created.postId
            );

          createdNewPost =
            true;
        }

        if (
          !pid
        ) {
          throw new Error(
            "수정할 게시글 정보를 확인할 수 없습니다."
          );
        }

        /**
         * 신규 이미지만 업로드한다.
         *
         * 기존 attachment는 다시 업로드하지 않는다.
         */
        const newAttachmentIds =
          new Map<
            string,
            number
          >();

        for (
          const b of
          blocks
        ) {
          if (
            b.type !==
            "image"
          ) {
            continue;
          }

          /**
           * 기존 이미지.
           */
          if (
            b.existing &&
            b.attachmentId
          ) {
            continue;
          }

          /**
           * 신규 이미지인데 File이 없으면
           * 비정상 상태.
           */
          if (
            !b.file
          ) {
            throw new Error(
              "추가한 이미지 파일을 확인할 수 없습니다."
            );
          }

          const up =
            await uploadImage(
              b.file,
              token
            );

          const reg =
            await register.mutateAsync({
              token,

              postId:
                pid,

              originalName:
                up.fileName,

              storedName:
                null,

              url:
                up.fileUrl,

              mimeType:
                up.mimeType as
                  | "image/jpeg"
                  | "image/png"
                  | "image/webp"
                  | "image/gif",

              sizeBytes:
                up.sizeBytes,
            });

          newAttachmentIds.set(
            b.id,
            Number(
              reg.attachmentId
            )
          );
        }

        /**
         * 최종 contentData.
         *
         * 기존 이미지는 원래 attachmentId 유지.
         * 신규 이미지는 방금 생성된 attachmentId 사용.
         */
        const final = {
          version:
            1,

          blocks:
            blocks.map(
              b => {
                if (
                  b.type ===
                  "image"
                ) {
                  const attachmentId =
                    b.existing
                      ? b.attachmentId
                      : newAttachmentIds.get(
                          b.id
                        );

                  if (
                    !attachmentId
                  ) {
                    throw new Error(
                      "게시글 이미지 정보를 저장하지 못했습니다."
                    );
                  }

                  return {
                    type:
                      "image",

                    attachmentId,
                  };
                }

                return {
                  type:
                    "text",

                  text:
                    b.text,

                  align:
                    b.align,

                  bold:
                    b.bold,

underline:
  b.underline,

                  color:
                    b.color,

                  fontSize:
                    b.fontSize,
                };
              }
            ),
        };

        /**
         * 신규/수정 모두 최종적으로 updatePost 사용.
         */
        await update.mutateAsync({
          token,

          postId:
            pid,

          boardId,

          title:
            t,

          content:
            plain,

          contentFormat:
            "blocks",

          contentData:
            final,

deletedAttachmentIds:
  isEdit
    ? deletedAttachmentIds
    : [],
        });

        await onPublished(
          pid
        );
      } catch (
        e
      ) {
        /**
         * 신규 작성 중 실패한 경우에만
         * 생성했던 빈 게시글을 정리한다.
         *
         * 수정 중 오류가 났다고
         * 기존 게시글을 삭제하면 절대 안 된다.
         */
        if (
          createdNewPost &&
          pid
        ) {
          try {
            await remove.mutateAsync({
              token,

              postId:
                pid,
            });
          } catch {
            // cleanup 실패는 원래 오류를 덮지 않는다.
          }
        }

        setErr(
          errorText(
            e,
            isEdit
              ? "게시글을 수정하지 못했습니다."
              : "게시글을 등록하지 못했습니다."
          )
        );
      } finally {
        setSaving(
          false
        );
      }
    };

  return (
    <main className="min-h-screen bg-white pb-10">
      <TopBar
        title={
          isEdit
            ? "게시글 수정"
            : "글쓰기"
        }

        onBack={
          onClose
        }

        right={
          <button
            type="button"

            onClick={
              publish
            }

            disabled={
              saving
            }

            className="rounded-lg px-3 py-2 text-[13px] font-extrabold text-white disabled:opacity-50"

            style={{
              backgroundColor:
                primaryColor,
            }}
          >
            {
              saving
                ? isEdit
                  ? "수정 중"
                  : "등록 중"
                : isEdit
                  ? "수정"
                  : "등록"
            }
          </button>
        }
      />

      <div className="px-4 py-5">
        <label className="block text-[13px] font-extrabold text-slate-800">
          게시판 선택

          <select
            value={
              boardId
            }

            onChange={
              e =>
                setBoardId(
                  Number(
                    e.target
                      .value
                  )
                )
            }

            className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-[14px] font-bold outline-none"
          >
            {writable.map(
              (
                b: any
              ) => (
                <option
                  key={
                    b.id
                  }

                  value={
                    b.id
                  }
                >
                  {
                    b.name
                  }
                </option>
              )
            )}
          </select>
        </label>

        <label className="mt-5 block text-[13px] font-extrabold text-slate-800">
          제목

          <input
            value={
              title
            }

            onChange={
              e =>
                setTitle(
                  e.target.value
                )
            }

            maxLength={
              255
            }

            placeholder="제목을 입력해주세요"

            className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-3 text-[15px] font-bold outline-none placeholder:text-slate-400"
          />
        </label>

        <div className="mt-5 text-[13px] font-extrabold text-slate-800">
          내용

          <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
            <div className="flex min-h-12 flex-wrap items-center gap-1 border-b border-slate-200 px-2 py-2">
              <div className="flex h-9 items-center overflow-hidden rounded-lg border border-slate-200 bg-white">
  <button
    type="button"
    onClick={() =>
      patch({
        fontSize:
          Math.max(
            1,
            Number(
              active
                ?.fontSize ||
                17
            ) - 1
          ),
      })
    }
    className="flex h-full w-8 items-center justify-center border-r border-slate-200 text-[16px] font-black text-slate-600 active:bg-slate-100"
    aria-label="글씨 작게"
  >
    −
  </button>

  <input
    type="number"
    min={1}
    max={100}
    value={
      active?.fontSize ||
      17
    }
    onChange={e =>
      patch({
        fontSize:
          Math.min(
            100,
            Math.max(
              1,
              Number(
                e.target.value
              ) || 17
            )
          ),
      })
    }
    className="h-full w-[48px] border-0 bg-white text-center text-[12px] font-black text-slate-800 outline-none"
  />

  <span className="pr-1 text-[10px] font-bold text-slate-400">
    px
  </span>

  <button
    type="button"
    onClick={() =>
      patch({
        fontSize:
          Math.min(
            100,
            Number(
              active
                ?.fontSize ||
                17
            ) + 1
          ),
      })
    }
    className="flex h-full w-8 items-center justify-center border-l border-slate-200 text-[16px] font-black text-slate-600 active:bg-slate-100"
    aria-label="글씨 크게"
  >
    +
  </button>
</div>

              <Tool
                active={
                  Boolean(
                    active
                      ?.bold
                  )
                }

                onClick={() =>
                  patch({
                    bold:
                      !active
                        ?.bold,
                  })
                }
              >
                B
              </Tool>

<Tool
  active={
    Boolean(
      active
        ?.underline
    )
  }
  onClick={() =>
    patch({
      underline:
        !active
          ?.underline,
    })
  }
>
  <span className="underline">
    U
  </span>
</Tool>

              <Tool
                active={
                  active
                    ?.align ===
                  "left"
                }

                onClick={() =>
                  patch({
                    align:
                      "left",
                  })
                }
              >
                ≡
              </Tool>

              <Tool
                active={
                  active
                    ?.align ===
                  "center"
                }

                onClick={() =>
                  patch({
                    align:
                      "center",
                  })
                }
              >
                ≣
              </Tool>

              <Tool
                active={
                  active
                    ?.align ===
                  "right"
                }

                onClick={() =>
                  patch({
                    align:
                      "right",
                  })
                }
              >
                ≡›
              </Tool>

              <label className="relative flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-extrabold text-slate-700 active:bg-slate-50">
  <span
    className="flex h-5 w-5 items-center justify-center rounded border border-slate-200 text-[12px] font-black"
    style={{
      color:
        active?.color ||
        "#0f172a",
    }}
  >
    A
  </span>

  <span>
    글자색
  </span>

  <span
    className="h-3.5 w-3.5 rounded-full border border-black/10"
    style={{
      backgroundColor:
        active?.color ||
        "#0f172a",
    }}
  />

  <input
    type="color"
    value={
      active?.color ||
      "#0f172a"
    }
    onChange={e =>
      patch({
        color:
          e.target.value,
      })
    }
    className="absolute inset-0 cursor-pointer opacity-0"
  />
</label>

              <button
                type="button"

                onClick={() =>
                  fileRef.current
                    ?.click()
                }

                className="ml-auto h-8 rounded-lg px-2 text-[12px] font-extrabold text-slate-600"
              >
                ▧ 사진
              </button>
            </div>

            <div className="min-h-[330px] px-3 py-3">
              {blocks.map(
                b =>
                  b.type ===
                  "image" ? (
                    <div
                      key={
                        b.id
                      }

                      className="relative my-3 overflow-hidden rounded-xl"
                    >
                      <img
                        src={
                          b.previewUrl
                        }

                        alt=""

                        className="max-h-[360px] w-full object-cover"
                      />
                      <button
  type="button"

  onClick={() => {
    /**
     * 기존 이미지면 실제 DB 삭제는
     * 아직 하지 않고 삭제 예정 ID만 기억한다.
     *
     * 게시글 수정 저장이 성공할 때
     * updatePost에서 같이 삭제한다.
     */
    if (
      b.existing &&
      b.attachmentId
    ) {
      setDeletedAttachmentIds(
        old =>
          Array.from(
            new Set([
              ...old,
              Number(
                b.attachmentId
              ),
            ])
          )
      );
    }

    /**
     * 새 이미지의 blob URL은
     * 브라우저 메모리에서 정리.
     */
    if (
      !b.existing &&
      b.previewUrl.startsWith(
        "blob:"
      )
    ) {
      URL.revokeObjectURL(
        b.previewUrl
      );
    }

    setBlocks(
      old =>
        old.filter(
          v =>
            v.id !==
            b.id
        )
    );
  }}

  className="absolute right-2 top-2 h-7 w-7 rounded-full bg-black/75 text-white"
>
  ×
</button>
                    </div>
                  ) : (
                    <textarea
                      key={
                        b.id
                      }

                      value={
                        b.text
                      }

                      onFocus={() =>
                        setActiveId(
                          b.id
                        )
                      }

onPaste={
  handleEditorPaste
}

                      onChange={
                        e =>
                          setBlocks(
                            old =>
                              old.map(
                                x =>
                                  x.type ===
                                    "text" &&
                                  x.id ===
                                    b.id
                                    ? {
                                        ...x,

                                        text:
                                          e
                                            .target
                                            .value,
                                      }
                                    : x
                              )
                          )
                      }

                      rows={
                        Math.max(
                          4,

                          b.text.split(
                            "\n"
                          ).length +
                            2
                        )
                      }

                      placeholder="궁금한 내용이나 회원들과 나누고 싶은 이야기를 작성해주세요."

                      className="my-1 w-full resize-none bg-transparent px-1 py-2 font-medium leading-7 outline-none placeholder:text-slate-400"

                      style={{
                        textAlign:
                          b.align,

                        fontWeight:
                          b.bold
                            ? 800
                            : 500,

textDecoration:
  b.underline
    ? "underline"
    : "none",

                        color:
                          b.color,

                        fontSize:
                          b.fontSize,
                      }}
                    />
                  )
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 border-t border-slate-200 pt-5">
          <div className="flex justify-between">
            <b className="text-[13px]">
              사진 추가
            </b>

            <span className="text-[11px] text-slate-400">
              최대 10장 · 장당 5MB
            </span>
          </div>

          <button
            type="button"

            onClick={() =>
              fileRef.current
                ?.click()
            }

            className="mt-3 flex h-[82px] w-[82px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 text-slate-500"
          >
            <span className="text-2xl">
              ＋
            </span>

            <span className="text-[11px] font-bold">
              사진 추가
            </span>
          </button>
        </div>

        <input
          ref={
            fileRef
          }

          type="file"

          accept="image/jpeg,image/png,image/webp,image/gif"

          multiple

          className="hidden"

          onChange={
            e => {
              const fs =
                Array.from(
                  e.target
                    .files ||
                    []
                );

              e.currentTarget.value =
                "";

              if (
                fs.length
              ) {
                addFiles(
                  fs
                );
              }
            }
          }
        />

        {err ? (
          <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-[13px] font-bold text-red-600">
            {err}
          </div>
        ) : null}
      </div>
    </main>
  );
}

function ProfileEditor({mode,token,primaryColor,profile,onBack,onSaved}:any) {
  const [name,setName]=useState(String(profile?.nickname||"")); const [bio,setBio]=useState(String(profile?.bio||"")); const [image,setImage]=useState<string|null>(profile?.profileImageUrl||null); const [file,setFile]=useState<File|null>(null); const [preview,setPreview]=useState<string|null>(null); const [err,setErr]=useState<string|null>(null); const [saving,setSaving]=useState(false); const fileRef=useRef<HTMLInputElement|null>(null); const normalized=name.trim();
  const check=trpc.studentPortal.community.checkNickname.useQuery({token,nickname:normalized.length>=2?normalized:"__"},{enabled:Boolean(token)&&normalized.length>=2&&normalized.length<=12,retry:false}); const save=trpc.studentPortal.community.saveProfile.useMutation(); const available=check.data?.available===true;
  const submit=async()=>{if(normalized.length<2||normalized.length>12)return setErr("닉네임은 2자 이상 12자 이하로 입력해주세요.");if(!available)return setErr("사용 가능한 닉네임인지 확인해주세요.");setSaving(true);setErr(null);try{let url=image;if(file)url=(await uploadImage(file,token)).fileUrl;await save.mutateAsync({token,nickname:normalized,profileImageUrl:url,bio:bio.trim()||null,profilePublic:true});await onSaved();}catch(e){setErr(errorText(e,"커뮤니티 프로필을 저장하지 못했습니다."));}finally{setSaving(false);}};
  return <main className="min-h-screen bg-white">{onBack?<TopBar title="프로필 수정" onBack={onBack}/>:null}<div className="mx-auto max-w-[390px] px-5 pb-10 pt-14 text-center"><div className="text-4xl">🌱</div><h1 className="mt-4 text-[27px] font-black tracking-[-0.04em] text-slate-950">{mode==="onboarding"?"커뮤니티 시작하기":"프로필 수정"}</h1><p className="mt-3 text-[15px] font-medium leading-7 text-slate-500">등록회원끼리 정보를 나누는<br/>회원 전용 커뮤니티입니다.<br/>닉네임을 설정하고 지금 바로 시작해보세요!</p>
    <div className="relative mx-auto mt-8 h-28 w-28"><button type="button" onClick={()=>fileRef.current?.click()} className="h-28 w-28 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200">{preview||image?<img src={preview||image||""} alt="" className="h-full w-full object-cover"/>:<span className="flex h-full w-full items-center justify-center text-3xl font-black text-slate-400">{normalized.slice(0,1)||"?"}</span>}</button><button type="button" onClick={()=>fileRef.current?.click()} className="absolute bottom-0 right-0 h-9 w-9 rounded-full border-2 border-white text-white shadow" style={{backgroundColor:primaryColor}}>📷</button><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={e=>{const f=e.target.files?.[0];e.currentTarget.value="";if(!f)return;try{checkImage(f);if(preview)URL.revokeObjectURL(preview);setFile(f);setPreview(URL.createObjectURL(f));setErr(null);}catch(x){setErr(errorText(x,"프로필 사진을 선택하지 못했습니다."));}}}/></div>
    <div className="mt-8 text-left"><label className="block text-[13px] font-extrabold text-slate-800">커뮤니티 닉네임<div className="relative mt-2"><input value={name} onChange={e=>setName(e.target.value.slice(0,12))} placeholder="닉네임을 입력해주세요" className="h-[52px] w-full rounded-xl border border-slate-200 px-3 pr-11 text-[15px] font-bold outline-none"/>{available?<span className="absolute right-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-black text-white">✓</span>:null}</div></label><div className="mt-2 min-h-5 text-[12px] font-bold">{check.isFetching?<span className="text-slate-400">닉네임을 확인하고 있습니다.</span>:normalized.length>=2&&check.data?(available?<span className="text-emerald-600">✓ 사용 가능한 닉네임입니다.</span>:<span className="text-red-500">이미 사용 중인 닉네임입니다.</span>):null}</div>
    <label className="mt-5 block text-[13px] font-extrabold text-slate-800">한줄 소개<input value={bio} onChange={e=>setBio(e.target.value.slice(0,100))} placeholder="좋은 인연으로 함께해요! 😊" className="mt-2 h-[52px] w-full rounded-xl border border-slate-200 px-3 text-[14px] font-medium outline-none"/></label><div className="mt-5 rounded-xl bg-slate-50 px-4 py-4 text-[12px] font-medium leading-6 text-slate-500"><div>• 닉네임은 회사 커뮤니티 안에서 중복될 수 없습니다.</div><div>• 한글, 영문, 숫자를 조합해 2~12자로 입력해주세요.</div><div>• 다른 회원에게는 실명 대신 닉네임과 프로필 사진이 표시됩니다.</div></div>{err?<div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-[13px] font-bold text-red-600">{err}</div>:null}<button type="button" disabled={!available||saving} onClick={submit} className="mt-6 h-14 w-full rounded-xl text-[16px] font-extrabold text-white disabled:opacity-40" style={{backgroundColor:primaryColor}}>{saving?"저장 중...":mode==="onboarding"?"시작하기":"저장하기"}</button></div><div className="mt-12 text-[11px] font-medium leading-5 text-slate-400">커뮤니티 운영 및 안전 관리를 위해<br/>교육기관 관리자는 등록회원 정보를 확인할 수 있습니다.</div>
  </div></main>;
}

function MyProfile({primaryColor,profile,query,section,onSection,onBack,onEdit,onOpenPost,onNavigateTab}:any) {
  const data=query.data||{posts:[],comments:[],bookmarks:[]}; const posts=Array.isArray(data.posts)?data.posts:[], comments=Array.isArray(data.comments)?data.comments:[], bookmarks=Array.isArray(data.bookmarks)?data.bookmarks:[]; const helpful=posts.reduce((s:number,p:any)=>s+Number(p.helpfulCount||0),0);
  return <main className="min-h-screen bg-white pb-[94px]"><TopBar title="내 프로필" onBack={onBack} right={<button type="button" onClick={onEdit} className="text-[13px] font-extrabold" style={{color:primaryColor}}>수정</button>}/><section className="flex items-center gap-4 px-4 py-5"><Avatar image={profile.profileImageUrl} name={profile.nickname} size="xl"/><div className="min-w-0"><div className="truncate text-[19px] font-black text-slate-950">{profile.nickname} 🌱</div><div className="mt-1 line-clamp-2 text-[13px] font-medium leading-5 text-slate-500">{profile.bio||"함께 좋은 정보를 나눠보세요."}</div></div></section><section className="grid grid-cols-3 border-y border-slate-200 py-4 text-center"><Stat n={posts.length} label="작성한 글"/><Stat n={comments.length} label="작성한 댓글" border/><Stat n={helpful} label="도움됐어요"/></section><div className="grid grid-cols-3 border-b border-slate-200 px-2"><Tab active={section==="posts"} color={primaryColor} onClick={()=>onSection("posts")}>내가 쓴 글</Tab><Tab active={section==="comments"} color={primaryColor} onClick={()=>onSection("comments")}>내가 쓴 댓글</Tab><Tab active={section==="bookmarks"} color={primaryColor} onClick={()=>onSection("bookmarks")}>저장한 글</Tab></div>
    {query.isLoading?<Centered text="내 활동을 불러오고 있습니다." small/>:query.isError?<InlineError message={errorText(query.error,"내 활동을 불러오지 못했습니다.")} onRetry={()=>query.refetch()}/>:section==="posts"?<ActivityPosts rows={posts} onOpen={onOpenPost}/>:section==="comments"?<ActivityComments rows={comments} onOpen={onOpenPost}/>:<ActivityBookmarks rows={bookmarks} onOpen={onOpenPost}/>}<BottomNav color={primaryColor} onNavigate={onNavigateTab}/>
  </main>;
}
function ActivityPosts({rows,onOpen}:any){return rows.length?<div className="divide-y divide-slate-200">{rows.map((p:any)=><button key={p.id} type="button" onClick={()=>onOpen(Number(p.id))} className="w-full px-4 py-4 text-left"><b className="line-clamp-1 text-[15px] text-slate-900">{p.title}</b><div className="mt-1 line-clamp-1 text-[12px] text-slate-400">{p.content}</div><div className="mt-2 text-[11px] text-slate-400">{shortDate(p.createdAt)} · 조회 {Number(p.viewCount||0)} · 댓글 {Number(p.commentCount||0)}</div></button>)}</div>:<Empty text="작성한 글이 없습니다."/>;}
function ActivityComments({rows,onOpen}:any){return rows.length?<div className="divide-y divide-slate-200">{rows.map((c:any)=><button key={c.id} type="button" onClick={()=>onOpen(Number(c.postId))} className="w-full px-4 py-4 text-left"><b className="line-clamp-1 text-[12px] text-blue-600">{c.postTitle}</b><div className="mt-1 line-clamp-2 text-[14px] leading-6 text-slate-700">{c.content}</div><div className="mt-2 text-[11px] text-slate-400">{shortDate(c.createdAt)}</div></button>)}</div>:<Empty text="작성한 댓글이 없습니다."/>;}
function ActivityBookmarks({rows,onOpen}:any){return rows.length?<div className="divide-y divide-slate-200">{rows.map((p:any)=><button key={p.bookmarkId} type="button" onClick={()=>onOpen(Number(p.postId))} className="w-full px-4 py-4 text-left"><b className="line-clamp-1 text-[15px] text-slate-900">{p.title}</b><div className="mt-1 text-[11px] text-slate-400"><b className="text-slate-600">{p.authorNickname}</b> · {shortDate(p.postCreatedAt)}</div><div className="mt-2 line-clamp-2 text-[12px] leading-5 text-slate-500">{p.content}</div></button>)}</div>:<Empty text="저장한 글이 없습니다."/>;}

function Avatar({image,name,size}:{image:string|null;name:string|null;size:"xs"|"sm"|"md"|"xl"}){const cls=size==="xl"?"h-[72px] w-[72px] text-xl":size==="md"?"h-11 w-11 text-sm":size==="sm"?"h-9 w-9 text-xs":"h-7 w-7 text-[10px]";return image?<img src={image} alt="" className={`${cls} shrink-0 rounded-full object-cover ring-1 ring-black/5`}/>:<span className={`${cls} flex shrink-0 items-center justify-center rounded-full bg-slate-200 font-black text-slate-600`}>{String(name||"회").trim().slice(0,1)}</span>;}
function TopBar({title,onBack,right}:any){return <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur"><div className="relative flex h-[62px] items-center justify-center px-4"><button type="button" onClick={onBack} className="absolute left-2 h-11 w-11 text-[28px] font-light text-slate-700">‹</button><b className="max-w-[250px] truncate text-[16px] text-slate-950">{title}</b>{right?<div className="absolute right-3">{right}</div>:null}</div></header>;}
function Tab({active,color,onClick,children}:any){return <button type="button" onClick={onClick} className="relative shrink-0 px-3.5 py-3 text-[13px] font-extrabold whitespace-nowrap" style={{color:active?color:"#64748b"}}>{children}{active?<span className="absolute inset-x-2 bottom-0 h-0.5" style={{backgroundColor:color}}/>:null}</button>;}
function Tool({active,onClick,children}:any){return <button type="button" onClick={onClick} className={`h-8 min-w-8 rounded-lg px-2 text-[13px] font-black ${active?"bg-slate-900 text-white":"text-slate-700"}`}>{children}</button>;}
function Stat({n,label,border=false}:any){return <div className={border?"border-x border-slate-200":""}><b className="text-[17px] text-slate-950">{n}</b><div className="mt-1 text-[11px] text-slate-500">{label}</div></div>;}
function BottomNav({color,onNavigate}:any){const items:[PortalTab,string,string][]=[["home","홈","⌂"],["myWork","마이 업무","▣"],["practice","실습","↗"],["administration","행정절차","✓"],["community","커뮤니티","●"]];return <nav className="fixed bottom-0 left-1/2 z-40 grid h-[74px] w-full max-w-[480px] -translate-x-1/2 grid-cols-5 border-t border-slate-200 bg-white px-1 pb-[env(safe-area-inset-bottom)]">{items.map(([key,label,icon])=><button key={key} type="button" onClick={()=>onNavigate(key)} className="flex flex-col items-center justify-center gap-1" style={{color:key==="community"?color:"#94a3b8"}}><span className="text-[19px] font-bold">{icon}</span><span className={key==="community"?"text-[11px] font-extrabold":"text-[11px] font-medium"}>{label}</span></button>)}</nav>;}
function Centered({text,small=false}:{text:string;small?:boolean}){return <div className={`flex items-center justify-center bg-white px-5 text-center text-[14px] font-medium text-slate-400 ${small?"min-h-[220px]":"min-h-[70vh]"}`}>{text}</div>;}
function Empty({text}:{text:string}){return <div className="px-5 py-14 text-center text-[13px] font-medium text-slate-400">{text}</div>;}
function InlineError({message,onRetry}:any){return <div className="px-5 py-12 text-center"><div className="text-[14px] font-bold text-red-500">{message}</div><button type="button" onClick={onRetry} className="mt-3 text-[12px] font-extrabold text-slate-500 underline">다시 시도</button></div>;}
function ErrorPage({title,message,onBack,onRetry}:any){return <main className="min-h-screen bg-white">{onBack?<TopBar title="커뮤니티" onBack={onBack}/>:null}<div className="px-6 py-20 text-center"><b className="text-[18px] text-slate-900">{title}</b><div className="mt-2 whitespace-pre-wrap text-[13px] leading-6 text-slate-500">{message}</div>{onRetry?<button type="button" onClick={onRetry} className="mt-5 rounded-xl border border-slate-200 px-4 py-2 text-[13px] font-bold text-slate-600">다시 시도</button>:null}</div></main>;}
function Blocked({status,reason,primaryColor,onHome}:any){return <main className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center"><div className="text-4xl">🔒</div><b className="mt-5 text-[21px] text-slate-950">커뮤니티 이용이 제한되어 있습니다.</b><div className="mt-3 whitespace-pre-wrap text-[14px] leading-6 text-slate-500">{status==="banned"?"현재 커뮤니티 이용이 제한된 상태입니다.":"현재 커뮤니티 이용이 일시적으로 제한되어 있습니다."}{reason?`\n${reason}`:""}</div><button type="button" onClick={onHome} className="mt-7 h-12 rounded-xl px-6 text-[14px] font-extrabold text-white" style={{backgroundColor:primaryColor}}>업무포털 홈으로</button></main>;}