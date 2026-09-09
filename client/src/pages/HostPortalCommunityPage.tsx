import {
  Bell,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  MessageCircle,
  MoreHorizontal,
  PenLine,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";

import { trpc } from "@/lib/trpc";

type HostCommunityPost = {
  id: number;
  boardId?: number | null;
  boardName?: string | null;
  boardKey?: string | null;
  title?: string | null;
  content?: string | null;
  authorType?: string | null;
  authorNickname?: string | null;
  authorProfileImageUrl?: string | null;
  authorPositionName?: string | null;
  isPinned?: boolean | null;
  commentCount?: number | null;
  createdAt?: string | Date | null;
};

function formatCommunityDate(value: unknown) {
  if (!value) return "";

  const date =
    value instanceof Date
      ? value
      : new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function HostPortalCommunityPage() {
  const [selectedBoardId, setSelectedBoardId] =
    useState<number | null>(null);

  const [selectedPostId, setSelectedPostId] =
    useState<number | null>(null);

  const [searchText, setSearchText] =
    useState("");

const [writeMode, setWriteMode] =
  useState<"post" | "notice" | null>(null);

const [writeBoardId, setWriteBoardId] =
  useState<number | null>(null);

const [writeTitle, setWriteTitle] =
  useState("");

const [writeContent, setWriteContent] =
  useState("");

const [writeImages, setWriteImages] =
  useState<File[]>([]);

const [isUploadingImages, setIsUploadingImages] =
  useState(false);

const [isDetailOpen, setIsDetailOpen] =
  useState(false);

const [commentText, setCommentText] =
  useState("");

const [replyingCommentId, setReplyingCommentId] =
  useState<number | null>(null);

const [replyingAuthorName, setReplyingAuthorName] =
  useState("");

const [editingCommentId, setEditingCommentId] =
  useState<number | null>(null);

const [editingCommentText, setEditingCommentText] =
  useState("");

const [isEditOpen, setIsEditOpen] =
  useState(false);

const [editTitle, setEditTitle] =
  useState("");

const [editContent, setEditContent] =
  useState("");

const [editBoardId, setEditBoardId] =
  useState<number | null>(null);

const [editNewImages, setEditNewImages] =
  useState<File[]>([]);

const [
  editDeletedAttachmentIds,
  setEditDeletedAttachmentIds,
] = useState<number[]>([]);

const [isUploadingEditImages, setIsUploadingEditImages] =
  useState(false);

  const bootstrapQuery =
    trpc.studentPortal.hostCommunity.bootstrap.useQuery(
      undefined,
      {
        retry: false,
      }
    );

const portalSettingsQuery =
  trpc.studentPortal.settings.get.useQuery(
    undefined,
    {
      retry: false,
    }
  );

const brandingQuery =
  trpc.branding.get.useQuery(
    undefined,
    {
      retry: false,
    }
  );

  const postsQuery =
    trpc.studentPortal.hostCommunity.posts.useQuery(
      {
        boardId:
          selectedBoardId ??
          undefined,
        limit: 50,
      },
      {
        retry: false,
      }
    );

  const postQuery =
    trpc.studentPortal.hostCommunity.post.useQuery(
      {
        postId: Number(
          selectedPostId ||
          0
        ),
      },
      {
        enabled: Boolean(
          selectedPostId
        ),
        retry: false,
      }
    );

const createPostMutation =
  trpc.studentPortal.hostCommunity.createPost.useMutation();

const createNoticeMutation =
  trpc.studentPortal.hostCommunity.createNotice.useMutation();

const registerImageMutation =
  trpc.studentPortal.hostCommunity.registerImage.useMutation();

const createCommentMutation =
  trpc.studentPortal.hostCommunity.createComment.useMutation();

const updateCommentMutation =
  trpc.studentPortal.hostCommunity.updateComment.useMutation();

const deleteCommentMutation =
  trpc.studentPortal.hostCommunity.deleteComment.useMutation();

const deletePostMutation =
  trpc.studentPortal.hostCommunity.deletePost.useMutation();

const updatePostMutation =
  trpc.studentPortal.hostCommunity.updatePost.useMutation();

const updateNoticeMutation =
  trpc.studentPortal.hostCommunity.updateNotice.useMutation();

const openPostWriter = () => {
  const normalBoards =
    ((bootstrapQuery.data as any)?.boards || []).filter(
      (board: any) =>
        board.boardKey !== "notice" &&
        board.boardType !== "notice"
    );

  const initialBoardId =
    selectedBoardId &&
    normalBoards.some(
      (board: any) =>
        Number(board.id) === Number(selectedBoardId)
    )
      ? selectedBoardId
      : normalBoards[0]?.id
        ? Number(normalBoards[0].id)
        : null;

  setWriteMode("post");
  setWriteBoardId(initialBoardId);
  setWriteTitle("");
setWriteContent("");
setWriteImages([]);
};

const openNoticeWriter = () => {
  setWriteMode("notice");
  setWriteBoardId(null);
  setWriteTitle("");
setWriteContent("");
setWriteImages([]);
};

const closeWriter = () => {
  if (
  createPostMutation.isPending ||
  createNoticeMutation.isPending ||
  isUploadingImages
) {
    return;
  }

  setWriteMode(null);
setWriteBoardId(null);
setWriteTitle("");
setWriteContent("");
setWriteImages([]);
};

const handleWriteImagesChange = (
  event: React.ChangeEvent<HTMLInputElement>
) => {
  const files =
    Array.from(
      event.target.files || []
    );

  if (!files.length) {
    return;
  }

  const allowedTypes =
    new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ]);

  const validFiles =
    files.filter(file => {
      if (!allowedTypes.has(file.type)) {
        return false;
      }

      if (
        file.size >
        5 * 1024 * 1024
      ) {
        return false;
      }

      return true;
    });

  if (
    validFiles.length !==
    files.length
  ) {
    window.alert(
      "JPG, PNG, WEBP, GIF 이미지만 가능하며 파일당 최대 5MB입니다."
    );
  }

  setWriteImages(current => {
    const merged = [
      ...current,
      ...validFiles,
    ];

    if (merged.length > 10) {
      window.alert(
        "이미지는 게시글당 최대 10장까지 첨부할 수 있습니다."
      );
    }

    return merged.slice(0, 10);
  });

  event.target.value = "";
};

const removeWriteImage = (
  index: number
) => {
  setWriteImages(current =>
    current.filter(
      (_, currentIndex) =>
        currentIndex !== index
    )
  );
};

const uploadPostImages = async (
  postId: number
) => {
  if (!writeImages.length) {
    return {
      successCount: 0,
      failedCount: 0,
    };
  }

  let successCount = 0;
  let failedCount = 0;

  setIsUploadingImages(true);

  try {
    for (const file of writeImages) {
      try {
        const formData =
          new FormData();

        formData.append(
          "file",
          file
        );

        const response =
          await fetch(
            `${
              import.meta.env
                .VITE_API_BASE_URL ||
              ""
            }/api/student-portal/host-community/image`,
            {
              method: "POST",
              body: formData,
              credentials:
                "include",
            }
          );

        if (!response.ok) {
          throw new Error(
            "이미지 업로드 실패"
          );
        }

        const uploaded =
          await response.json();

        const url =
          String(
            uploaded?.url ||
            uploaded?.fileUrl ||
            ""
          ).trim();

        const storedName =
          String(
            uploaded?.storedName ||
            uploaded?.key ||
            uploaded?.objectKey ||
            ""
          ).trim();

        if (!url) {
          throw new Error(
            "업로드 URL 없음"
          );
        }

        await registerImageMutation.mutateAsync({
          postId,

          originalName:
            String(
              uploaded?.originalName ||
              file.name
            ).slice(0, 255),

          storedName:
            storedName ||
            null,

          url,

          mimeType:
            file.type as
              | "image/jpeg"
              | "image/png"
              | "image/webp"
              | "image/gif",

          sizeBytes:
            file.size,
        });

        successCount += 1;
      } catch {
        failedCount += 1;
      }
    }
  } finally {
    setIsUploadingImages(false);
  }

  return {
    successCount,
    failedCount,
  };
};

const openPostDetail = () => {
  if (!selectedPostId) {
    return;
  }

  setIsDetailOpen(true);
  setCommentText("");
setReplyingCommentId(null);
setReplyingAuthorName("");
setEditingCommentId(null);
setEditingCommentText("");
};

const closePostDetail = () => {
  if (
    createCommentMutation.isPending ||
    updateCommentMutation.isPending ||
    deleteCommentMutation.isPending ||
    deletePostMutation.isPending
  ) {
    return;
  }

  setIsDetailOpen(false);
setCommentText("");
setReplyingCommentId(null);
setReplyingAuthorName("");
setEditingCommentId(null);
setEditingCommentText("");
};

const startReplyComment = (
  comment: any
) => {
  const rootCommentId =
    comment.parentCommentId
      ? Number(comment.parentCommentId)
      : Number(comment.id);

  setReplyingCommentId(
    rootCommentId
  );

  setReplyingAuthorName(
    String(
      comment.authorNickname ||
        (comment.authorType === "staff"
          ? "담당자"
          : "등록회원")
    )
  );

  setCommentText("");
};

const cancelReplyComment = () => {
  setReplyingCommentId(null);
  setReplyingAuthorName("");
  setCommentText("");
};

const handleCreateComment = async () => {
  if (!selectedPostId) {
    return;
  }

  const content =
    commentText.trim();

  if (!content) {
    window.alert(
      "댓글 내용을 입력해주세요."
    );
    return;
  }

  try {
    await createCommentMutation.mutateAsync({
  postId: selectedPostId,
  parentCommentId:
    replyingCommentId,
  content,
});

    setCommentText("");
setReplyingCommentId(null);
setReplyingAuthorName("");

    await Promise.all([
      postQuery.refetch(),
      postsQuery.refetch(),
    ]);
  } catch (error: any) {
    window.alert(
      error?.message ||
        "댓글 등록 중 오류가 발생했습니다."
    );
  }
};

const startEditComment = (
  comment: any
) => {
  setEditingCommentId(
    Number(comment.id)
  );

  setEditingCommentText(
    String(
      comment.content ||
      ""
    )
  );
};

const cancelEditComment = () => {
  setEditingCommentId(null);
  setEditingCommentText("");
};

const handleUpdateComment = async (
  commentId: number
) => {
  const content =
    editingCommentText.trim();

  if (!content) {
    window.alert(
      "댓글 내용을 입력해주세요."
    );
    return;
  }

  try {
    await updateCommentMutation.mutateAsync({
      commentId,
      content,
    });

    setEditingCommentId(null);
    setEditingCommentText("");

    await postQuery.refetch();
  } catch (error: any) {
    window.alert(
      error?.message ||
        "댓글 수정 중 오류가 발생했습니다."
    );
  }
};

const handleDeleteComment = async (
  commentId: number
) => {
  const confirmed =
    window.confirm(
      "이 댓글을 삭제하시겠습니까?"
    );

  if (!confirmed) {
    return;
  }

  try {
    await deleteCommentMutation.mutateAsync({
      commentId,
    });

    await Promise.all([
      postQuery.refetch(),
      postsQuery.refetch(),
    ]);
  } catch (error: any) {
    window.alert(
      error?.message ||
        "댓글 삭제 중 오류가 발생했습니다."
    );
  }
};

const openPostEditor = () => {
  if (
    !postDetail ||
    postDetail.isMine !== true
  ) {
    return;
  }

  setEditTitle(
    String(postDetail.title || "")
  );

  setEditContent(
    String(postDetail.content || "")
  );

  setEditBoardId(
    postDetail.boardId
      ? Number(postDetail.boardId)
      : null
  );

  setEditNewImages([]);
  setEditDeletedAttachmentIds([]);
  setIsEditOpen(true);
};

const closePostEditor = () => {
  if (
    updatePostMutation.isPending ||
    updateNoticeMutation.isPending ||
    isUploadingEditImages
  ) {
    return;
  }

  setIsEditOpen(false);
  setEditNewImages([]);
  setEditDeletedAttachmentIds([]);
};

const handleEditImagesChange = (
  event: React.ChangeEvent<HTMLInputElement>
) => {
  const files =
    Array.from(
      event.target.files || []
    );

  if (!files.length) {
    return;
  }

  const allowedTypes =
    new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ]);

  const validFiles =
    files.filter(file => {
      if (!allowedTypes.has(file.type)) {
        return false;
      }

      if (
        file.size >
        5 * 1024 * 1024
      ) {
        return false;
      }

      return true;
    });

  if (
    validFiles.length !==
    files.length
  ) {
    window.alert(
      "JPG, PNG, WEBP, GIF 이미지만 가능하며 파일당 최대 5MB입니다."
    );
  }

  const remainingExistingCount =
    postAttachments.filter(
      (attachment: any) =>
        !editDeletedAttachmentIds.includes(
          Number(attachment.id)
        )
    ).length;

  const availableCount =
    Math.max(
      10 -
        remainingExistingCount -
        editNewImages.length,
      0
    );

  if (
    validFiles.length >
    availableCount
  ) {
    window.alert(
      "기존 이미지를 포함하여 게시글당 최대 10장까지 가능합니다."
    );
  }

  setEditNewImages(current => [
    ...current,
    ...validFiles.slice(
      0,
      availableCount
    ),
  ]);

  event.target.value = "";
};

const removeEditNewImage = (
  index: number
) => {
  setEditNewImages(current =>
    current.filter(
      (_, currentIndex) =>
        currentIndex !== index
    )
  );
};

const toggleExistingAttachmentDelete = (
  attachmentId: number
) => {
  setEditDeletedAttachmentIds(
    current =>
      current.includes(
        attachmentId
      )
        ? current.filter(
            id =>
              id !==
              attachmentId
          )
        : [
            ...current,
            attachmentId,
          ]
  );
};

const uploadEditImages = async (
  postId: number
) => {
  if (!editNewImages.length) {
    return {
      successCount: 0,
      failedCount: 0,
    };
  }

  let successCount = 0;
  let failedCount = 0;

  setIsUploadingEditImages(true);

  try {
    for (
      const file of
      editNewImages
    ) {
      try {
        const formData =
          new FormData();

        formData.append(
          "file",
          file
        );

        const response =
          await fetch(
            `${
              import.meta.env
                .VITE_API_BASE_URL ||
              ""
            }/api/student-portal/host-community/image`,
            {
              method: "POST",
              body: formData,
              credentials:
                "include",
            }
          );

        if (!response.ok) {
          throw new Error(
            "이미지 업로드 실패"
          );
        }

        const uploaded =
          await response.json();

        const url =
          String(
            uploaded?.url ||
            uploaded?.fileUrl ||
            ""
          ).trim();

        const storedName =
          String(
            uploaded?.storedName ||
            uploaded?.key ||
            uploaded?.objectKey ||
            ""
          ).trim();

        if (!url) {
          throw new Error(
            "업로드 URL 없음"
          );
        }

        await registerImageMutation.mutateAsync({
          postId,

          originalName:
            String(
              uploaded?.originalName ||
              file.name
            ).slice(
              0,
              255
            ),

          storedName:
            storedName ||
            null,

          url,

          mimeType:
            file.type as
              | "image/jpeg"
              | "image/png"
              | "image/webp"
              | "image/gif",

          sizeBytes:
            file.size,
        });

        successCount += 1;
      } catch {
        failedCount += 1;
      }
    }
  } finally {
    setIsUploadingEditImages(
      false
    );
  }

  return {
    successCount,
    failedCount,
  };
};

const handleSubmitEdit = async () => {
  if (
    !selectedPostId ||
    !postDetail ||
    postDetail.isMine !== true
  ) {
    return;
  }

  const title =
    editTitle.trim();

  const content =
    editContent.trim();

  if (!title) {
    window.alert(
      "제목을 입력해주세요."
    );
    return;
  }

  if (!content) {
    window.alert(
      "내용을 입력해주세요."
    );
    return;
  }

  try {
    if (isDetailNotice) {
      await updateNoticeMutation.mutateAsync({
        postId:
          selectedPostId,
        title,
        content,
        contentFormat:
          "plain",
        contentData:
          null,
        deletedAttachmentIds:
          editDeletedAttachmentIds,
      });
    } else {
      if (!editBoardId) {
        window.alert(
          "게시판을 선택해주세요."
        );
        return;
      }

      await updatePostMutation.mutateAsync({
        postId:
          selectedPostId,
        boardId:
          editBoardId,
        title,
        content,
        contentFormat:
          "plain",
        contentData:
          null,
        deletedAttachmentIds:
          editDeletedAttachmentIds,
      });
    }

    const imageResult =
      await uploadEditImages(
        selectedPostId
      );

    await Promise.all([
      postQuery.refetch(),
      postsQuery.refetch(),
    ]);

    setIsEditOpen(false);
    setEditNewImages([]);
    setEditDeletedAttachmentIds([]);

    if (
      imageResult.failedCount >
      0
    ) {
      window.alert(
        `게시글 수정은 완료되었습니다.\n새 이미지 ${imageResult.successCount}/${editNewImages.length}장 첨부 완료되었습니다.`
      );
    }
  } catch (error: any) {
    window.alert(
      error?.message ||
        "게시글 수정 중 오류가 발생했습니다."
    );
  }
};

const handleDeletePost = async () => {
  if (!selectedPostId) {
    return;
  }

  const confirmed =
    window.confirm(
      "이 게시글을 삭제하시겠습니까?\n학생 게시글이나 공지도 삭제될 수 있습니다."
    );

  if (!confirmed) {
    return;
  }

  try {
    await deletePostMutation.mutateAsync({
      postId: selectedPostId,
    });

    setIsDetailOpen(false);
    setSelectedPostId(null);

    await postsQuery.refetch();
  } catch (error: any) {
    window.alert(
      error?.message ||
        "게시글 삭제 중 오류가 발생했습니다."
    );
  }
};

const handleSubmitWriter = async () => {
  const title =
    writeTitle.trim();

  const content =
    writeContent.trim();

  if (!title) {
    window.alert(
      "제목을 입력해주세요."
    );
    return;
  }

  if (!content) {
    window.alert(
      "내용을 입력해주세요."
    );
    return;
  }

  try {
    let createdPostId:
      number | null = null;

    if (writeMode === "notice") {
      const result =
        await createNoticeMutation.mutateAsync({
          title,
          content,
          contentFormat: "plain",
          contentData: null,
        });

      createdPostId =
        Number(
          (result as any)?.postId ||
          (result as any)?.id ||
          0
        ) || null;
    } else {
      if (!writeBoardId) {
        window.alert(
          "게시판을 선택해주세요."
        );
        return;
      }

      const result =
        await createPostMutation.mutateAsync({
          boardId: writeBoardId,
          title,
          content,
          contentFormat: "plain",
          contentData: null,
        });

      createdPostId =
        Number(
          (result as any)?.postId ||
          0
        ) || null;
    }

    let imageResult = {
  successCount: 0,
  failedCount: 0,
};

if (
  createdPostId &&
  writeImages.length
) {
  imageResult =
    await uploadPostImages(
      createdPostId
    );
}

await postsQuery.refetch();

if (createdPostId) {
  setSelectedPostId(
    createdPostId
  );
}

if (
  imageResult.failedCount > 0
) {
  window.alert(
    `게시글은 저장되었습니다.\n이미지 ${imageResult.successCount}/${writeImages.length}장 첨부 완료되었습니다.`
  );
}

    setWriteMode(null);
setWriteBoardId(null);
setWriteTitle("");
setWriteContent("");
setWriteImages([]);
  } catch (error: any) {
    window.alert(
      error?.message ||
        "게시글 저장 중 오류가 발생했습니다."
    );
  }
};

  const bootstrap =
    bootstrapQuery.data as any;

  const rawPosts =
  Array.isArray(
    (postsQuery.data as any)?.posts
  )
    ? (postsQuery.data as any).posts
    : [];

const postDetail =
  (postQuery.data as any)?.post ||
  null;

const postComments =
  ((postQuery.data as any)?.comments || []) as any[];

const postAttachments =
  ((postQuery.data as any)?.attachments || []) as any[];

  const boards =
    ((bootstrap?.boards as any[]) || []);

const detailBoard =
  boards.find(
    (board: any) =>
      Number(board.id) ===
      Number(postDetail?.boardId || 0)
  ) || null;

const isDetailNotice =
  detailBoard?.boardKey === "notice" ||
  detailBoard?.boardType === "notice" ||
  Boolean(postDetail?.isPinned);

const canEditDetailPost =
  Boolean(postDetail?.isMine);

  const filteredPosts =
    useMemo(() => {
      const keyword =
        searchText
          .trim()
          .toLowerCase();

      if (!keyword) {
        return rawPosts;
      }

      return rawPosts.filter(
        (post: HostCommunityPost) =>
          String(post.title || "")
            .toLowerCase()
            .includes(keyword) ||
          String(post.content || "")
            .toLowerCase()
            .includes(keyword) ||
          String(post.authorNickname || "")
            .toLowerCase()
            .includes(keyword)
      );
    }, [rawPosts, searchText]);

  if (bootstrapQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-sm font-bold text-slate-500">
          Host 공용포탈을 불러오고 있습니다.
        </div>
      </div>
    );
  }

  if (
    bootstrapQuery.isError ||
    !bootstrap
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <div className="font-black text-red-700">
            Host 공용포탈을 열 수 없습니다.
          </div>

          <div className="mt-2 text-sm leading-6 text-red-600">
            {bootstrapQuery.error?.message ||
              "로그인 상태와 Host 권한을 확인해주세요."}
          </div>

          <button
            type="button"
            onClick={() =>
              bootstrapQuery.refetch()
            }
            className="mt-5 rounded-xl bg-slate-950 px-4 py-2 text-sm font-extrabold text-white"
          >
            다시 불러오기
          </button>
        </div>
      </div>
    );
  }

  const staffProfile =
    bootstrap.staffProfile ||
    {};

const portalName =
  String(
    portalSettingsQuery.data?.settings?.portalName ||
      "업무포탈"
  ).trim();

const companyLogoUrl =
  String(
    brandingQuery.data?.companyLogoUrl ||
      ""
  ).trim();

  const organizationSlug =
    String(
      bootstrap.organizationSlug ||
      ""
    ).trim();

  const studentPortalUrl =
    bootstrap.portalUrl ||
    (
      organizationSlug
        ? `/portal/${organizationSlug}`
        : null
    );

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-6">
         <div className="flex min-w-0 items-center gap-3">
  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
    {companyLogoUrl ? (
      <img
        src={companyLogoUrl}
        alt={portalName}
        className="h-full w-full object-contain p-1"
      />
    ) : (
      <div className="flex h-full w-full items-center justify-center bg-slate-950 text-sm font-black text-white">
        {portalName
          .charAt(0)
          .toUpperCase() || "H"}
      </div>
    )}
  </div>

  <div className="min-w-0">
    <div className="max-w-[280px] truncate text-sm font-black tracking-[-0.02em] text-slate-900">
      {portalName}
    </div>

    <div className="text-[11px] font-bold text-slate-400">
      Host 공용포탈
    </div>
  </div>
</div>

          <div className="flex items-center gap-3">
            {studentPortalUrl ? (
              <button
                type="button"
                onClick={() =>
                  window.open(
                    studentPortalUrl,
                    "_blank",
                    "noopener,noreferrer"
                  )
                }
                className="hidden rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 transition hover:bg-slate-50 md:block"
              >
                등록자 포탈 보기
              </button>
            ) : null}

            <button
              type="button"
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500"
            >
              <Bell size={18} />
            </button>

            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <div className="h-8 w-8 overflow-hidden rounded-full bg-slate-100">
                {staffProfile.profileImageUrl ? (
                  <img
                    src={staffProfile.profileImageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-black text-slate-400">
                    H
                  </div>
                )}
              </div>

              <div className="hidden sm:block">
                <div className="text-xs font-black text-slate-800">
                  {staffProfile.displayName ||
                    "Host"}
                </div>
                <div className="text-[11px] text-slate-400">
                  {staffProfile.publicPositionName ||
                    "담당자"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1600px] grid-cols-[220px_minmax(0,1fr)_310px] gap-5 px-6 py-6">
        <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="px-3 pb-3 pt-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
            Community
          </div>

          <button
            type="button"
            onClick={() =>
              setSelectedBoardId(null)
            }
            className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-extrabold transition ${
              selectedBoardId === null
                ? "bg-blue-50 text-blue-700"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span className="flex items-center gap-2">
              <Users size={16} />
              전체 게시글
            </span>
            <ChevronRight size={15} />
          </button>

          <div className="mt-1 space-y-1">
            {boards.map((board: any) => (
              <button
                key={board.id}
                type="button"
                onClick={() =>
                  setSelectedBoardId(
                    Number(board.id)
                  )
                }
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-bold transition ${
                  Number(selectedBoardId) ===
                  Number(board.id)
                    ? "bg-slate-950 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span className="truncate">
                  {board.name || "게시판"}
                </span>
                <ChevronRight size={14} />
              </button>
            ))}
          </div>

          <div className="my-4 border-t border-slate-100" />

          <div className="rounded-xl bg-slate-50 p-3">
            <div className="flex items-center gap-2 text-xs font-black text-slate-700">
              <ShieldCheck
                size={15}
                className="text-emerald-500"
              />
              Host 권한
            </div>
            <div className="mt-2 text-[11px] leading-5 text-slate-400">
              공지 작성, 게시글 운영,
              학생 게시글 삭제가 가능합니다.
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <div className="text-xl font-black tracking-[-0.03em] text-slate-950">
                    등록자 커뮤니티
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    학생과 담당자의 게시글을 한 곳에서 확인합니다.
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative min-w-[280px] flex-1">
                    <Search
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      value={searchText}
                      onChange={(event) =>
                        setSearchText(
                          event.target.value
                        )
                      }
                      placeholder="제목, 내용, 작성자 검색"
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white"
                    />
                  </div>

                  <button
  type="button"
  onClick={openPostWriter}
  className="flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-extrabold text-white shadow-sm transition hover:bg-blue-700"
>
                    <PenLine size={16} />
                    글쓰기
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-[110px_minmax(0,1fr)_150px_100px_80px] border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-black text-slate-400">
              <div>구분</div>
              <div>제목</div>
              <div>작성자</div>
              <div>작성일</div>
              <div className="text-right">
                댓글
              </div>
            </div>

            {postsQuery.isLoading ? (
              <div className="p-10 text-center text-sm font-bold text-slate-400">
                게시글을 불러오고 있습니다.
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="p-10 text-center text-sm font-bold text-slate-400">
                표시할 게시글이 없습니다.
              </div>
            ) : (
              <div>
                {filteredPosts.map(
                  (post: HostCommunityPost) => {
                    const isNotice =
                      post.boardKey ===
                        "notice" ||
                      Boolean(
                        post.isPinned
                      );

                    return (
                      <button
                        key={post.id}
                        type="button"
                        onClick={() =>
                          setSelectedPostId(
                            Number(post.id)
                          )
                        }
                        className="grid w-full grid-cols-[110px_minmax(0,1fr)_150px_100px_80px] items-center border-b border-slate-100 px-5 py-4 text-left transition last:border-b-0 hover:bg-blue-50/40"
                      >
                        <div>
                          <span
                            className={`inline-flex rounded-lg px-2 py-1 text-[11px] font-black ${
                              isNotice
                                ? "bg-red-50 text-red-600"
                                : "bg-blue-50 text-blue-600"
                            }`}
                          >
                            {isNotice
                              ? "공지"
                              : post.boardName ||
                                "게시글"}
                          </span>
                        </div>

                        <div className="min-w-0 pr-4">
                          <div className="truncate text-sm font-extrabold text-slate-800">
                            {post.title ||
                              "제목 없음"}
                          </div>
                          <div className="mt-1 truncate text-xs text-slate-400">
                            {post.content || ""}
                          </div>
                        </div>

                        <div className="flex min-w-0 items-center gap-2">
                          <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-slate-100">
                            {post.authorProfileImageUrl ? (
                              <img
                                src={post.authorProfileImageUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>

                          <div className="min-w-0">
                            <div className="truncate text-xs font-bold text-slate-700">
                              {post.authorNickname ||
                                "등록회원"}
                            </div>
                            {post.authorPositionName ? (
                              <div className="truncate text-[10px] text-slate-400">
                                {post.authorPositionName}
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="text-xs text-slate-400">
                          {formatCommunityDate(
                            post.createdAt
                          )}
                        </div>

                        <div className="flex items-center justify-end gap-1 text-xs font-bold text-slate-500">
                          <MessageCircle size={14} />
                          {Number(
                            post.commentCount ||
                              0
                          )}
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-sm font-black text-slate-900">
                빠른 작성
              </div>
              <MoreHorizontal
                size={18}
                className="text-slate-300"
              />
            </div>

            <div className="mt-4 grid gap-2">
              <button
  type="button"
  onClick={openPostWriter}
  className="flex items-center gap-3 rounded-xl bg-slate-950 px-4 py-3 text-left text-sm font-extrabold text-white"
>
                <PenLine size={17} />
                일반 게시글 작성
              </button>

              <button
  type="button"
  onClick={openNoticeWriter}
  className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-left text-sm font-extrabold text-red-600"
>
                <FileText size={17} />
                공식 공지 작성
              </button>

              <button
  type="button"
  onClick={openPostWriter}
  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-extrabold text-slate-600"
>
                <ImageIcon size={17} />
                이미지 게시글
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-black text-slate-900">
              선택한 게시글
            </div>

            {!selectedPostId ? (
              <div className="mt-4 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-400">
                왼쪽 게시글을 선택하면
                상세 내용과 댓글을 여기에서
                확인할 수 있습니다.
              </div>
            ) : postQuery.isLoading ? (
              <div className="mt-4 text-xs font-bold text-slate-400">
                게시글을 불러오고 있습니다.
              </div>
            ) : (
              <div className="mt-4">
                <div className="text-sm font-black leading-6 text-slate-800">
                  {(postQuery.data as any)?.post?.title ||
                    (postQuery.data as any)?.title ||
                    "게시글"}
                </div>

                <div className="mt-3 line-clamp-6 whitespace-pre-wrap text-xs leading-5 text-slate-500">
                  {(postQuery.data as any)?.post?.content ||
                    (postQuery.data as any)?.content ||
                    ""}
                </div>

                <div className="mt-4 flex items-center gap-2 text-xs font-bold text-slate-400">
                  <MessageCircle size={14} />
                  댓글{" "}
                  {(
                    (postQuery.data as any)?.comments ||
                    []
                  ).length}
                </div>

                <button
  type="button"
  onClick={openPostDetail}
  className="mt-4 h-10 w-full rounded-xl bg-blue-600 text-sm font-extrabold text-white transition hover:bg-blue-700"
>
  상세보기
</button>
              </div>
            )}
          </section>
        </aside>
      </main>
{isDetailOpen && selectedPostId ? (
  <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-6">
    <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
        <div>
          <div className="text-lg font-black text-slate-950">
            게시글 상세
          </div>

          <div className="mt-1 text-xs font-bold text-slate-400">
            등록자 커뮤니티 게시글 및 댓글 관리
          </div>
        </div>

<div className="flex items-center gap-2">
  {canEditDetailPost ? (
    <button
      type="button"
      onClick={openPostEditor}
      className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-extrabold text-blue-600 transition hover:bg-blue-100"
    >
      {isDetailNotice
        ? "공지 수정"
        : "게시글 수정"}
    </button>
  ) : null}


          <button
            type="button"
            onClick={handleDeletePost}
            disabled={
              deletePostMutation.isPending
            }
            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-extrabold text-red-600 transition hover:bg-red-100 disabled:opacity-40"
          >
            {deletePostMutation.isPending
              ? "삭제 중..."
              : "게시글 삭제"}
          </button>

          <button
            type="button"
            onClick={closePostDetail}
            className="rounded-xl px-3 py-2 text-sm font-black text-slate-400 transition hover:bg-slate-100"
          >
            닫기
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {postQuery.isLoading ? (
          <div className="py-16 text-center text-sm font-bold text-slate-400">
            게시글을 불러오고 있습니다.
          </div>
        ) : postQuery.isError || !postDetail ? (
          <div className="rounded-xl bg-red-50 p-5 text-sm font-bold text-red-600">
            게시글 상세 정보를 불러오지 못했습니다.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 overflow-hidden rounded-full bg-slate-100">
                {postDetail.authorProfileImageUrl ? (
                  <img
                    src={
                      postDetail.authorProfileImageUrl
                    }
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-black text-slate-400">
                    {postDetail.authorType ===
                    "staff"
                      ? "H"
                      : "S"}
                  </div>
                )}
              </div>

              <div>
                <div className="text-sm font-black text-slate-800">
                  {postDetail.authorNickname ||
                    (postDetail.authorType ===
                    "staff"
                      ? "담당자"
                      : "등록회원")}
                </div>

                <div className="mt-0.5 text-xs text-slate-400">
                  {postDetail.authorPositionName
                    ? `${postDetail.authorPositionName} · `
                    : ""}
                  {formatCommunityDate(
                    postDetail.createdAt
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <div className="text-xl font-black leading-8 text-slate-950">
                {postDetail.title ||
                  "제목 없음"}
              </div>

              <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {postDetail.content ||
                  ""}
              </div>
            </div>

            {postAttachments.length > 0 ? (
              <div className="mt-7">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-black text-slate-800">
                    첨부 이미지
                  </div>

                  <div className="text-xs font-bold text-slate-400">
                    {postAttachments.length}장
                  </div>
                </div>

                <div
                  className={`grid gap-3 ${
                    postAttachments.length === 1
                      ? "grid-cols-1"
                      : "grid-cols-2"
                  }`}
                >
                  {postAttachments.map(
                    (attachment: any) => (
                      <a
                        key={attachment.id}
                        href={attachment.url}
                        target="_blank"
                        rel="noreferrer"
                        className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                      >
                        <img
                          src={attachment.url}
                          alt={
                            attachment.originalName ||
                            ""
                          }
                          className="max-h-[520px] w-full object-contain"
                        />
                      </a>
                    )
                  )}
                </div>
              </div>
            ) : null}

            <div className="my-8 border-t border-slate-100" />

            <div>
              <div className="flex items-center gap-2">
                <MessageCircle
                  size={17}
                  className="text-blue-600"
                />

                <div className="text-sm font-black text-slate-900">
                  댓글 {postComments.length}
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {postComments.length === 0 ? (
                  <div className="rounded-xl bg-slate-50 p-5 text-center text-xs font-bold text-slate-400">
                    아직 등록된 댓글이 없습니다.
                  </div>
                ) : (
                  postComments.map(
                    (comment: any) => (
                      <div
                        key={comment.id}
                        className={`rounded-2xl border border-slate-100 p-4 ${
                          comment.parentCommentId
                            ? "ml-8 bg-slate-50"
                            : "bg-white"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-slate-100">
                              {comment.authorProfileImageUrl ? (
                                <img
                                  src={
                                    comment.authorProfileImageUrl
                                  }
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[10px] font-black text-slate-400">
                                  {comment.authorType ===
                                  "staff"
                                    ? "H"
                                    : "S"}
                                </div>
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="truncate text-xs font-black text-slate-800">
                                {comment.authorNickname ||
                                  (comment.authorType ===
                                  "staff"
                                    ? "담당자"
                                    : "등록회원")}
                              </div>

                              <div className="mt-0.5 text-[10px] text-slate-400">
                                {comment.authorPositionName
                                  ? `${comment.authorPositionName} · `
                                  : ""}
                                {formatCommunityDate(
                                  comment.createdAt
                                )}

                                {comment.editedAt
                                  ? " · 수정됨"
                                  : ""}
                              </div>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
  <button
    type="button"
    onClick={() =>
      startReplyComment(
        comment
      )
    }
    className="rounded-lg px-2 py-1 text-[11px] font-extrabold text-blue-600 hover:bg-blue-50"
  >
    답글
  </button>

  {comment.isMine ? (
    <>
      <button
        type="button"
        onClick={() =>
          startEditComment(
            comment
          )
        }
        className="rounded-lg px-2 py-1 text-[11px] font-extrabold text-slate-500 hover:bg-slate-100"
      >
        수정
      </button>

      <button
        type="button"
        onClick={() =>
          handleDeleteComment(
            Number(
              comment.id
            )
          )
        }
        disabled={
          deleteCommentMutation.isPending
        }
        className="rounded-lg px-2 py-1 text-[11px] font-extrabold text-red-500 hover:bg-red-50 disabled:opacity-40"
      >
        삭제
      </button>
    </>
  ) : null}
</div>
                        </div>

                        {editingCommentId ===
                        Number(comment.id) ? (
                          <div className="mt-3">
                            <textarea
                              value={
                                editingCommentText
                              }
                              onChange={event =>
                                setEditingCommentText(
                                  event.target.value
                                )
                              }
                              rows={3}
                              maxLength={5000}
                              className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm leading-6 outline-none focus:border-blue-400"
                            />

                            <div className="mt-2 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={
                                  cancelEditComment
                                }
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-extrabold text-slate-500"
                              >
                                취소
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateComment(
                                    Number(
                                      comment.id
                                    )
                                  )
                                }
                                disabled={
                                  updateCommentMutation.isPending
                                }
                                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-extrabold text-white disabled:opacity-40"
                              >
                                저장
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                            {comment.content}
                          </div>
                        )}
                      </div>
                    )
                  )
                )}
              </div>

              <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
  <div className="text-xs font-black text-slate-600">
    {replyingCommentId
      ? "담당자 답글 작성"
      : "담당자 댓글 작성"}
  </div>

  {replyingCommentId ? (
    <button
      type="button"
      onClick={
        cancelReplyComment
      }
      className="text-[11px] font-extrabold text-slate-400 hover:text-slate-700"
    >
      답글 취소
    </button>
  ) : null}
</div>

{replyingCommentId ? (
  <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-600">
    {replyingAuthorName}님에게 답글 작성 중
  </div>
) : null}

                <textarea
                  value={commentText}
                  onChange={event =>
                    setCommentText(
                      event.target.value
                    )
                  }
                  rows={3}
                  maxLength={5000}
                  placeholder={
  replyingCommentId
    ? `${replyingAuthorName}님에게 남길 답글을 입력해주세요.`
    : "등록회원에게 남길 댓글을 입력해주세요."
}
                  className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-blue-400"
                />

                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={
                      handleCreateComment
                    }
                    disabled={
                      createCommentMutation.isPending ||
                      !commentText.trim()
                    }
                    className="h-9 rounded-xl bg-blue-600 px-4 text-xs font-extrabold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {createCommentMutation.isPending
                      ? "등록 중..."
                      : "댓글 등록"}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  </div>
) : null}

{isEditOpen && postDetail ? (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-6">
    <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
        <div>
          <div className="text-lg font-black text-slate-950">
            {isDetailNotice
              ? "공지 수정"
              : "게시글 수정"}
          </div>

          <div className="mt-1 text-xs font-bold text-slate-400">
            본인이 작성한 내용만 수정할 수 있습니다.
          </div>
        </div>

        <button
          type="button"
          onClick={closePostEditor}
          className="rounded-xl px-3 py-2 text-sm font-black text-slate-400 hover:bg-slate-100"
        >
          닫기
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-6">
        {!isDetailNotice ? (
          <div>
            <label className="text-xs font-black text-slate-500">
              게시판
            </label>

            <select
              value={
                editBoardId ??
                ""
              }
              onChange={event =>
                setEditBoardId(
                  Number(
                    event.target.value
                  ) || null
                )
              }
              className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
            >
              <option value="">
                게시판 선택
              </option>

              {boards
                .filter(
                  (board: any) =>
                    board.boardKey !==
                      "notice" &&
                    board.boardType !==
                      "notice"
                )
                .map(
                  (board: any) => (
                    <option
                      key={
                        board.id
                      }
                      value={
                        board.id
                      }
                    >
                      {board.name ||
                        "게시판"}
                    </option>
                  )
                )}
            </select>
          </div>
        ) : null}

        <div>
          <label className="text-xs font-black text-slate-500">
            제목
          </label>

          <input
            type="text"
            value={editTitle}
            onChange={event =>
              setEditTitle(
                event.target.value
              )
            }
            maxLength={255}
            className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-800 outline-none focus:border-blue-400"
          />
        </div>

        <div>
          <label className="text-xs font-black text-slate-500">
            내용
          </label>

          <textarea
            value={
              editContent
            }
            onChange={event =>
              setEditContent(
                event.target.value
              )
            }
            rows={10}
            className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 text-slate-700 outline-none focus:border-blue-400"
          />
        </div>

        {postAttachments.length >
        0 ? (
          <div>
            <div className="flex items-center justify-between">
              <div className="text-xs font-black text-slate-500">
                기존 이미지
              </div>

              <div className="text-[11px] text-slate-400">
                클릭하면 삭제 대상으로 선택됩니다.
              </div>
            </div>

            <div className="mt-3 grid grid-cols-5 gap-2">
              {postAttachments.map(
                (
                  attachment: any
                ) => {
                  const isDeleted =
                    editDeletedAttachmentIds.includes(
                      Number(
                        attachment.id
                      )
                    );

                  return (
                    <button
                      key={
                        attachment.id
                      }
                      type="button"
                      onClick={() =>
                        toggleExistingAttachmentDelete(
                          Number(
                            attachment.id
                          )
                        )
                      }
                      className={`relative aspect-square overflow-hidden rounded-xl border ${
                        isDeleted
                          ? "border-red-400 opacity-40"
                          : "border-slate-200"
                      }`}
                    >
                      <img
                        src={
                          attachment.url
                        }
                        alt=""
                        className="h-full w-full object-cover"
                      />

                      {isDeleted ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-red-950/40 text-xs font-black text-white">
                          삭제 예정
                        </div>
                      ) : null}
                    </button>
                  );
                }
              )}
            </div>
          </div>
        ) : null}

        <div>
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-slate-500">
              새 이미지 추가
            </label>

            <div className="text-[11px] font-bold text-slate-400">
              최대 10장
            </div>
          </div>

          <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm font-extrabold text-slate-600 hover:bg-slate-100">
            <ImageIcon
              size={18}
            />
            이미지 선택

            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={
                handleEditImagesChange
              }
              className="hidden"
            />
          </label>

          {editNewImages.length >
          0 ? (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {editNewImages.map(
                (
                  file,
                  index
                ) => {
                  const previewUrl =
                    URL.createObjectURL(
                      file
                    );

                  return (
                    <div
                      key={`${file.name}-${file.size}-${index}`}
                      className="relative aspect-square overflow-hidden rounded-xl border border-slate-200"
                    >
                      <img
                        src={
                          previewUrl
                        }
                        alt=""
                        className="h-full w-full object-cover"
                        onLoad={() =>
                          URL.revokeObjectURL(
                            previewUrl
                          )
                        }
                      />

                      <button
                        type="button"
                        onClick={() =>
                          removeEditNewImage(
                            index
                          )
                        }
                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-950/80 text-xs font-black text-white"
                      >
                        ×
                      </button>
                    </div>
                  );
                }
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
        <button
          type="button"
          onClick={
            closePostEditor
          }
          disabled={
            updatePostMutation.isPending ||
            updateNoticeMutation.isPending ||
            isUploadingEditImages
          }
          className="h-10 rounded-xl border border-slate-200 bg-white px-5 text-sm font-extrabold text-slate-600 disabled:opacity-40"
        >
          취소
        </button>

        <button
          type="button"
          onClick={
            handleSubmitEdit
          }
          disabled={
            updatePostMutation.isPending ||
            updateNoticeMutation.isPending ||
            isUploadingEditImages
          }
          className="h-10 rounded-xl bg-blue-600 px-5 text-sm font-extrabold text-white disabled:opacity-40"
        >
          {isUploadingEditImages
            ? "이미지 업로드 중..."
            : updatePostMutation.isPending ||
                updateNoticeMutation.isPending
              ? "수정 중..."
              : "수정 저장"}
        </button>
      </div>
    </div>
  </div>
) : null}

{writeMode ? (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
    <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
        <div>
          <div className="text-lg font-black text-slate-950">
            {writeMode === "notice"
              ? "공식 공지 작성"
              : "게시글 작성"}
          </div>

          <div className="mt-1 text-xs font-medium text-slate-400">
            {writeMode === "notice"
              ? "등록회원에게 노출되는 공식 공지를 작성합니다."
              : "등록자 커뮤니티에 담당자 게시글을 작성합니다."}
          </div>
        </div>

        <button
          type="button"
          onClick={closeWriter}
          className="rounded-xl px-3 py-2 text-sm font-black text-slate-400 transition hover:bg-slate-100"
        >
          닫기
        </button>
      </div>

      <div className="space-y-5 p-6">
        {writeMode === "post" ? (
          <div>
            <label className="text-xs font-black text-slate-500">
              게시판
            </label>

            <select
              value={
                writeBoardId ??
                ""
              }
              onChange={event =>
                setWriteBoardId(
                  Number(
                    event.target.value
                  ) || null
                )
              }
              className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
            >
              <option value="">
                게시판 선택
              </option>

              {boards
                .filter(
                  (board: any) =>
                    board.boardKey !==
                      "notice" &&
                    board.boardType !==
                      "notice"
                )
                .map(
                  (board: any) => (
                    <option
                      key={board.id}
                      value={board.id}
                    >
                      {board.name ||
                        "게시판"}
                    </option>
                  )
                )}
            </select>
          </div>
        ) : null}

        <div>
          <label className="text-xs font-black text-slate-500">
            제목
          </label>

          <input
            type="text"
            value={writeTitle}
            onChange={event =>
              setWriteTitle(
                event.target.value
              )
            }
            maxLength={255}
            placeholder="제목을 입력해주세요."
            className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-800 outline-none focus:border-blue-400"
          />
        </div>

        <div>
          <label className="text-xs font-black text-slate-500">
            내용
          </label>

          <textarea
            value={writeContent}
            onChange={event =>
              setWriteContent(
                event.target.value
              )
            }
            rows={10}
            placeholder="내용을 입력해주세요."
            className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 text-slate-700 outline-none focus:border-blue-400"
          />
        </div>
<div>
  <div className="flex items-center justify-between">
    <label className="text-xs font-black text-slate-500">
      이미지 첨부
    </label>

    <div className="text-[11px] font-bold text-slate-400">
      {writeImages.length}/10
    </div>
  </div>

  <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm font-extrabold text-slate-600 transition hover:bg-slate-100">
    <ImageIcon size={18} />
    이미지 선택

    <input
      type="file"
      multiple
      accept="image/jpeg,image/png,image/webp,image/gif"
      onChange={
        handleWriteImagesChange
      }
      className="hidden"
    />
  </label>

  {writeImages.length > 0 ? (
    <div className="mt-3 grid grid-cols-5 gap-2">
      {writeImages.map(
        (file, index) => {
          const previewUrl =
            URL.createObjectURL(
              file
            );

          return (
            <div
              key={`${file.name}-${file.size}-${index}`}
              className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
            >
              <img
                src={previewUrl}
                alt=""
                className="h-full w-full object-cover"
                onLoad={() =>
                  URL.revokeObjectURL(
                    previewUrl
                  )
                }
              />

              <button
                type="button"
                onClick={() =>
                  removeWriteImage(
                    index
                  )
                }
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-950/80 text-xs font-black text-white"
              >
                ×
              </button>
            </div>
          );
        }
      )}
    </div>
  ) : null}

  <div className="mt-2 text-[11px] leading-5 text-slate-400">
    JPG, PNG, WEBP, GIF · 파일당 최대 5MB · 최대 10장
  </div>
</div>
      </div>

      <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
        <button
          type="button"
          onClick={closeWriter}
          disabled={
  createPostMutation.isPending ||
  createNoticeMutation.isPending ||
  isUploadingImages
}
          className="h-10 rounded-xl border border-slate-200 bg-white px-5 text-sm font-extrabold text-slate-600 disabled:opacity-40"
        >
          취소
        </button>

        <button
          type="button"
          onClick={
            handleSubmitWriter
          }
          disabled={
  createPostMutation.isPending ||
  createNoticeMutation.isPending ||
  isUploadingImages
}
          className={`h-10 rounded-xl px-5 text-sm font-extrabold text-white disabled:opacity-40 ${
            writeMode === "notice"
              ? "bg-red-600 hover:bg-red-700"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
         {createPostMutation.isPending ||
createNoticeMutation.isPending ||
isUploadingImages
  ? isUploadingImages
    ? "이미지 업로드 중..."
    : "저장 중..."
            : writeMode === "notice"
              ? "공지 등록"
              : "게시글 등록"}
        </button>
      </div>
    </div>
  </div>
) : null}
    </div>
  );
}
