ALTER TABLE `students` MODIFY COLUMN `approvedAt` timestamp DEFAULT null;--> statement-breakpoint
ALTER TABLE `students` MODIFY COLUMN `rejectedAt` timestamp DEFAULT null;