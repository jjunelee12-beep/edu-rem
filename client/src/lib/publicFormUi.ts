import type { PublicFormUiConfig } from "@/types/publicFormUi";

export function createDefaultPublicFormUiConfig(
  formType: "landing" | "ad"
): PublicFormUiConfig {
  return {
    title: "목표를 향한 배움의 길, 위드원 교육이 함께할게요",
    subtitle: "상담은 100% 무료로 진행됩니다.",
    logoUrl: "/images/logo.png",
    heroImageUrl: "",
    primaryColor: "#5fc065",
    submitButtonText: "1:1 맞춤 상담 받기",
    agreementText: "개인정보 수집 및 이용에 동의합니다.",
    layoutType: formType === "ad" ? "bottomSheet" : "card",

    fields: [
      {
        fieldKey: "clientName",
        label: "이름",
        placeholder: "이름",
        required: true,
        hidden: false,
        order: 1,
        type: "text",
      },
      {
        fieldKey: "phone",
        label: "전화번호",
        placeholder: "전화번호",
        required: true,
        hidden: false,
        order: 2,
        type: "phone",
      },
      {
        fieldKey: "finalEducation",
        label: "최종학력",
        placeholder: "최종학력 선택",
        required: true,
        hidden: false,
        order: 3,
        type: "select",
        options: [
          { label: "고등학교 졸업", value: "고등학교 졸업" },
          { label: "전문학사", value: "전문학사" },
          { label: "학사", value: "학사" },
          { label: "석사 이상", value: "석사 이상" },
          { label: "기타", value: "기타" },
        ],
      },
      {
        fieldKey: "desiredCourse",
        label: "희망과정",
        placeholder: "희망과정 선택",
        required: true,
        hidden: false,
        order: 4,
        type: "select",
        options:
          formType === "landing"
            ? [
                { label: "사회복지사", value: "사회복지사" },
                { label: "보육교사", value: "보육교사" },
                { label: "평생교육사", value: "평생교육사" },
                { label: "건강가정사", value: "건강가정사" },
                { label: "한국어교원", value: "한국어교원" },
                { label: "청소년지도사", value: "청소년지도사" },
                { label: "산업기사/기사", value: "산업기사/기사" },
                { label: "전문학사/학사", value: "전문학사/학사" },
                { label: "기타", value: "기타" },
              ]
            : [
                { label: "사회복지사", value: "사회복지사" },
                { label: "보육교사", value: "보육교사" },
                { label: "평생교육사", value: "평생교육사" },
                { label: "건강가정사", value: "건강가정사" },
                { label: "한국어교원", value: "한국어교원" },
                { label: "전문학사/학사", value: "전문학사/학사" },
                { label: "기타", value: "기타" },
              ],
      },
      {
        fieldKey: "channel",
        label: "문의경로",
        placeholder:
          formType === "landing"
            ? "문의경로 (예. 블로그, 인스타, 지인추천)"
            : "문의경로",
        required: formType === "landing",
        hidden: false,
        order: 5,
        type: "text",
      },
      {
        fieldKey: "notes",
        label: "상담내역",
        placeholder: "진행하시면서 걱정되시는 부분 적어주세요!",
        required: false,
        hidden: false,
        order: 6,
        type: "textarea",
      },
      {
        fieldKey: "agreed",
        label: "개인정보 수집 및 이용에 동의합니다.",
        placeholder: "",
        required: true,
        hidden: false,
        order: 7,
        type: "checkbox",
      },
    ],

    mapping: {
      clientName: "clientName",
      phone: "phone",
      finalEducation: "finalEducation",
      desiredCourse: "desiredCourse",
      channel: "channel",
      notes: "notes",
    },
  };
}