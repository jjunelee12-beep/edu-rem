CREATE TABLE `consultations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`consultDate` date NOT NULL,
	`channel` varchar(100) NOT NULL,
	`clientName` varchar(100) NOT NULL,
	`phone` varchar(30) NOT NULL,
	`desiredCourse` varchar(200),
	`notes` text,
	`status` varchar(50) NOT NULL DEFAULT '상담중',
	`assigneeId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `consultations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studentId` int NOT NULL,
	`desiredCourse` varchar(200),
	`finalEducation` varchar(100),
	`totalTheorySubjects` int,
	`hasPractice` boolean DEFAULT false,
	`specialNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `plans_studentId_unique` UNIQUE(`studentId`)
);
--> statement-breakpoint
CREATE TABLE `refunds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studentId` int NOT NULL,
	`semesterId` int,
	`refundAmount` decimal(12,0) NOT NULL,
	`refundDate` date NOT NULL,
	`reason` text,
	`assigneeId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `refunds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `semesters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studentId` int NOT NULL,
	`semesterLabel` varchar(50) NOT NULL,
	`semesterOrder` int NOT NULL,
	`plannedMonth` varchar(20),
	`plannedInstitution` varchar(200),
	`plannedSubjectCount` int,
	`plannedAmount` decimal(12,0),
	`practiceHours` int,
	`actualStartDate` date,
	`actualInstitution` varchar(200),
	`actualSubjectCount` int,
	`actualAmount` decimal(12,0),
	`actualPaymentDate` date,
	`isCompleted` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `semesters_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `students` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientName` varchar(100) NOT NULL,
	`phone` varchar(30) NOT NULL,
	`course` varchar(200) NOT NULL,
	`studentStatus` enum('등록','진행중','완료','중단') NOT NULL DEFAULT '등록',
	`startDate` date,
	`paymentAmount` decimal(12,0),
	`subjectCount` int,
	`paymentDate` date,
	`institution` varchar(200),
	`assigneeId` int NOT NULL,
	`consultationId` int,
	`approvalStatus` enum('대기','승인','불승인') NOT NULL DEFAULT '대기',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `students_id` PRIMARY KEY(`id`)
);
