# adityavofficial-hyperverge-hackathon-2025/sensai-ai/src/api/db/__init__.py

import os
from os.path import exists
from api.utils.db import get_new_db_connection, check_table_exists, set_db_defaults
from api.config import (
    sqlite_db_path,
    chat_history_table_name,
    tasks_table_name,
    questions_table_name,
    cohorts_table_name,
    user_cohorts_table_name,
    milestones_table_name,
    users_table_name,
    organizations_table_name,
    user_organizations_table_name,
    courses_table_name,
    course_cohorts_table_name,
    course_tasks_table_name,
    uncategorized_milestone_name,
    course_milestones_table_name,
    group_role_learner,
    group_role_mentor,
    uncategorized_milestone_color,
    task_completions_table_name,
    scorecards_table_name,
    question_scorecards_table_name,
    course_generation_jobs_table_name,
    task_generation_jobs_table_name,
    org_api_keys_table_name,
    code_drafts_table_name,
    # Reputation tables
    user_points_table_name,
    user_points_ledger_table_name,
    comment_investments_table_name,
)

# New table names for Learning Hub
hubs_table_name = "hubs"
posts_table_name = "posts"
post_votes_table_name = "post_votes"
post_links_table_name = "post_links"
poll_options_table_name = "poll_options"


async def create_hubs_table(cursor):
    """Creates the hubs table for storing learning hub topics."""
    await cursor.execute(
        f"""CREATE TABLE IF NOT EXISTS {hubs_table_name} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                org_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (org_id) REFERENCES {organizations_table_name}(id) ON DELETE CASCADE
            )"""
    )
    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_hubs_org_id ON {hubs_table_name} (org_id)"""
    )


async def create_posts_table(cursor):
    """Creates the posts table for storing user-generated content in hubs."""
    await cursor.execute(
        f"""CREATE TABLE IF NOT EXISTS {posts_table_name} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                hub_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                parent_id INTEGER,
                title TEXT,
                content TEXT NOT NULL,
                post_type TEXT NOT NULL,
                poll_options TEXT,
                moderation_status TEXT DEFAULT 'pending' CHECK(moderation_status IN ('pending', 'approved', 'flagged', 'removed')),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                views INTEGER DEFAULT 0,
                FOREIGN KEY (hub_id) REFERENCES {hubs_table_name}(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES {users_table_name}(id) ON DELETE CASCADE,
                FOREIGN KEY (parent_id) REFERENCES {posts_table_name}(id) ON DELETE CASCADE
            )"""
    )
    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_posts_hub_id ON {posts_table_name} (hub_id)"""
    )
    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_posts_user_id ON {posts_table_name} (user_id)"""
    )
    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_posts_parent_id ON {posts_table_name} (parent_id)"""
    )
    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_posts_moderation_status ON {posts_table_name} (moderation_status)"""
    )
    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_posts_parent_id_views ON {posts_table_name} (parent_id, views)"""
    )


async def create_post_votes_table(cursor):
    """Creates the post_votes table to manage the reputation system."""
    await cursor.execute(
        f"""CREATE TABLE IF NOT EXISTS {post_votes_table_name} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                vote_type TEXT NOT NULL CHECK(vote_type IN ('up', 'down')),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(post_id, user_id),
                FOREIGN KEY (post_id) REFERENCES {posts_table_name}(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES {users_table_name}(id) ON DELETE CASCADE
            )"""
    )


async def create_post_links_table(cursor):
    """Creates the post_links table to associate posts with learning artifacts."""
    await cursor.execute(
        f"""CREATE TABLE IF NOT EXISTS {post_links_table_name} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id INTEGER NOT NULL,
                item_type TEXT NOT NULL,
                item_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (post_id) REFERENCES {posts_table_name}(id) ON DELETE CASCADE
            )"""
    )


async def create_user_points_table(cursor):
    """Creates table to track current user point balances"""
    await cursor.execute(
        f"""CREATE TABLE IF NOT EXISTS {user_points_table_name} (
                user_id INTEGER PRIMARY KEY,
                balance INTEGER NOT NULL DEFAULT 0,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES {users_table_name}(id) ON DELETE CASCADE
            )"""
    )

    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_user_points_balance ON {user_points_table_name} (balance)"""
    )


async def create_user_points_ledger_table(cursor):
    """Creates ledger of all point transactions"""
    await cursor.execute(
        f"""CREATE TABLE IF NOT EXISTS {user_points_ledger_table_name} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                delta INTEGER NOT NULL,
                reason TEXT NOT NULL,
                ref_comment_id INTEGER,
                ref_post_id INTEGER,
                investment_id INTEGER,
                day_key TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES {users_table_name}(id) ON DELETE CASCADE,
                FOREIGN KEY (ref_comment_id) REFERENCES {posts_table_name}(id) ON DELETE SET NULL,
                FOREIGN KEY (ref_post_id) REFERENCES {posts_table_name}(id) ON DELETE SET NULL
            )"""
    )

    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_user_points_ledger_user ON {user_points_ledger_table_name} (user_id, created_at)"""
    )
    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_user_points_ledger_day ON {user_points_ledger_table_name} (user_id, day_key)"""
    )


async def create_comment_investments_table(cursor):
    """Creates investments table for comment ROI game"""
    await cursor.execute(
        f"""CREATE TABLE IF NOT EXISTS {comment_investments_table_name} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                investor_user_id INTEGER NOT NULL,
                comment_id INTEGER NOT NULL,
                post_id INTEGER NOT NULL,
                amount INTEGER NOT NULL,
                status TEXT NOT NULL CHECK(status IN ('pending','won','lost','cancelled')) DEFAULT 'pending',
                settle_at DATETIME NOT NULL,
                settled_at DATETIME,
                payout_amount INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (investor_user_id) REFERENCES {users_table_name}(id) ON DELETE CASCADE,
                FOREIGN KEY (comment_id) REFERENCES {posts_table_name}(id) ON DELETE CASCADE,
                FOREIGN KEY (post_id) REFERENCES {posts_table_name}(id) ON DELETE CASCADE
            )"""
    )

    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_comment_investments_investor ON {comment_investments_table_name} (investor_user_id)"""
    )
    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_comment_investments_settlement ON {comment_investments_table_name} (status, settle_at)"""
    )


async def create_organizations_table(cursor):
    await cursor.execute(
        f"""CREATE TABLE IF NOT EXISTS {organizations_table_name} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                slug TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                default_logo_color TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                openai_api_key TEXT,
                openai_free_trial BOOLEAN
            )"""
    )

    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_org_slug ON {organizations_table_name} (slug)"""
    )


async def create_org_api_keys_table(cursor):
    await cursor.execute(
        f"""CREATE TABLE IF NOT EXISTS {org_api_keys_table_name} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                org_id INTEGER NOT NULL,
                hashed_key TEXT NOT NULL UNIQUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (org_id) REFERENCES {organizations_table_name}(id) ON DELETE CASCADE
            )"""
    )

    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_org_api_key_org_id ON {org_api_keys_table_name} (org_id)"""
    )

    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_org_api_key_hashed_key ON {org_api_keys_table_name} (hashed_key)"""
    )


async def create_users_table(cursor):
    await cursor.execute(
        f"""CREATE TABLE IF NOT EXISTS {users_table_name} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                first_name TEXT,
                middle_name TEXT,
                last_name TEXT,
                default_dp_color TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )"""
    )


async def create_user_organizations_table(cursor):
    await cursor.execute(
        f"""CREATE TABLE IF NOT EXISTS {user_organizations_table_name} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                org_id INTEGER NOT NULL,
                role TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, org_id),
                FOREIGN KEY (user_id) REFERENCES {users_table_name}(id) ON DELETE CASCADE,
                FOREIGN KEY (org_id) REFERENCES {organizations_table_name}(id) ON DELETE CASCADE
            )"""
    )

    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_user_org_user_id ON {user_organizations_table_name} (user_id)"""
    )

    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_user_org_org_id ON {user_organizations_table_name} (org_id)"""
    )


async def create_cohort_tables(cursor):
    # Create a table to store cohorts
    await cursor.execute(
        f"""CREATE TABLE IF NOT EXISTS {cohorts_table_name} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                org_id INTEGER NOT NULL,
                FOREIGN KEY (org_id) REFERENCES {organizations_table_name}(id) ON DELETE CASCADE
            )"""
    )

    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_cohort_org_id ON {cohorts_table_name} (org_id)"""
    )

    # Create a table to store users in cohorts
    await cursor.execute(
        f"""CREATE TABLE IF NOT EXISTS {user_cohorts_table_name} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                cohort_id INTEGER NOT NULL,
                role TEXT NOT NULL,
                joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, cohort_id),
                FOREIGN KEY (user_id) REFERENCES {users_table_name}(id) ON DELETE CASCADE,
                FOREIGN KEY (cohort_id) REFERENCES {cohorts_table_name}(id) ON DELETE CASCADE
            )"""
    )

    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_user_cohort_user_id ON {user_cohorts_table_name} (user_id)"""
    )

    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_user_cohort_cohort_id ON {user_cohorts_table_name} (cohort_id)"""
    )


async def create_course_tasks_table(cursor):
    await cursor.execute(
        f"""CREATE TABLE IF NOT EXISTS {course_tasks_table_name} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id INTEGER NOT NULL,
                course_id INTEGER NOT NULL,
                ordering INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                milestone_id INTEGER,
                UNIQUE(task_id, course_id),
                FOREIGN KEY (task_id) REFERENCES {tasks_table_name}(id) ON DELETE CASCADE,
                FOREIGN KEY (course_id) REFERENCES {courses_table_name}(id) ON DELETE CASCADE,
                FOREIGN KEY (milestone_id) REFERENCES {milestones_table_name}(id) ON DELETE CASCADE
            )"""
    )

    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_course_task_task_id ON {course_tasks_table_name} (task_id)"""
    )

    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_course_task_course_id ON {course_tasks_table_name} (course_id)"""
    )

    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_course_task_milestone_id ON {course_tasks_table_name} (milestone_id)"""
    )


async def create_course_milestones_table(cursor):
    await cursor.execute(
        f"""CREATE TABLE IF NOT EXISTS {course_milestones_table_name} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                course_id INTEGER NOT NULL,
                milestone_id INTEGER,
                ordering INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(course_id, milestone_id),
                FOREIGN KEY (course_id) REFERENCES {courses_table_name}(id) ON DELETE CASCADE,
                FOREIGN KEY (milestone_id) REFERENCES {milestones_table_name}(id) ON DELETE CASCADE
            )"""
    )

    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_course_milestone_course_id ON {course_milestones_table_name} (course_id)"""
    )

    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_course_milestone_milestone_id ON {course_milestones_table_name} (milestone_id)"""
    )


async def create_milestones_table(cursor):
    await cursor.execute(
        f"""CREATE TABLE IF NOT EXISTS {milestones_table_name} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                org_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                color TEXT,
                FOREIGN KEY (org_id) REFERENCES {organizations_table_name}(id) ON DELETE CASCADE
            )"""
    )

    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_milestone_org_id ON {milestones_table_name} (org_id)"""
    )


async def create_courses_table(cursor):
    await cursor.execute(
        f"""CREATE TABLE IF NOT EXISTS {courses_table_name} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                org_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (org_id) REFERENCES {organizations_table_name}(id) ON DELETE CASCADE
            )"""
    )

    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_course_org_id ON {courses_table_name} (org_id)"""
    )


async def create_course_cohorts_table(cursor):
    await cursor.execute(
        f"""CREATE TABLE IF NOT EXISTS {course_cohorts_table_name} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                course_id INTEGER NOT NULL,
                cohort_id INTEGER NOT NULL,
                is_drip_enabled BOOLEAN DEFAULT FALSE,
                frequency_value INTEGER,
                frequency_unit TEXT,
                publish_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(course_id, cohort_id),
                FOREIGN KEY (course_id) REFERENCES {courses_table_name}(id) ON DELETE CASCADE,
                FOREIGN KEY (cohort_id) REFERENCES {cohorts_table_name}(id) ON DELETE CASCADE
            )"""
    )

    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_course_cohort_course_id ON {course_cohorts_table_name} (course_id)"""
    )

    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_course_cohort_cohort_id ON {course_cohorts_table_name} (cohort_id)"""
    )


async def create_tasks_table(cursor):
    await cursor.execute(
        f"""CREATE TABLE IF NOT EXISTS {tasks_table_name} (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    org_id INTEGER NOT NULL,
                    type TEXT NOT NULL,
                    blocks TEXT,
                    title TEXT NOT NULL,
                    status TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    deleted_at DATETIME,
                    scheduled_publish_at DATETIME,
                    FOREIGN KEY (org_id) REFERENCES {organizations_table_name}(id) ON DELETE CASCADE
                )"""
    )

    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_task_org_id ON {tasks_table_name} (org_id)"""
    )


async def create_questions_table(cursor):
    await cursor.execute(
        f"""CREATE TABLE IF NOT EXISTS {questions_table_name} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                blocks TEXT,
                answer TEXT,
                input_type TEXT NOT NULL,
                coding_language TEXT,
                generation_model TEXT,
                response_type TEXT NOT NULL,
                position INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                deleted_at DATETIME,
                max_attempts INTEGER,
                is_feedback_shown BOOLEAN NOT NULL,
                context TEXT,
                title TEXT NOT NULL,
                FOREIGN KEY (task_id) REFERENCES {tasks_table_name}(id) ON DELETE CASCADE
            )"""
    )

    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_question_task_id ON {questions_table_name} (task_id)"""
    )


async def create_scorecards_table(cursor):
    await cursor.execute(
        f"""CREATE TABLE IF NOT EXISTS {scorecards_table_name} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                org_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                criteria TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                status TEXT,
                FOREIGN KEY (org_id) REFERENCES {organizations_table_name}(id) ON DELETE CASCADE
            )"""
    )

    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_scorecard_org_id ON {scorecards_table_name} (org_id)"""
    )


async def create_question_scorecards_table(cursor):
    await cursor.execute(
        f"""CREATE TABLE IF NOT EXISTS {question_scorecards_table_name} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                question_id INTEGER NOT NULL,
                scorecard_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (question_id) REFERENCES {questions_table_name}(id) ON DELETE CASCADE,
                FOREIGN KEY (scorecard_id) REFERENCES {scorecards_table_name}(id) ON DELETE CASCADE,
                UNIQUE(question_id, scorecard_id)
            )"""
    )

    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_question_scorecard_question_id ON {question_scorecards_table_name} (question_id)"""
    )

    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_question_scorecard_scorecard_id ON {question_scorecards_table_name} (scorecard_id)"""
    )


async def create_chat_history_table(cursor):
    await cursor.execute(
        f"""
                CREATE TABLE IF NOT EXISTS {chat_history_table_name} (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    question_id INTEGER NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT,
                    response_type TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (question_id) REFERENCES {questions_table_name}(id),
                    FOREIGN KEY (user_id) REFERENCES {users_table_name}(id) ON DELETE CASCADE
                )"""
    )

    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON {chat_history_table_name} (user_id)"""
    )

    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_chat_history_question_id ON {chat_history_table_name} (question_id)"""
    )


async def create_task_completion_table(cursor):
    await cursor.execute(
        f"""CREATE TABLE IF NOT EXISTS {task_completions_table_name} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                task_id INTEGER,
                question_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES {users_table_name}(id) ON DELETE CASCADE,
                FOREIGN KEY (task_id) REFERENCES {tasks_table_name}(id) ON DELETE CASCADE,
                FOREIGN KEY (question_id) REFERENCES {questions_table_name}(id) ON DELETE CASCADE,
                UNIQUE(user_id, task_id),
                UNIQUE(user_id, question_id)
            )"""
    )

    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_task_completion_user_id ON {task_completions_table_name} (user_id)"""
    )

    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_task_completion_task_id ON {task_completions_table_name} (task_id)"""
    )

    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_task_completion_question_id ON {task_completions_table_name} (question_id)"""
    )


async def create_course_generation_jobs_table(cursor):
    await cursor.execute(
        f"""CREATE TABLE IF NOT EXISTS {course_generation_jobs_table_name} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                uuid TEXT NOT NULL,
                course_id INTEGER NOT NULL,
                status TEXT NOT NULL,
                job_details TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (course_id) REFERENCES {courses_table_name}(id) ON DELETE CASCADE
            )"""
    )

    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_course_generation_job_course_id ON {course_generation_jobs_table_name} (course_id)"""
    )


async def create_task_generation_jobs_table(cursor):
    await cursor.execute(
        f"""CREATE TABLE IF NOT EXISTS {task_generation_jobs_table_name} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                uuid TEXT NOT NULL,
                task_id INTEGER NOT NULL,
                course_id INTEGER NOT NULL,
                status TEXT NOT NULL,
                job_details TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (task_id) REFERENCES {tasks_table_name}(id) ON DELETE CASCADE,
                FOREIGN KEY (course_id) REFERENCES {courses_table_name}(id) ON DELETE CASCADE
            )"""
    )

    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_task_generation_job_task_id ON {task_generation_jobs_table_name} (task_id)"""
    )

    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_task_generation_job_course_id ON {task_generation_jobs_table_name} (course_id)"""
    )


async def create_code_drafts_table(cursor):
    await cursor.execute(
        f"""CREATE TABLE IF NOT EXISTS {code_drafts_table_name} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                question_id INTEGER NOT NULL,
                code TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, question_id),
                FOREIGN KEY (user_id) REFERENCES {users_table_name}(id) ON DELETE CASCADE,
                FOREIGN KEY (question_id) REFERENCES {questions_table_name}(id) ON DELETE CASCADE
            )"""
    )

    # Useful indexes for faster lookup
    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_code_drafts_user_id ON {code_drafts_table_name} (user_id)"""
    )

    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_code_drafts_question_id ON {code_drafts_table_name} (question_id)"""
    )


async def create_poll_options_table(cursor):
    """Creates the poll_options table to store individual poll options."""
    await cursor.execute(
        f"""CREATE TABLE IF NOT EXISTS {poll_options_table_name} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id INTEGER NOT NULL,
                option_text TEXT NOT NULL,
                votes INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (post_id) REFERENCES {posts_table_name}(id) ON DELETE CASCADE
            )"""
    )
    await cursor.execute(
        f"""CREATE INDEX IF NOT EXISTS idx_poll_options_post_id ON {poll_options_table_name} (post_id)"""
    )


async def migrate_posts_table_add_moderation_status(cursor):
    """Add moderation_status column to existing posts table if it doesn't exist."""
    try:
        # Check if column exists
        await cursor.execute(f"PRAGMA table_info({posts_table_name})")
        columns = await cursor.fetchall()
        column_names = [column[1] for column in columns]
        
        if 'moderation_status' not in column_names:
            # First, add the column without the CHECK constraint
            await cursor.execute(
                f"ALTER TABLE {posts_table_name} ADD COLUMN moderation_status TEXT DEFAULT 'approved'"
            )
            print(f"Added moderation_status column to {posts_table_name}")
            
            # Create index for the new column
            await cursor.execute(
                f"""CREATE INDEX IF NOT EXISTS idx_posts_moderation_status ON {posts_table_name} (moderation_status)"""
            )
            print(f"Created index for moderation_status column")
        else:
            print(f"moderation_status column already exists in {posts_table_name}")
    except Exception as e:
        print(f"Migration error: {e}")


async def migrate_posts_table_add_views(cursor):
    """Add views column to posts if it doesn't exist and supporting index"""
    try:
        await cursor.execute(f"PRAGMA table_info({posts_table_name})")
        columns = await cursor.fetchall()
        column_names = [column[1] for column in columns]
        if 'views' not in column_names:
            await cursor.execute(
                f"ALTER TABLE {posts_table_name} ADD COLUMN views INTEGER DEFAULT 0"
            )
            await cursor.execute(
                f"""CREATE INDEX IF NOT EXISTS idx_posts_parent_id_views ON {posts_table_name} (parent_id, views)"""
            )
    except Exception as e:
        print(f"Migration error (views): {e}")


async def init_db():
    db_just_created = not exists(sqlite_db_path)

    try:
        async with get_new_db_connection() as conn:
            cursor = await conn.cursor()

            # Set database defaults (this function creates its own connection)
            set_db_defaults()

            await create_organizations_table(cursor)
            await create_org_api_keys_table(cursor)
            await create_users_table(cursor)
            await create_user_organizations_table(cursor)
            await create_cohort_tables(cursor)
            await create_milestones_table(cursor)
            await create_courses_table(cursor)
            await create_course_cohorts_table(cursor)
            await create_tasks_table(cursor)
            await create_questions_table(cursor)
            await create_scorecards_table(cursor)
            await create_question_scorecards_table(cursor)
            await create_chat_history_table(cursor)
            await create_task_completion_table(cursor)
            await create_course_tasks_table(cursor)
            await create_course_milestones_table(cursor)
            await create_course_generation_jobs_table(cursor)
            await create_task_generation_jobs_table(cursor)
            await create_code_drafts_table(cursor)

            # Create new hub tables
            await create_hubs_table(cursor)
            await create_posts_table(cursor)
            await create_post_votes_table(cursor)
            await create_post_links_table(cursor)
            await create_poll_options_table(cursor)
            await create_moderation_logs_table(cursor)

            # Create reputation tables
            await create_user_points_table(cursor)
            await create_user_points_ledger_table(cursor)
            await create_comment_investments_table(cursor)

            # Run migration for existing posts table
            await migrate_posts_table_add_moderation_status(cursor)
            await migrate_posts_table_add_views(cursor)

            await conn.commit()

    except Exception as exception:
        # delete db if it was just created to avoid a partial state
        if db_just_created and exists(sqlite_db_path):
            os.remove(sqlite_db_path)
        raise exception


async def delete_useless_tables():
    from api.config import (
        tags_table_name,
        task_tags_table_name,
        groups_table_name,
        user_groups_table_name,
        badges_table_name,
        task_scoring_criteria_table_name,
        cv_review_usage_table_name,
        tests_table_name,
    )

    async with get_new_db_connection() as conn:
        cursor = await conn.cursor()

        await cursor.execute(f"DROP TABLE IF EXISTS {tags_table_name}")
        await cursor.execute(f"DROP TABLE IF EXISTS {task_tags_table_name}")
        await cursor.execute(f"DROP TABLE IF EXISTS {tests_table_name}")
        await cursor.execute(f"DROP TABLE IF EXISTS {groups_table_name}")
        await cursor.execute(f"DROP TABLE IF EXISTS {user_groups_table_name}")
        await cursor.execute(f"DROP TABLE IF EXISTS {badges_table_name}")
        await cursor.execute(f"DROP TABLE IF EXISTS {task_scoring_criteria_table_name}")
        await cursor.execute(f"DROP TABLE IF EXISTS {cv_review_usage_table_name}")

    async with get_new_db_connection() as conn:
        cursor = await conn.cursor()
        await cursor.execute(f"PRAGMA table_info({user_cohorts_table_name})")
        user_columns = [col[1] for col in await cursor.fetchall()]

        if "joined_at" not in user_columns:
            await cursor.execute(f"DROP TABLE IF EXISTS {user_cohorts_table_name}_temp")
            await cursor.execute(
                f"""
                CREATE TABLE {user_cohorts_table_name}_temp (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    cohort_id INTEGER NOT NULL,
                    role TEXT NOT NULL,
                    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, cohort_id),
                    FOREIGN KEY (user_id) REFERENCES {users_table_name}(id) ON DELETE CASCADE,
                    FOREIGN KEY (cohort_id) REFERENCES {cohorts_table_name}(id) ON DELETE CASCADE
                )
            """
            )
            await cursor.execute(
                f"INSERT INTO {user_cohorts_table_name}_temp (id, user_id, cohort_id, role) SELECT id, user_id, cohort_id, role FROM {user_cohorts_table_name}"
            )
            await cursor.execute(f"DROP TABLE {user_cohorts_table_name}")
            await cursor.execute(
                f"ALTER TABLE {user_cohorts_table_name}_temp RENAME TO {user_cohorts_table_name}"
            )

            # Recreate the indexes that were lost during table recreation
            await cursor.execute(
                f"CREATE INDEX idx_user_cohort_user_id ON {user_cohorts_table_name} (user_id)"
            )
            await cursor.execute(
                f"CREATE INDEX idx_user_cohort_cohort_id ON {user_cohorts_table_name} (cohort_id)"
            )

        await cursor.execute(f"PRAGMA table_info({course_cohorts_table_name})")
        course_columns = [col[1] for col in await cursor.fetchall()]

        for col, col_type, default in [
            ("is_drip_enabled", "BOOLEAN", "FALSE"),
            ("frequency_value", "INTEGER", None),
            ("frequency_unit", "TEXT", None),
            ("publish_at", "DATETIME", None),
        ]:
            if col not in course_columns:
                default_str = f" DEFAULT {default}" if default else ""
                await cursor.execute(
                    f"ALTER TABLE {course_cohorts_table_name} ADD COLUMN {col} {col_type}{default_str}"
                )

        await conn.commit()


async def create_moderation_logs_table(cursor):
    """Creates the moderation_logs table for storing moderation results."""
    await cursor.execute(
        """CREATE TABLE IF NOT EXISTS moderation_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content_type TEXT NOT NULL,
                content_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                is_flagged BOOLEAN NOT NULL,
                severity TEXT NOT NULL,
                reason TEXT NOT NULL,
                action TEXT NOT NULL,
                confidence REAL NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )"""
    )
    
    await cursor.execute(
        """CREATE INDEX IF NOT EXISTS idx_moderation_logs_content ON moderation_logs (content_type, content_id)"""
    )
    
    await cursor.execute(
        """CREATE INDEX IF NOT EXISTS idx_moderation_logs_user ON moderation_logs (user_id)"""
    )