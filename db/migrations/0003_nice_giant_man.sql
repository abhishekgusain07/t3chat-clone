CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"key_name" text NOT NULL,
	"provider" text NOT NULL,
	"encrypted_key" text NOT NULL,
	"key_hint" text NOT NULL,
	"is_valid" boolean DEFAULT false NOT NULL,
	"last_validated_at" timestamp,
	"validation_error" text,
	"request_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"inviter_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jwks" (
	"id" text PRIMARY KEY NOT NULL,
	"public_key" text NOT NULL,
	"private_key" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"logo" text,
	"created_at" timestamp NOT NULL,
	"metadata" text,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"credits_used" integer DEFAULT 0 NOT NULL,
	"search_calls_used" integer DEFAULT 0 NOT NULL,
	"research_calls_used" integer DEFAULT 0 NOT NULL,
	"file_uploads_used" integer DEFAULT 0 NOT NULL,
	"period_start" timestamp DEFAULT now() NOT NULL,
	"resets_at" timestamp NOT NULL,
	"current_tier" text DEFAULT 'Free' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "temporary_upgrades" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tier" text NOT NULL,
	"reason" text,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"usage_type" text NOT NULL,
	"model_used" text,
	"credits_consumed" integer DEFAULT 0 NOT NULL,
	"tokens_used" integer,
	"request_duration_ms" integer,
	"success" boolean DEFAULT true NOT NULL,
	"thread_id" text,
	"session_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" RENAME COLUMN "accountId" TO "account_id";--> statement-breakpoint
ALTER TABLE "account" RENAME COLUMN "providerId" TO "provider_id";--> statement-breakpoint
ALTER TABLE "account" RENAME COLUMN "userId" TO "user_id";--> statement-breakpoint
ALTER TABLE "account" RENAME COLUMN "accessToken" TO "access_token";--> statement-breakpoint
ALTER TABLE "account" RENAME COLUMN "refreshToken" TO "refresh_token";--> statement-breakpoint
ALTER TABLE "account" RENAME COLUMN "idToken" TO "id_token";--> statement-breakpoint
ALTER TABLE "account" RENAME COLUMN "accessTokenExpiresAt" TO "access_token_expires_at";--> statement-breakpoint
ALTER TABLE "account" RENAME COLUMN "refreshTokenExpiresAt" TO "refresh_token_expires_at";--> statement-breakpoint
ALTER TABLE "account" RENAME COLUMN "createdAt" TO "created_at";--> statement-breakpoint
ALTER TABLE "account" RENAME COLUMN "updatedAt" TO "updated_at";--> statement-breakpoint
ALTER TABLE "verification" RENAME COLUMN "expiresAt" TO "expires_at";--> statement-breakpoint
ALTER TABLE "verification" RENAME COLUMN "createdAt" TO "created_at";--> statement-breakpoint
ALTER TABLE "verification" RENAME COLUMN "updatedAt" TO "updated_at";--> statement-breakpoint
ALTER TABLE "account" DROP CONSTRAINT "account_userId_user_id_fk";
--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "active_organization_id" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_anonymous" boolean;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "tier" text DEFAULT 'Free' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "credits_purchased" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "last_seen_at" timestamp;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_limits" ADD CONSTRAINT "rate_limits_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temporary_upgrades" ADD CONSTRAINT "temporary_upgrades_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_api_keys_user" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_api_keys_provider" ON "api_keys" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_rate_limits_user_resets" ON "rate_limits" USING btree ("user_id","resets_at");--> statement-breakpoint
CREATE INDEX "idx_rate_limits_tier" ON "rate_limits" USING btree ("current_tier");--> statement-breakpoint
CREATE INDEX "idx_temp_upgrades_user_expires" ON "temporary_upgrades" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "idx_usage_logs_user_created" ON "usage_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_usage_logs_type_created" ON "usage_logs" USING btree ("usage_type","created_at");--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;