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
import { useMemo, useRef, useState } from "react";

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

type HostTextBlock = {
  id: string;
  type: "text";
  text: string;
  html: string;
  align: "left" | "center" | "right";
  bold: boolean;
  underline: boolean;
  color: string;
  fontSize: number;
  fontFamily: string;
};

type HostImageBlock = {
  id: string;
  type: "image";
  file: File | null;
  previewUrl: string;
  attachmentId: number | null;
  existing: boolean;
};

type HostEditorBlock =
  | HostTextBlock
  | HostImageBlock;

const HOST_IMAGE_TYPES =
  new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ]);

const HOST_MAX_IMAGE_SIZE =
  5 * 1024 * 1024;

const HOST_MAX_IMAGES =
  10;

const hostUid = (
  prefix: string
) =>
  `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;

const newHostTextBlock =
  (): HostTextBlock => ({
    id: hostUid("text"),
    type: "text",
    text: "",
    html: "",
    align: "left",
    bold: false,
    underline: false,
    color: "#0f172a",
    fontSize: 17,
    fontFamily: "inherit",
  });

const HOST_FONT_OPTIONS = [
  {
    label: "기본",
    value: "inherit",
  },
  {
    label: "맑은 고딕",
    value: '"Malgun Gothic", sans-serif',
  },
  {
    label: "돋움",
    value: "Dotum, sans-serif",
  },
  {
    label: "굴림",
    value: "Gulim, sans-serif",
  },
  {
    label: "바탕",
    value: "Batang, serif",
  },
  {
    label: "명조",
    value: "serif",
  },
];

function escapeHostRichText(
  value: string
) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\n/g, "<br>");
}

function buildHostLegacyHtml(
  block: any
) {
  const text =
    String(
      block?.text || ""
    );

  if (!text) {
    return "";
  }

  const fontSize =
    Math.min(
      100,
      Math.max(
        1,
        Number(
          block?.fontSize ||
          17
        ) || 17
      )
    );

  const color =
    /^#[0-9a-f]{6}$/i.test(
      String(
        block?.color || ""
      )
    )
      ? String(
          block.color
        )
      : "#0f172a";

  const fontFamily =
    String(
      block?.fontFamily ||
      "inherit"
    );

  const fontWeight =
    block?.bold === true
      ? "800"
      : "500";

  const textDecoration =
    block?.underline === true
      ? "underline"
      : "none";

  return (
    `<span style="` +
    `font-size:${fontSize}px;` +
    `color:${color};` +
    `font-family:${fontFamily};` +
    `font-weight:${fontWeight};` +
    `text-decoration:${textDecoration};` +
    `">` +
    escapeHostRichText(
      text
    ) +
    `</span>`
  );
}

function sanitizeHostRichHtml(
  value: string
) {
  if (
    typeof document ===
    "undefined"
  ) {
    return "";
  }

  const template =
    document.createElement(
      "template"
    );

  template.innerHTML =
    String(value || "");

  const allowedTags =
    new Set([
      "SPAN",
      "BR",
      "DIV",
      "P",
      "B",
      "STRONG",
      "U",
    ]);

  const allowedFontFamilies =
    new Set(
      HOST_FONT_OPTIONS.map(
        item =>
          item.value
      )
    );

  const elements =
    Array.from(
      template.content
        .querySelectorAll(
          "*"
        )
    );

  elements
    .reverse()
    .forEach(
      element => {
        if (
          !allowedTags.has(
            element.tagName
          )
        ) {
          element.replaceWith(
            document.createTextNode(
              element.textContent ||
              ""
            )
          );

          return;
        }

        Array.from(
          element.attributes
        ).forEach(
          attribute => {
            if (
              attribute.name !==
              "style"
            ) {
              element.removeAttribute(
                attribute.name
              );
            }
          }
        );

        if (
          !(
            element instanceof
            HTMLElement
          )
        ) {
          return;
        }

        const originalStyle = {
          fontSize:
            element.style
              .fontSize,

          color:
            element.style
              .color,

          fontFamily:
            element.style
              .fontFamily,

          fontWeight:
            element.style
              .fontWeight,

          textDecoration:
            element.style
              .textDecoration,
        };

        element.removeAttribute(
          "style"
        );

        const fontSize =
          Number.parseFloat(
            originalStyle.fontSize
          );

        if (
          Number.isFinite(
            fontSize
          )
        ) {
          element.style
            .fontSize =
            `${Math.min(
              100,
              Math.max(
                1,
                fontSize
              )
            )}px`;
        }

        if (
          originalStyle.color
        ) {
          element.style.color =
            originalStyle.color;
        }

        if (
          allowedFontFamilies.has(
            originalStyle
              .fontFamily
          )
        ) {
          element.style
            .fontFamily =
            originalStyle
              .fontFamily;
        }

        if (
          originalStyle
            .fontWeight ===
            "800" ||
          originalStyle
            .fontWeight ===
            "700" ||
          originalStyle
            .fontWeight ===
            "bold"
        ) {
          element.style
            .fontWeight =
            "800";
        }

        if (
          originalStyle
            .textDecoration
            .includes(
              "underline"
            )
        ) {
          element.style
            .textDecoration =
            "underline";
        }
      }
    );

  return template.innerHTML;
}

function checkHostImage(
  file: File
) {
  if (
    !HOST_IMAGE_TYPES.has(
      file.type
    )
  ) {
    throw new Error(
      "JPG, PNG, WEBP, GIF 이미지만 등록할 수 있습니다."
    );
  }

  if (
    file.size <= 0 ||
    file.size >
      HOST_MAX_IMAGE_SIZE
  ) {
    throw new Error(
      "이미지는 한 장당 최대 5MB까지 등록할 수 있습니다."
    );
  }
}

function buildHostEditorBlocksFromPost(
  post: any,
  attachments: any[]
): HostEditorBlock[] {
  const attachmentMap =
    new Map<number, any>(
      (
        Array.isArray(
          attachments
        )
          ? attachments
          : []
      ).map(
        (attachment: any) => [
          Number(
            attachment.id
          ),
          attachment,
        ]
      )
    );

  const sourceBlocks =
    Array.isArray(
      post?.contentData
        ?.blocks
    )
      ? post.contentData.blocks
      : null;

  if (
    sourceBlocks &&
    sourceBlocks.length > 0
  ) {
    const result =
      sourceBlocks
        .map(
          (
            block: any,
            index: number
          ):
            | HostEditorBlock
            | null => {
            if (
              block?.type ===
              "image"
            ) {
              const attachmentId =
                Number(
                  block
                    .attachmentId ||
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
                id: `existing-image-${attachmentId}-${index}`,
                type: "image",
                file: null,
                previewUrl:
                  String(
                    attachment.url
                  ),
                attachmentId,
                existing: true,
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

              const text =
                String(
                  block.text ||
                    ""
                );

              return {
                id:
                  `existing-text-${index}`,

                type:
                  "text",

                text,

                html:
                  String(
                    block.html ||
                    ""
                  ).trim() ||
                  buildHostLegacyHtml(
                    block
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
                  Number.isFinite(
                    fontSize
                  )
                    ? Math.min(
                        100,
                        Math.max(
                          1,
                          fontSize
                        )
                      )
                    : 17,

                fontFamily:
                  String(
                    block.fontFamily ||
                      "inherit"
                  ),
              };
            }

            return null;
          }
        )
        .filter(
          (
            block
          ): block is HostEditorBlock =>
            Boolean(block)
        );

    if (
      result.length === 0 ||
      result[
        result.length - 1
      ]?.type === "image"
    ) {
      result.push(
        newHostTextBlock()
      );
    }

    return result;
  }

  const fallback:
    HostEditorBlock[] = [
    {
      ...newHostTextBlock(),
      text:
        String(
          post?.content ||
            ""
        ),
    },
  ];

  (
    Array.isArray(
      attachments
    )
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
        id: `existing-image-${attachmentId}-${index}`,
        type: "image",
        file: null,
        previewUrl: url,
        attachmentId,
        existing: true,
      });
    }
  );

  if (
    fallback[
      fallback.length - 1
    ]?.type === "image"
  ) {
    fallback.push(
      newHostTextBlock()
    );
  }

  return fallback;
}

function getHostPlainContent(
  blocks:
    HostEditorBlock[]
) {
  return blocks
    .filter(
      (
        block
      ): block is HostTextBlock =>
        block.type ===
        "text"
    )
    .map(
      block =>
        block.text.trim()
    )
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

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

const [
  writeBlocks,
  setWriteBlocks,
] =
  useState<
    HostEditorBlock[]
  >([
    newHostTextBlock(),
  ]);

const [
  writeActiveId,
  setWriteActiveId,
] =
  useState(
    () =>
      writeBlocks.find(
        block =>
          block.type ===
          "text"
      )?.id || ""
  );

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

const [editBoardId, setEditBoardId] =
  useState<number | null>(null);

const [
  editBlocks,
  setEditBlocks,
] =
  useState<
    HostEditorBlock[]
  >([
    newHostTextBlock(),
  ]);

const [
  editActiveId,
  setEditActiveId,
] =
  useState("");

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

  const firstBlock =
  newHostTextBlock();

setWriteMode("post");
setWriteBoardId(
  initialBoardId
);
setWriteTitle("");
setWriteBlocks([
  firstBlock,
]);
setWriteActiveId(
  firstBlock.id
);
};

const openNoticeWriter = () => {
  const firstBlock =
    newHostTextBlock();

  setWriteMode(
    "notice"
  );

  setWriteBoardId(null);
  setWriteTitle("");

  setWriteBlocks([
    firstBlock,
  ]);

  setWriteActiveId(
    firstBlock.id
  );
};

const closeWriter = () => {
  if (
  createPostMutation.isPending ||
  createNoticeMutation.isPending ||
  isUploadingImages
) {
    return;
  }

  const firstBlock =
  newHostTextBlock();

setWriteMode(null);
setWriteBoardId(null);
setWriteTitle("");
setWriteBlocks([
  firstBlock,
]);
setWriteActiveId(
  firstBlock.id
);
};

const uploadHostBlockImages =
  async (
    postId: number,
    blocks:
      HostEditorBlock[],
    setUploading:
      (
        value: boolean
      ) => void
  ) => {
    const attachmentIds =
      new Map<
        string,
        number
      >();

    setUploading(true);

    try {
      for (
        const block of
        blocks
      ) {
        if (
          block.type !==
          "image"
        ) {
          continue;
        }

        if (
          block.existing &&
          block.attachmentId
        ) {
          continue;
        }

        if (!block.file) {
          throw new Error(
            "추가한 이미지 파일을 확인할 수 없습니다."
          );
        }

        const formData =
          new FormData();

        formData.append(
          "file",
          block.file
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

        if (
          !response.ok
        ) {
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
            uploaded
              ?.storedName ||
              uploaded?.key ||
              uploaded
                ?.objectKey ||
              ""
          ).trim();

        if (!url) {
          throw new Error(
            "업로드 URL 없음"
          );
        }

        const registered =
          await registerImageMutation
            .mutateAsync({
              postId,

              originalName:
                String(
                  uploaded
                    ?.originalName ||
                    block.file.name
                ).slice(
                  0,
                  255
                ),

              storedName:
                storedName ||
                null,

              url,

              mimeType:
                block.file
                  .type as
                  | "image/jpeg"
                  | "image/png"
                  | "image/webp"
                  | "image/gif",

              sizeBytes:
                block.file
                  .size,
            });

        const attachmentId =
          Number(
            (registered as any)
              ?.attachmentId ||
              (registered as any)
                ?.id ||
              0
          );

        if (
          !attachmentId
        ) {
          throw new Error(
            "이미지 첨부 정보를 확인할 수 없습니다."
          );
        }

        attachmentIds.set(
          block.id,
          attachmentId
        );
      }
    } finally {
      setUploading(
        false
      );
    }

    return {
      version: 1,

      blocks:
        blocks.map(
          block => {
            if (
              block.type ===
              "image"
            ) {
              const attachmentId =
                block.existing
                  ? block
                      .attachmentId
                  : attachmentIds.get(
                      block.id
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
                block.text,

              html:
                block.html,

              align:
                block.align,

              bold:
                block.bold,

              underline:
                block.underline,

              color:
                block.color,

              fontSize:
                block.fontSize,

              fontFamily:
                block.fontFamily,
            };
          }
        ),
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

const openPostEditor =
  () => {
    if (
      !postDetail ||
      postDetail.isMine !==
        true
    ) {
      return;
    }

    const blocks =
      buildHostEditorBlocksFromPost(
        postDetail,
        postAttachments
      );

    const firstText =
      blocks.find(
        (
          block
        ): block is HostTextBlock =>
          block.type ===
          "text"
      );

    setEditTitle(
      String(
        postDetail.title ||
          ""
      )
    );

    setEditBoardId(
      postDetail.boardId
        ? Number(
            postDetail.boardId
          )
        : null
    );

    setEditBlocks(
      blocks
    );

    setEditActiveId(
      firstText?.id ||
        ""
    );

    setEditDeletedAttachmentIds(
      []
    );

    setIsEditOpen(
      true
    );
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

  setEditDeletedAttachmentIds(
    []
  );
};

const handleSubmitEdit =
  async () => {
    if (
      !selectedPostId ||
      !postDetail ||
      postDetail.isMine !==
        true
    ) {
      return;
    }

    const title =
      editTitle.trim();

    const content =
      getHostPlainContent(
        editBlocks
      );

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
      const finalContentData =
        await uploadHostBlockImages(
          selectedPostId,
          editBlocks,
          setIsUploadingEditImages
        );

      if (
        isDetailNotice
      ) {
        await updateNoticeMutation
          .mutateAsync({
            postId:
              selectedPostId,
            title,
            content,
            contentFormat:
              "blocks",
            contentData:
              finalContentData,
            deletedAttachmentIds:
              editDeletedAttachmentIds,
          });
      } else {
        if (
          !editBoardId
        ) {
          window.alert(
            "게시판을 선택해주세요."
          );
          return;
        }

        await updatePostMutation
          .mutateAsync({
            postId:
              selectedPostId,
            boardId:
              editBoardId,
            title,
            content,
            contentFormat:
              "blocks",
            contentData:
              finalContentData,
            deletedAttachmentIds:
              editDeletedAttachmentIds,
          });
      }

      await Promise.all([
        postQuery.refetch(),
        postsQuery.refetch(),
      ]);

      setIsEditOpen(
        false
      );

      setEditDeletedAttachmentIds(
        []
      );
    } catch (
      error: any
    ) {
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

const handleSubmitWriter =
  async () => {
    const title =
      writeTitle.trim();

    const content =
      getHostPlainContent(
        writeBlocks
      );

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

    if (
      writeMode ===
        "post" &&
      !writeBoardId
    ) {
      window.alert(
        "게시판을 선택해주세요."
      );
      return;
    }

    let createdPostId:
  number | null =
  null;

let createdNewPost =
  false;

try {
      const firstContentData =
        {
          version: 1,

          blocks:
            writeBlocks
              .filter(
                (
                  block
                ): block is HostTextBlock =>
                  block.type ===
                  "text"
              )
              .map(
                block => ({
                  type:
                    "text",

                  text:
                    block.text,

                  html:
                    block.html,

                  align:
                    block.align,

                  bold:
                    block.bold,

                  underline:
                    block.underline,

                  color:
                    block.color,

                  fontSize:
                    block.fontSize,

                  fontFamily:
                    block.fontFamily,
                })
              ),
        };

      if (
        writeMode ===
        "notice"
      ) {
        const result =
          await createNoticeMutation
            .mutateAsync({
              title,
              content,
              contentFormat:
                "blocks",
              contentData:
                firstContentData,
            });

        createdPostId =
          Number(
            (result as any)
              ?.postId ||
              (result as any)
                ?.id ||
              0
          ) || null;
      } else {
        const result =
          await createPostMutation
            .mutateAsync({
              boardId:
                writeBoardId!,
              title,
              content,
              contentFormat:
                "blocks",
              contentData:
                firstContentData,
            });

        createdPostId =
          Number(
            (result as any)
              ?.postId ||
              (result as any)
                ?.id ||
              0
          ) || null;
      }

      if (
        !createdPostId
      ) {
        throw new Error(
          "생성된 게시글 정보를 확인할 수 없습니다."
        );
      }

createdNewPost =
  true;

      const finalContentData =
        await uploadHostBlockImages(
          createdPostId,
          writeBlocks,
          setIsUploadingImages
        );

      if (
        writeMode ===
        "notice"
      ) {
        await updateNoticeMutation
          .mutateAsync({
            postId:
              createdPostId,
            title,
            content,
            contentFormat:
              "blocks",
            contentData:
              finalContentData,
            deletedAttachmentIds:
              [],
          });
      } else {
        await updatePostMutation
          .mutateAsync({
            postId:
              createdPostId,
            boardId:
              writeBoardId!,
            title,
            content,
            contentFormat:
              "blocks",
            contentData:
              finalContentData,
            deletedAttachmentIds:
              [],
          });
      }

      await postsQuery.refetch();

      setSelectedPostId(
        createdPostId
      );

      const firstBlock =
        newHostTextBlock();

      setWriteMode(null);
      setWriteBoardId(null);
      setWriteTitle("");
      setWriteBlocks([
        firstBlock,
      ]);
      setWriteActiveId(
        firstBlock.id
      );
   } catch (
  error: any
) {
  if (
    createdNewPost &&
    createdPostId
  ) {
    try {
      await deletePostMutation
        .mutateAsync({
          postId:
            createdPostId,
        });
    } catch {
      // cleanup 실패는 원래 저장 오류를 덮지 않음
    }
  }

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

  <HostPostBody
    post={
      postDetail
    }
    attachments={
      postAttachments
    }
  />
</div>

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
  <div className="mb-2 flex items-center justify-between">
    <label className="text-xs font-black text-slate-500">
      내용
    </label>

    <span className="text-[11px] font-bold text-slate-400">
      글 · 사진 자유배치 / Ctrl+V 지원
    </span>
  </div>

  <HostBlockEditor
    blocks={
      editBlocks
    }
    setBlocks={
      setEditBlocks
    }
    activeId={
      editActiveId
    }
    setActiveId={
      setEditActiveId
    }
    deletedAttachmentIds={
      editDeletedAttachmentIds
    }
    setDeletedAttachmentIds={
      setEditDeletedAttachmentIds
    }
    disabled={
      updatePostMutation.isPending ||
      updateNoticeMutation.isPending ||
      isUploadingEditImages
    }
  />
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
  <div className="mb-2 flex items-center justify-between">
    <label className="text-xs font-black text-slate-500">
      내용
    </label>

    <span className="text-[11px] font-bold text-slate-400">
      글 · 사진 자유배치 / Ctrl+V 지원
    </span>
  </div>

  <HostBlockEditor
    blocks={
      writeBlocks
    }
    setBlocks={
      setWriteBlocks
    }
    activeId={
      writeActiveId
    }
    setActiveId={
      setWriteActiveId
    }
    deletedAttachmentIds={
      []
    }
    setDeletedAttachmentIds={() => {}}
    disabled={
      createPostMutation.isPending ||
      createNoticeMutation.isPending ||
      isUploadingImages
    }
  />
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

function HostBlockEditor({
  blocks,
  setBlocks,
  activeId,
  setActiveId,
  deletedAttachmentIds,
  setDeletedAttachmentIds,
  disabled = false,
}: {
  blocks:
    HostEditorBlock[];

  setBlocks:
    React.Dispatch<
      React.SetStateAction<
        HostEditorBlock[]
      >
    >;

  activeId:
    string;

  setActiveId:
    React.Dispatch<
      React.SetStateAction<
        string
      >
    >;

  deletedAttachmentIds:
    number[];

  setDeletedAttachmentIds:
    React.Dispatch<
      React.SetStateAction<
        number[]
      >
    >;

  disabled?: boolean;
}) {
  const fileRef =
    useRef<
      HTMLInputElement | null
    >(
      null
    );

  const active =
    blocks.find(
      (
        block
      ): block is HostTextBlock =>
        block.type ===
          "text" &&
        block.id ===
          activeId
    );

  const imageCount =
    blocks.filter(
      block =>
        block.type ===
        "image"
    ).length;

  const editorRefs =
    useRef<
      Record<
        string,
        HTMLDivElement | null
      >
    >({});

    const savedRangeRef =
    useRef<
      Range | null
    >(null);

  const [
    selectionStyle,
    setSelectionStyle,
  ] = useState({
    fontSize: 17,
    color: "#0f172a",
    fontFamily: "inherit",
    bold: false,
    underline: false,
  });

  const rgbToHex =
    (
      value: string
    ) => {
      if (
        /^#[0-9a-f]{6}$/i.test(
          value
        )
      ) {
        return value;
      }

      const match =
        value.match(
          /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/
        );

      if (!match) {
        return "#0f172a";
      }

      return `#${[
        Number(match[1]),
        Number(match[2]),
        Number(match[3]),
      ]
        .map(value =>
          Math.max(
            0,
            Math.min(
              255,
              value
            )
          )
            .toString(16)
            .padStart(
              2,
              "0"
            )
        )
        .join("")}`;
    };

  const resolveHostFontFamily =
    (
      value: string
    ) => {
      const font =
        String(
          value || ""
        ).toLowerCase();

      if (
        font.includes(
          "malgun gothic"
        )
      ) {
        return '"Malgun Gothic", sans-serif';
      }

      if (
        font.includes(
          "dotum"
        )
      ) {
        return "Dotum, sans-serif";
      }

      if (
        font.includes(
          "gulim"
        )
      ) {
        return "Gulim, sans-serif";
      }

      if (
        font.includes(
          "batang"
        )
      ) {
        return "Batang, serif";
      }

      if (
        font.includes(
          "serif"
        ) &&
        !font.includes(
          "sans-serif"
        )
      ) {
        return "serif";
      }

      return "inherit";
    };

  const readSelectionStyle =
    (
      blockId: string,
      range: Range
    ) => {
      const editor =
        editorRefs.current[
          blockId
        ];

      if (!editor) {
        return;
      }

      let node:
        Node | null =
        range.startContainer;

      if (
        node.nodeType ===
        Node.TEXT_NODE
      ) {
        node =
          node.parentNode;
      }

      const element =
        node instanceof
        HTMLElement
          ? node
          : editor;

      const target =
        editor.contains(
          element
        )
          ? element
          : editor;

      const computed =
        window.getComputedStyle(
          target
        );

      const fontSize =
        Math.min(
          100,
          Math.max(
            1,
            Math.round(
              Number.parseFloat(
                computed.fontSize
              ) || 17
            )
          )
        );

      const fontWeight =
        Number.parseInt(
          computed.fontWeight,
          10
        );

      setSelectionStyle({
        fontSize,

        color:
          rgbToHex(
            computed.color
          ),

        fontFamily:
          resolveHostFontFamily(
            computed.fontFamily
          ),

        bold:
          computed.fontWeight ===
            "bold" ||
          (
            Number.isFinite(
              fontWeight
            ) &&
            fontWeight >= 600
          ),

        underline:
          computed.textDecorationLine
            .includes(
              "underline"
            ),
      });
    };

  const rememberSelection =
    (
      blockId: string
    ) => {
      setActiveId(
        blockId
      );

      const editor =
        editorRefs.current[
          blockId
        ];

      const selection =
        window.getSelection();

      if (
        !editor ||
        !selection ||
        selection.rangeCount ===
          0
      ) {
        return;
      }

      const range =
        selection.getRangeAt(
          0
        );

      if (
        !editor.contains(
          range.commonAncestorContainer
        )
      ) {
        return;
      }

            savedRangeRef.current =
        range.cloneRange();

      readSelectionStyle(
        blockId,
        range
      );
    };

  const restoreSelection =
    () => {
      const editor =
        editorRefs.current[
          activeId
        ];

      const range =
        savedRangeRef.current;

      if (
        !editor ||
        !range ||
        !editor.contains(
          range.commonAncestorContainer
        )
      ) {
        return null;
      }

      const selection =
        window.getSelection();

      if (!selection) {
        return null;
      }

      editor.focus();

      selection.removeAllRanges();

      selection.addRange(
        range
      );

      return {
        editor,
        selection,
        range,
      };
    };

  const syncRichBlock =
    (
      blockId: string
    ) => {
      const editor =
        editorRefs.current[
          blockId
        ];

      if (!editor) {
        return;
      }

      const text =
        editor.innerText
          .replace(
            /\u200B/g,
            ""
          );

      const html =
        editor.innerHTML;

      setBlocks(
        current =>
          current.map(
            block =>
              block.type ===
                "text" &&
              block.id ===
                blockId
                ? {
                    ...block,
                    text,
                    html,
                  }
                : block
          )
      );
    };

  const applyInlineStyle =
    (
      styles:
        Record<
          string,
          string
        >,
      metadata:
        Partial<
          HostTextBlock
        > = {}
    ) => {
      const restored =
        restoreSelection();

      if (
        !restored ||
        restored.range
          .collapsed
      ) {
        window.alert(
          "스타일을 변경할 글자를 먼저 드래그해서 선택해주세요."
        );

        return;
      }

      const {
        selection,
        range,
      } = restored;

      const span =
        document.createElement(
          "span"
        );

      Object.entries(
        styles
      ).forEach(
        ([
          key,
          value,
        ]) => {
          (
            span.style as any
          )[key] =
            value;
        }
      );

      const fragment =
        range.extractContents();

      span.appendChild(
        fragment
      );

      range.insertNode(
        span
      );

      const nextRange =
        document.createRange();

      nextRange.selectNodeContents(
        span
      );

      selection.removeAllRanges();

      selection.addRange(
        nextRange
      );

      savedRangeRef.current =
        nextRange.cloneRange();

      syncRichBlock(
        activeId
      );

            setSelectionStyle(
        current => ({
          ...current,
          ...(typeof metadata.fontSize ===
          "number"
            ? {
                fontSize:
                  metadata.fontSize,
              }
            : {}),
          ...(typeof metadata.color ===
          "string"
            ? {
                color:
                  metadata.color,
              }
            : {}),
          ...(typeof metadata.fontFamily ===
          "string"
            ? {
                fontFamily:
                  metadata.fontFamily,
              }
            : {}),
          ...(typeof metadata.bold ===
          "boolean"
            ? {
                bold:
                  metadata.bold,
              }
            : {}),
          ...(typeof metadata.underline ===
          "boolean"
            ? {
                underline:
                  metadata.underline,
              }
            : {}),
        })
      );
    };

  const patch =
    (
      value:
        Partial<
          HostTextBlock
        >
    ) => {
      setBlocks(
        current =>
          current.map(
            block =>
              block.type ===
                "text" &&
              block.id ===
                activeId
                ? {
                    ...block,
                    ...value,
                  }
                : block
          )
      );
    };

  const addFiles =
    (
      files:
        File[]
    ) => {
      if (
        !files.length
      ) {
        return;
      }

      try {
        if (
          imageCount +
            files.length >
          HOST_MAX_IMAGES
        ) {
          throw new Error(
            `사진은 최대 ${HOST_MAX_IMAGES}장까지 등록할 수 있습니다.`
          );
        }

        files.forEach(
          checkHostImage
        );

        const imageBlocks:
          HostImageBlock[] =
          files.map(
            file => ({
              id:
                hostUid(
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

        const nextText =
          newHostTextBlock();

        setBlocks(
          current => {
            const index =
              current.findIndex(
                block =>
                  block.id ===
                  activeId
              );

            const copy =
              [
                ...current,
              ];

            copy.splice(
              index >= 0
                ? index + 1
                : copy.length,
              0,
              ...imageBlocks,
              nextText
            );

            return copy;
          }
        );

        setActiveId(
          nextText.id
        );
      } catch (
        error: any
      ) {
        window.alert(
          error?.message ||
            "사진을 추가하지 못했습니다."
        );
      }
    };

  const removeImage =
    (
      block:
        HostImageBlock
    ) => {
      if (
        block.existing &&
        block.attachmentId
      ) {
        setDeletedAttachmentIds(
          current =>
            Array.from(
              new Set([
                ...current,
                Number(
                  block.attachmentId
                ),
              ])
            )
        );
      }

      if (
        !block.existing &&
        block.previewUrl
          .startsWith(
            "blob:"
          )
      ) {
        URL.revokeObjectURL(
          block.previewUrl
        );
      }

      setBlocks(
        current =>
          current.filter(
            item =>
              item.id !==
              block.id
          )
      );
    };

    const handlePaste =
    (
      event:
        React.ClipboardEvent<
          HTMLDivElement
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
        imageFiles.length >
        0
      ) {
        event.preventDefault();

        addFiles(
          imageFiles
        );

        return;
      }

      const plainText =
        event.clipboardData
          .getData(
            "text/plain"
          );

      if (!plainText) {
        return;
      }

      event.preventDefault();

      document.execCommand(
        "insertText",
        false,
        plainText
      );

      window.requestAnimationFrame(
        () => {
          syncRichBlock(
            activeId
          );

          rememberSelection(
            activeId
          );
        }
      );
    };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex min-h-12 flex-wrap items-center gap-1 border-b border-slate-200 px-2 py-2">
        
        <select
          disabled={
            disabled
          }
          value={
            selectionStyle.fontFamily
          }
          onChange={
            event => {
              const fontFamily =
                event.target
                  .value;

              applyInlineStyle(
                {
                  fontFamily,
                },
                {
                  fontFamily,
                }
              );
            }
          }
          className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 outline-none disabled:opacity-40"
          aria-label="글꼴"
        >
          {HOST_FONT_OPTIONS.map(
            option => (
              <option
                key={
                  option.value
                }
                value={
                  option.value
                }
              >
                {option.label}
              </option>
            )
          )}
        </select>

        <div className="flex h-9 items-center overflow-hidden rounded-lg border border-slate-200 bg-white">
          <button
            type="button"
            disabled={
              disabled
            }
            onClick={() => {
              const fontSize =
                Math.max(
                  1,
                  Number(
                    selectionStyle.fontSize ||
                      17
                  ) - 1
                );

              applyInlineStyle(
                {
                  fontSize:
                    `${fontSize}px`,
                },
                {
                  fontSize,
                }
              );
            }}
            className="flex h-full w-8 items-center justify-center border-r border-slate-200 text-base font-black text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            aria-label="글씨 작게"
          >
            −
          </button>

          <input
            type="number"
            min={1}
            max={100}
            disabled={
              disabled
            }
            value={
              selectionStyle.fontSize
            }
            onChange={
              event => {
                const fontSize =
                  Math.min(
                    100,
                    Math.max(
                      1,
                      Number(
                        event.target
                          .value
                      ) || 17
                    )
                  );

                applyInlineStyle(
                  {
                    fontSize:
                      `${fontSize}px`,
                  },
                  {
                    fontSize,
                  }
                );
              }
            }
            className="h-full w-[48px] border-0 bg-white text-center text-xs font-black text-slate-800 outline-none disabled:bg-slate-50"
          />

          <span className="pr-1 text-[10px] font-bold text-slate-400">
            px
          </span>

          <button
            type="button"
            disabled={
              disabled
            }
            onClick={() => {
              const fontSize =
                Math.min(
                  100,
                  Number(
                    selectionStyle.fontSize ||
                      17
                  ) + 1
                );

              applyInlineStyle(
                {
                  fontSize:
                    `${fontSize}px`,
                },
                {
                  fontSize,
                }
              );
            }}
            className="flex h-full w-8 items-center justify-center border-l border-slate-200 text-base font-black text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            aria-label="글씨 크게"
          >
            +
          </button>
        </div>

        <button
          type="button"
          disabled={
            disabled
          }
          onClick={() => {
            const bold =
              !selectionStyle.bold;

            applyInlineStyle(
              {
                fontWeight:
                  bold
                    ? "800"
                    : "500",
              },
              {
                bold,
              }
            );
          }}
          className={`h-8 min-w-8 rounded-lg px-2 text-sm font-black ${
            selectionStyle.bold
  ? "bg-slate-900 text-white"
              : "text-slate-700"
          }`}
        >
          B
        </button>

        <button
          type="button"
          disabled={
            disabled
          }
          onClick={() => {
            const underline =
              !selectionStyle.underline;

            applyInlineStyle(
              {
                textDecoration:
                  underline
                    ? "underline"
                    : "none",
              },
              {
                underline,
              }
            );
          }}
          className={`h-8 min-w-8 rounded-lg px-2 text-sm font-black underline ${
            selectionStyle.underline
  ? "bg-slate-900 text-white"
              : "text-slate-700"
          }`}
          aria-label="밑줄"
          title="밑줄"
        >
          U
        </button>

        <button
          type="button"
          disabled={
            disabled
          }
          onClick={() =>
            patch({
              align:
                "left",
            })
          }
          className={`h-8 min-w-8 rounded-lg px-2 text-sm font-black ${
            active?.align ===
            "left"
              ? "bg-slate-100 text-slate-950"
              : "text-slate-700"
          }`}
        >
          ≡
        </button>

        <button
          type="button"
          disabled={
            disabled
          }
          onClick={() =>
            patch({
              align:
                "center",
            })
          }
          className={`h-8 min-w-8 rounded-lg px-2 text-sm font-black ${
            active?.align ===
            "center"
              ? "bg-slate-100 text-slate-950"
              : "text-slate-700"
          }`}
        >
          ≣
        </button>

        <button
          type="button"
          disabled={
            disabled
          }
          onClick={() =>
            patch({
              align:
                "right",
            })
          }
          className={`h-8 min-w-8 rounded-lg px-2 text-sm font-black ${
            active?.align ===
            "right"
              ? "bg-slate-100 text-slate-950"
              : "text-slate-700"
          }`}
        >
          ≡›
        </button>

        <label className="relative flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-extrabold text-slate-700 hover:bg-slate-50">
          <span
            className="flex h-5 w-5 items-center justify-center rounded border border-slate-200 font-black"
            style={{
              color:
                selectionStyle.color,
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
                selectionStyle.color,
            }}
          />

          <input
            type="color"
            disabled={
              disabled
            }
            value={
              selectionStyle.color
            }
            onChange={
              event => {
                const color =
                  event.target
                    .value;

                applyInlineStyle(
                  {
                    color,
                  },
                  {
                    color,
                  }
                );
              }
            }
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>

        <button
          type="button"
          disabled={
            disabled
          }
          onClick={() =>
            fileRef.current
              ?.click()
          }
          className="ml-auto flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-extrabold text-slate-600"
        >
          <ImageIcon
            size={16}
          />
          사진
        </button>
      </div>

      <div className="min-h-[330px] px-3 py-3">
        {blocks.map(
          block =>
            block.type ===
            "image" ? (
              <div
                key={
                  block.id
                }
                className="relative my-3 overflow-hidden rounded-xl bg-slate-50"
              >
                <img
                  src={
                    block.previewUrl
                  }
                  alt=""
                  className="max-h-[520px] w-full object-contain"
                />

                <button
                  type="button"
                  disabled={
                    disabled
                  }
                  onClick={() =>
                    removeImage(
                      block
                    )
                  }
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/75 text-sm font-black text-white"
                >
                  ×
                </button>
              </div>
            ) : (
                            <div
                key={
                  block.id
                }
                ref={
                  node => {
                    editorRefs.current[
                      block.id
                    ] =
                      node;
                  }
                }
                contentEditable={
                  !disabled
                }
                suppressContentEditableWarning
                onFocus={() => {
                  setActiveId(
                    block.id
                  );

                  window.requestAnimationFrame(
                    () =>
                      rememberSelection(
                        block.id
                      )
                  );
                }}
                onMouseUp={() =>
                  rememberSelection(
                    block.id
                  )
                }
                onKeyUp={() =>
                  rememberSelection(
                    block.id
                  )
                }
                onPaste={
                  handlePaste
                }
                onInput={
                  event => {
                    const editor =
                      event.currentTarget;

                    const text =
                      editor.innerText
                        .replace(
                          /\u200B/g,
                          ""
                        );

                    const html =
                      editor.innerHTML;

                    setBlocks(
                      current =>
                        current.map(
                          item =>
                            item.type ===
                              "text" &&
                            item.id ===
                              block.id
                              ? {
                                  ...item,
                                  text,
                                  html,
                                }
                              : item
                        )
                    );
                  }
                }
                data-placeholder="내용을 입력하거나 캡처 이미지를 Ctrl+V로 붙여넣어주세요."
                className="my-1 min-h-[112px] w-full whitespace-pre-wrap bg-transparent px-1 py-2 text-[17px] font-medium leading-7 text-slate-900 outline-none empty:before:pointer-events-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]"
                style={{
                  textAlign:
                    block.align,
                }}
                dangerouslySetInnerHTML={{
                  __html:
                    block.html ||
                    escapeHostRichText(
                      block.text
                    ),
                }}
              />
            )
        )}
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 px-3 py-3">
        <button
          type="button"
          disabled={
            disabled
          }
          onClick={() =>
            fileRef.current
              ?.click()
          }
          className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-extrabold text-slate-600"
        >
          <ImageIcon
            size={16}
          />
          사진 추가
        </button>

        <div className="text-[11px] font-bold text-slate-400">
          이미지{" "}
          {imageCount}/
          {HOST_MAX_IMAGES} ·
          Ctrl+V 가능
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={
          event => {
            const files =
              Array.from(
                event.target
                  .files ||
                  []
              );

            event.currentTarget.value =
              "";

            addFiles(files);
          }
        }
      />
    </div>
  );
}

function HostPostBody({
  post,
  attachments,
}: {
  post: any;
  attachments: any[];
}) {
  const attachmentMap =
    useMemo(
      () =>
        new Map(
          (
            Array.isArray(
              attachments
            )
              ? attachments
              : []
          ).map(
            (
              attachment: any
            ) => [
              Number(
                attachment.id
              ),
              attachment,
            ]
          )
        ),
      [
        attachments,
      ]
    );

  const blocks =
    Array.isArray(
      post?.contentData
        ?.blocks
    )
      ? post.contentData.blocks
      : null;

  if (
    !blocks?.length
  ) {
    return (
      <div className="py-6">
        <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
          {post?.content ||
            ""}
        </div>

        {attachments.length >
        0 ? (
          <div className="mt-5 space-y-4">
            {attachments.map(
              (
                attachment: any
              ) => (
                <img
                  key={
                    attachment.id
                  }
                  src={
                    attachment.url
                  }
                  alt=""
                  className="max-h-[520px] w-full rounded-xl object-contain"
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
          block: any,
          index: number
        ) => {
          if (
            block?.type ===
            "image"
          ) {
            const attachment =
              attachmentMap.get(
                Number(
                  block.attachmentId ||
                    0
                )
              );

            return attachment?.url ? (
              <img
                key={`image-${index}`}
                src={
                  attachment.url
                }
                alt=""
                className="max-h-[520px] w-full rounded-xl object-contain"
              />
            ) : null;
          }

                   if (
            block?.type ===
            "text"
          ) {
            const richHtml =
              String(
                block.html ||
                ""
              ).trim();

            if (
              richHtml
            ) {
              return (
                <div
                  key={`text-${index}`}
                  className="whitespace-pre-wrap text-[17px] font-medium leading-8 text-slate-800"
                  style={{
                    textAlign:
                      block.align ===
                        "center" ||
                      block.align ===
                        "right"
                        ? block.align
                        : "left",
                  }}
                  dangerouslySetInnerHTML={{
                    __html:
                      sanitizeHostRichHtml(
                        richHtml
                      ),
                  }}
                />
              );
            }

            return (
              <div
                key={`text-${index}`}
                className="whitespace-pre-wrap leading-8"
                style={{
                  textAlign:
                    block.align ===
                      "center" ||
                    block.align ===
                      "right"
                      ? block.align
                      : "left",

                  fontSize:
                    Math.min(
                      100,
                      Math.max(
                        1,
                        Number(
                          block.fontSize
                        ) || 17
                      )
                    ),

                  fontWeight:
                    block.bold
                      ? 800
                      : 500,

                  textDecoration:
                    block.underline
                      ? "underline"
                      : "none",

                  color:
                    String(
                      block.color ||
                        "#1e293b"
                    ),

                  fontFamily:
                    String(
                      block.fontFamily ||
                        "inherit"
                    ),
                }}
              >
                {String(
                  block.text ||
                    ""
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
