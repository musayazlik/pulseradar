CREATE TABLE `event_sources` (
	`event_id` text NOT NULL,
	`post_id` text NOT NULL,
	`evidence_json` text,
	`parser_version` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`event_id`, `post_id`),
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`post_id`) REFERENCES `social_posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`normalized_title` text NOT NULL,
	`description` text,
	`start_date` text,
	`end_date` text,
	`start_time` text,
	`end_time` text,
	`time_zone` text,
	`date_precision` text DEFAULT 'unknown' NOT NULL,
	`venue` text,
	`city` text,
	`city_normalized` text,
	`country` text,
	`attendance_mode` text DEFAULT 'unknown' NOT NULL,
	`organizer` text,
	`registration_url` text,
	`status` text DEFAULT 'needs_review' NOT NULL,
	`confidence` integer DEFAULT 0 NOT NULL,
	`first_discovered_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`manually_edited_fields` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_events_start_date` ON `events` (`start_date`);--> statement-breakpoint
CREATE INDEX `idx_events_status` ON `events` (`status`);--> statement-breakpoint
CREATE INDEX `idx_events_city_normalized` ON `events` (`city_normalized`);--> statement-breakpoint
CREATE TABLE `review_items` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text,
	`candidate_event_id` text,
	`reason` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text NOT NULL,
	`resolved_at` text,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`candidate_event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_reviews_status` ON `review_items` (`status`);--> statement-breakpoint
CREATE TABLE `scan_observations` (
	`task_id` text NOT NULL,
	`post_id` text NOT NULL,
	`observed_at` text NOT NULL,
	PRIMARY KEY(`task_id`, `post_id`),
	FOREIGN KEY (`task_id`) REFERENCES `scan_tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`post_id`) REFERENCES `social_posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `scan_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text DEFAULT 'scan' NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`config_snapshot` text,
	`created_at` text NOT NULL,
	`started_at` text,
	`finished_at` text,
	`cancel_requested_at` text,
	`worker_id` text,
	`heartbeat_at` text,
	`lease_expires_at` text,
	`counters_json` text DEFAULT '{}' NOT NULL,
	`stop_reason` text
);
--> statement-breakpoint
CREATE INDEX `idx_runs_status` ON `scan_runs` (`status`);--> statement-breakpoint
CREATE TABLE `scan_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`platform` text NOT NULL,
	`query` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`attempt` integer DEFAULT 0 NOT NULL,
	`checkpoint_json` text,
	`last_error` text,
	`reason_code` text,
	`posts_scanned` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`started_at` text,
	`finished_at` text,
	FOREIGN KEY (`run_id`) REFERENCES `scan_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_run` ON `scan_tasks` (`run_id`);--> statement-breakpoint
CREATE TABLE `session_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`platform` text NOT NULL,
	`status` text NOT NULL,
	`detail` text,
	`checked_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_session_checks_platform` ON `session_checks` (`platform`,`checked_at`);--> statement-breakpoint
CREATE TABLE `social_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`platform` text NOT NULL,
	`platform_post_id` text,
	`canonical_url` text NOT NULL,
	`account_name` text,
	`account_url` text,
	`published_at` text,
	`published_at_precision` text DEFAULT 'unknown' NOT NULL,
	`raw_text` text NOT NULL,
	`extracted_links` text DEFAULT '[]' NOT NULL,
	`first_seen_at` text NOT NULL,
	`last_seen_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_posts_platform_post_id` ON `social_posts` (`platform`,`platform_post_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_posts_platform_url` ON `social_posts` (`platform`,`canonical_url`);