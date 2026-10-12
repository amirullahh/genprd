CREATE TABLE `plan_document_version` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`version` integer NOT NULL,
	`content` text NOT NULL,
	`source` text NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `plan_document`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plan_document_version_doc_version_idx` ON `plan_document_version` (`document_id`,`version`);--> statement-breakpoint
CREATE TABLE `prototype_version` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`version` integer NOT NULL,
	`html` text NOT NULL,
	`instruction` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `plan`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prototype_version_plan_version_idx` ON `prototype_version` (`plan_id`,`version`);--> statement-breakpoint
ALTER TABLE `plan` ADD `current_prototype_version` integer;--> statement-breakpoint
ALTER TABLE `plan_document` ADD `current_version` integer DEFAULT 1 NOT NULL;