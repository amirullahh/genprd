CREATE TABLE `chat_message_candidate` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`content` text NOT NULL,
	`selected` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `chat_message`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chat_message_candidate_message_idx` ON `chat_message_candidate` (`message_id`);--> statement-breakpoint
ALTER TABLE `user_setting` ADD `compare_models` text;