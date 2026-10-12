CREATE TABLE `wireframe_version` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`version` integer NOT NULL,
	`html` text NOT NULL,
	`instruction` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `plan`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wireframe_version_plan_version_idx` ON `wireframe_version` (`plan_id`,`version`);--> statement-breakpoint
ALTER TABLE `plan` ADD `wireframe_html` text;--> statement-breakpoint
ALTER TABLE `plan` ADD `current_wireframe_version` integer;