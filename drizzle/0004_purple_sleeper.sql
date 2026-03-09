ALTER TABLE `plans` ADD `practiceStatus` enum('미섭외','섭외중','섭외완료') DEFAULT '미섭외';--> statement-breakpoint
ALTER TABLE `students` ADD `approvedAt` timestamp;--> statement-breakpoint
ALTER TABLE `students` ADD `rejectedAt` timestamp;