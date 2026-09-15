CREATE TABLE "contacts" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "contacts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"owner_id" bigint NOT NULL,
	"name" text NOT NULL,
	"linked_user_id" bigint,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contacts_owner_id_name_key" UNIQUE("owner_id","name")
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"requester_id" bigint NOT NULL,
	"addressee_id" bigint NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friendships_requester_id_addressee_id_pk" PRIMARY KEY("requester_id","addressee_id"),
	CONSTRAINT "friendships_status_check" CHECK ("friendships"."status" IN ('pending', 'accepted', 'blocked')),
	CONSTRAINT "friendships_not_self_check" CHECK ("friendships"."requester_id" <> "friendships"."addressee_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"username" text NOT NULL,
	"display_name" text,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "edition_contributors" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "edition_contributors_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"edition_id" bigint NOT NULL,
	"person_id" bigint NOT NULL,
	"role" text NOT NULL,
	"work_id" bigint
);
--> statement-breakpoint
CREATE TABLE "edition_identifiers" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "edition_identifiers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"edition_id" bigint NOT NULL,
	"type" text NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "edition_identifiers_edition_id_type_value_key" UNIQUE("edition_id","type","value")
);
--> statement-breakpoint
CREATE TABLE "edition_works" (
	"edition_id" bigint NOT NULL,
	"work_id" bigint NOT NULL,
	"position" smallint DEFAULT 1 NOT NULL,
	"title_in_edition" text,
	"part" text,
	"page_from" integer,
	CONSTRAINT "edition_works_edition_id_work_id_pk" PRIMARY KEY("edition_id","work_id")
);
--> statement-breakpoint
CREATE TABLE "editions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "editions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"title" text NOT NULL,
	"subtitle" text,
	"publisher_id" bigint,
	"published_year" smallint,
	"language" char(3),
	"format" text,
	"pages" integer,
	"print_run" integer,
	"series" text,
	"volume" text,
	"cover_path" text,
	"notes" text,
	"created_by" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dedupe_key" text GENERATED ALWAYS AS (lower(regexp_replace(title, '[^[:alnum:]]', '', 'g')) || '|' || coalesce(published_year::text, '')) STORED
);
--> statement-breakpoint
CREATE TABLE "identifier_types" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "persons" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "persons_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"full_name" text NOT NULL,
	"sort_name" text,
	"birth_year" smallint,
	"death_year" smallint,
	"notes" text,
	"created_by" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publishers" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "publishers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"city" text,
	"created_by" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_contributors" (
	"work_id" bigint NOT NULL,
	"person_id" bigint NOT NULL,
	"role" text DEFAULT 'author' NOT NULL,
	"position" smallint DEFAULT 1 NOT NULL,
	CONSTRAINT "work_contributors_work_id_person_id_role_pk" PRIMARY KEY("work_id","person_id","role")
);
--> statement-breakpoint
CREATE TABLE "works" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "works_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"title" text NOT NULL,
	"original_language" char(3),
	"first_published" smallint,
	"form" text,
	"notes" text,
	"created_by" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "collections_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"owner_id" bigint NOT NULL,
	"name" text NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collections_owner_id_name_key" UNIQUE("owner_id","name"),
	CONSTRAINT "collections_visibility_check" CHECK ("collections"."visibility" IN ('public', 'friends', 'private'))
);
--> statement-breakpoint
CREATE TABLE "copies" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "copies_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"edition_id" bigint NOT NULL,
	"collection_id" bigint NOT NULL,
	"location_id" bigint,
	"condition" text,
	"acquired_at" date,
	"acquired_from" text,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "copy_photos" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "copy_photos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"copy_id" bigint NOT NULL,
	"storage_key" text NOT NULL,
	"caption" text,
	"position" smallint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "locations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"collection_id" bigint NOT NULL,
	"name" text NOT NULL,
	"position" smallint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "locations_collection_id_name_key" UNIQUE("collection_id","name")
);
--> statement-breakpoint
CREATE TABLE "loans" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "loans_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"copy_id" bigint NOT NULL,
	"borrower_user_id" bigint,
	"borrower_contact_id" bigint,
	"lent_at" date DEFAULT current_date NOT NULL,
	"due_at" date,
	"returned_at" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loans_one_borrower_check" CHECK (num_nonnulls("loans"."borrower_user_id", "loans"."borrower_contact_id") = 1),
	CONSTRAINT "loans_returned_after_lent_check" CHECK ("loans"."returned_at" IS NULL OR "loans"."returned_at" >= "loans"."lent_at")
);
--> statement-breakpoint
CREATE TABLE "copy_user_tags" (
	"tag_id" bigint NOT NULL,
	"copy_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "copy_user_tags_tag_id_copy_id_pk" PRIMARY KEY("tag_id","copy_id")
);
--> statement-breakpoint
CREATE TABLE "user_tags" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_tags_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"owner_id" bigint NOT NULL,
	"name" text NOT NULL,
	"kind" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_tags_owner_id_name_key" UNIQUE("owner_id","name"),
	CONSTRAINT "user_tags_kind_check" CHECK ("user_tags"."kind" IN ('genre', 'custom'))
);
--> statement-breakpoint
CREATE TABLE "work_user_tags" (
	"tag_id" bigint NOT NULL,
	"work_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_user_tags_tag_id_work_id_pk" PRIMARY KEY("tag_id","work_id")
);
--> statement-breakpoint
CREATE TABLE "list_items" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "list_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"list_id" bigint NOT NULL,
	"work_id" bigint,
	"edition_id" bigint,
	"position" integer DEFAULT 1 NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "list_items_one_target_check" CHECK (num_nonnulls("list_items"."work_id", "list_items"."edition_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "lists" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lists_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"owner_id" bigint NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"slug" text,
	"visibility" text DEFAULT 'private' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lists_owner_id_name_key" UNIQUE("owner_id","name"),
	CONSTRAINT "lists_owner_id_slug_key" UNIQUE("owner_id","slug"),
	CONSTRAINT "lists_visibility_check" CHECK ("lists"."visibility" IN ('public', 'friends', 'private'))
);
--> statement-breakpoint
CREATE TABLE "book_marks" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "book_marks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"work_id" bigint NOT NULL,
	"edition_id" bigint,
	"status" text NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"started_at" date,
	"finished_at" date,
	"rating" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "book_marks_status_check" CHECK ("book_marks"."status" IN ('want_to_read', 'reading', 'read', 'abandoned')),
	CONSTRAINT "book_marks_visibility_check" CHECK ("book_marks"."visibility" IN ('public', 'friends', 'private')),
	CONSTRAINT "book_marks_rating_check" CHECK ("book_marks"."rating" BETWEEN 1 AND 10)
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reviews_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"work_id" bigint NOT NULL,
	"edition_id" bigint,
	"body" text NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_visibility_check" CHECK ("reviews"."visibility" IN ('public', 'friends', 'private'))
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_linked_user_id_users_id_fk" FOREIGN KEY ("linked_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_addressee_id_users_id_fk" FOREIGN KEY ("addressee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edition_contributors" ADD CONSTRAINT "edition_contributors_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edition_contributors" ADD CONSTRAINT "edition_contributors_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edition_contributors" ADD CONSTRAINT "edition_contributors_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edition_identifiers" ADD CONSTRAINT "edition_identifiers_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edition_identifiers" ADD CONSTRAINT "edition_identifiers_type_identifier_types_code_fk" FOREIGN KEY ("type") REFERENCES "public"."identifier_types"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edition_works" ADD CONSTRAINT "edition_works_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edition_works" ADD CONSTRAINT "edition_works_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editions" ADD CONSTRAINT "editions_publisher_id_publishers_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."publishers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editions" ADD CONSTRAINT "editions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persons" ADD CONSTRAINT "persons_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishers" ADD CONSTRAINT "publishers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_contributors" ADD CONSTRAINT "work_contributors_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_contributors" ADD CONSTRAINT "work_contributors_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "works" ADD CONSTRAINT "works_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copies" ADD CONSTRAINT "copies_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copies" ADD CONSTRAINT "copies_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copies" ADD CONSTRAINT "copies_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copy_photos" ADD CONSTRAINT "copy_photos_copy_id_copies_id_fk" FOREIGN KEY ("copy_id") REFERENCES "public"."copies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_copy_id_copies_id_fk" FOREIGN KEY ("copy_id") REFERENCES "public"."copies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_borrower_user_id_users_id_fk" FOREIGN KEY ("borrower_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_borrower_contact_id_contacts_id_fk" FOREIGN KEY ("borrower_contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copy_user_tags" ADD CONSTRAINT "copy_user_tags_tag_id_user_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."user_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copy_user_tags" ADD CONSTRAINT "copy_user_tags_copy_id_copies_id_fk" FOREIGN KEY ("copy_id") REFERENCES "public"."copies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tags" ADD CONSTRAINT "user_tags_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_user_tags" ADD CONSTRAINT "work_user_tags_tag_id_user_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."user_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_user_tags" ADD CONSTRAINT "work_user_tags_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lists" ADD CONSTRAINT "lists_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_marks" ADD CONSTRAINT "book_marks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_marks" ADD CONSTRAINT "book_marks_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_marks" ADD CONSTRAINT "book_marks_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "edition_contributors_edition_idx" ON "edition_contributors" USING btree ("edition_id");--> statement-breakpoint
CREATE INDEX "edition_identifiers_lookup_idx" ON "edition_identifiers" USING btree ("type","value");--> statement-breakpoint
CREATE INDEX "edition_works_work_idx" ON "edition_works" USING btree ("work_id");--> statement-breakpoint
CREATE INDEX "editions_dedupe_key_idx" ON "editions" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "persons_sort_name_idx" ON "persons" USING btree (lower("sort_name"));--> statement-breakpoint
CREATE INDEX "works_title_idx" ON "works" USING btree (lower("title"));--> statement-breakpoint
CREATE INDEX "copies_edition_idx" ON "copies" USING btree ("edition_id");--> statement-breakpoint
CREATE INDEX "copies_collection_idx" ON "copies" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "copy_photos_copy_idx" ON "copy_photos" USING btree ("copy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "loans_one_active_idx" ON "loans" USING btree ("copy_id") WHERE "loans"."returned_at" IS NULL;--> statement-breakpoint
CREATE INDEX "loans_copy_idx" ON "loans" USING btree ("copy_id");--> statement-breakpoint
CREATE INDEX "copy_user_tags_copy_idx" ON "copy_user_tags" USING btree ("copy_id");--> statement-breakpoint
CREATE INDEX "work_user_tags_work_idx" ON "work_user_tags" USING btree ("work_id");--> statement-breakpoint
CREATE UNIQUE INDEX "list_items_work_uniq_idx" ON "list_items" USING btree ("list_id","work_id") WHERE "list_items"."work_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "list_items_edition_uniq_idx" ON "list_items" USING btree ("list_id","edition_id") WHERE "list_items"."edition_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "book_marks_user_idx" ON "book_marks" USING btree ("user_id","work_id");--> statement-breakpoint
CREATE INDEX "book_marks_work_idx" ON "book_marks" USING btree ("work_id");--> statement-breakpoint
CREATE INDEX "reviews_work_idx" ON "reviews" USING btree ("work_id");--> statement-breakpoint
CREATE INDEX "reviews_user_idx" ON "reviews" USING btree ("user_id");