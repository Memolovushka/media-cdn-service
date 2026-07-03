CREATE TABLE `user_billing` (
	`user_id` text PRIMARY KEY NOT NULL,
	`plan` text DEFAULT 'free' NOT NULL,
	`billing_status` text DEFAULT 'free' NOT NULL,
	`polar_customer_id` text,
	`polar_subscription_id` text,
	`polar_product_id` text,
	`current_period_end` integer,
	`workspace_limit` integer DEFAULT 1 NOT NULL,
	`storage_quota_bytes` integer DEFAULT 1073741824 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_billing_plan_idx` ON `user_billing` (`plan`);
--> statement-breakpoint
CREATE INDEX `user_billing_subscription_idx` ON `user_billing` (`polar_subscription_id`);
