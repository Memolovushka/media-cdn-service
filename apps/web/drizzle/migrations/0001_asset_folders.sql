ALTER TABLE `assets` ADD `folder_path` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `assets_workspace_folder_idx` ON `assets` (`workspace_id`,`folder_path`);--> statement-breakpoint
CREATE TABLE `asset_folders` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`path` text NOT NULL,
	`name` text NOT NULL,
	`created_by_user_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `asset_folders_workspace_path_idx` ON `asset_folders` (`workspace_id`,`path`);--> statement-breakpoint
CREATE INDEX `asset_folders_workspace_id_idx` ON `asset_folders` (`workspace_id`);
