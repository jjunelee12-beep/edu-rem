// server/nile/run-nile-standard-seed.ts

import "dotenv/config";

import {
  seedNileStandardCurriculums,
} from "./nile-standard-seed";


async function main() {
  console.log(
    "[NILE SEED RUNNER] start"
  );

  try {
    const result =
      await seedNileStandardCurriculums();

    console.log(
      "[NILE SEED RUNNER] success",
      JSON.stringify(
        result,
        null,
        2
      )
    );

    process.exit(0);
  } catch (error) {
    console.error(
      "[NILE SEED RUNNER] failed",
      error
    );

    process.exit(1);
  }
}


void main();