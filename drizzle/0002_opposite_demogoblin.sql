ALTER TABLE `students` MODIFY COLUMN `studentStatus` enum('등록','진행중','완료','중단','종료') NOT NULL DEFAULT '등록';--> statement-breakpoint
ALTER TABLE `plans` ADD `practiceHours` int;--> statement-breakpoint
ALTER TABLE `plans` ADD `practiceDate` varchar(50);--> statement-breakpoint
ALTER TABLE `plans` ADD `practiceArranged` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `semesters` ADD `isLocked` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `students` ADD `totalSemesters` int;--> statement-breakpoint
ALTER TABLE `semesters` DROP COLUMN `semesterLabel`;--> statement-breakpoint
ALTER TABLE `semesters` DROP COLUMN `practiceHours`;