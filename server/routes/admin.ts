migrateSubjectCatalog: protectedProcedure
  .mutation(async ({ ctx }) => {
    if (ctx.user.role !== "superhost") {
      throw new Error("슈퍼호스트만 실행 가능");
    }

    const db = await getDb();

    await migrateCourseTemplatesToSubjectCatalogs(db);

    return { success: true };
  }),