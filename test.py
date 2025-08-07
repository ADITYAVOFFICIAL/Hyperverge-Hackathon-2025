# ----------------------------------------------------------------------------
# Enhanced Database Schema Visualization using Matplotlib
#
# To run this script, you need to install matplotlib:
# pip install matplotlib
# ----------------------------------------------------------------------------

import matplotlib.pyplot as plt
import matplotlib.patches as patches
import math

class Config:
    """Holds all styling and layout configuration for the schema diagram."""
    # --- Dimensions ---
    TABLE_WIDTH = 4.5
    HEADER_HEIGHT = 0.5
    COLUMN_HEIGHT = 0.35
    H_SPACING = 3.5  # Horizontal space between tables
    V_SPACING = 1.5  # Vertical space between tables
    GROUP_V_SPACING = 2.5 # Vertical space between group title and first table

    # --- Colors ---
    HEADER_COLOR = '#3a86ff'
    TABLE_BG_COLOR = '#edf6ff'
    SHADOW_COLOR = '#c0c0c0'
    TEXT_COLOR = '#1d3557'
    PK_COLOR = '#e63946'
    FK_COLOR = '#2a9d8f'
    RELATION_COLOR = '#6c757d'
    BACKGROUND_COLOR = '#f8f9fa'
    
    # --- Fonts ---
    FONT_FAMILY = 'sans-serif'
    TITLE_FONT_SIZE = 24
    GROUP_FONT_SIZE = 18
    TABLE_FONT_SIZE = 14
    COLUMN_FONT_SIZE = 10
    
    # --- Other Styles ---
    ARROW_STYLE = '-|>'
    ARROW_MUTATION_SCALE = 20
    ARROW_LINEWIDTH = 1.5
    RELATION_ARC_RADIUS = 0.3 # Controls the curve of relationship lines
    SELF_REF_LOOP_SIZE = 1.0 # Controls the size of the self-reference loop


class SchemaVisualizer:
    """
    A class to generate a database schema diagram from a dictionary definition.
    """
    def __init__(self, schema_definition, layout_groups, config):
        self.schema = schema_definition
        self.layout = layout_groups
        self.config = config
        self.positions = {} # To store calculated (x, y, width, height) for each table
        self.fig, self.ax = None, None

    def _calculate_layout(self):
        """Calculates the x, y coordinates for each table based on layout groups."""
        max_y = 0
        current_x = 0
        
        for group_name, table_list in self.layout.items():
            current_y = -self.config.GROUP_V_SPACING
            
            # Place group title
            self.ax.text(
                current_x + self.config.TABLE_WIDTH / 2, 0, group_name,
                ha='center', va='bottom', fontsize=self.config.GROUP_FONT_SIZE,
                fontweight='bold', color=self.config.TEXT_COLOR,
                fontfamily=self.config.FONT_FAMILY
            )

            # Place tables in the group
            for table_name in table_list:
                if table_name in self.schema:
                    details = self.schema[table_name]
                    num_columns = len(details['columns'])
                    table_height = self.config.HEADER_HEIGHT + (num_columns * self.config.COLUMN_HEIGHT)
                    
                    self.positions[table_name] = {
                        'x': current_x, 'y': current_y - table_height,
                        'w': self.config.TABLE_WIDTH, 'h': table_height
                    }
                    
                    current_y -= (table_height + self.config.V_SPACING)
            
            if abs(current_y) > max_y:
                max_y = abs(current_y)
                
            current_x += (self.config.TABLE_WIDTH + self.config.H_SPACING)
            
        return current_x, max_y

    def _draw_table(self, table_name):
        """Draws a single database table on the axes."""
        if table_name not in self.positions:
            return
            
        pos = self.positions[table_name]
        x, y, w, h = pos['x'], pos['y'], pos['w'], pos['h']
        details = self.schema[table_name]

        # Draw shadow for depth
        shadow = patches.Rectangle(
            (x + 0.15, y - 0.15), w, h,
            facecolor=self.config.SHADOW_COLOR, alpha=0.6, zorder=1
        )
        self.ax.add_patch(shadow)
        
        # Draw main table rectangle
        table_rect = patches.Rectangle(
            (x, y), w, h, facecolor=self.config.TABLE_BG_COLOR,
            edgecolor=self.config.TEXT_COLOR, linewidth=1.0, zorder=2
        )
        self.ax.add_patch(table_rect)

        # Draw colored header
        header_rect = patches.Rectangle(
            (x, y + h - self.config.HEADER_HEIGHT), w, self.config.HEADER_HEIGHT,
            facecolor=self.config.HEADER_COLOR, edgecolor=self.config.TEXT_COLOR,
            linewidth=1.0, zorder=3
        )
        self.ax.add_patch(header_rect)
        self.ax.text(
            x + w / 2, y + h - self.config.HEADER_HEIGHT / 2, table_name,
            ha='center', va='center', color='white', fontweight='bold',
            fontsize=self.config.TABLE_FONT_SIZE, zorder=4, fontfamily=self.config.FONT_FAMILY
        )

        # Draw columns
        for i, col in enumerate(details['columns']):
            col_y = y + h - self.config.HEADER_HEIGHT - (i + 0.5) * self.config.COLUMN_HEIGHT
            
            prefix = ""
            color = self.config.TEXT_COLOR
            fontweight = 'normal'
            
            if col == details.get('pk'):
                prefix = "PK"
                color = self.config.PK_COLOR
                fontweight = 'bold'
            elif col in details.get('fk', {}):
                prefix = "FK"
                color = self.config.FK_COLOR
                fontweight = 'bold'

            # Add PK/FK prefix
            self.ax.text(
                x + 0.2, col_y, prefix, ha='left', va='center', color=color,
                fontweight=fontweight, fontsize=self.config.COLUMN_FONT_SIZE - 1, zorder=4,
                fontfamily=self.config.FONT_FAMILY
            )
            # Add column name
            self.ax.text(
                x + 0.8, col_y, col, ha='left', va='center', color=self.config.TEXT_COLOR,
                fontsize=self.config.COLUMN_FONT_SIZE, zorder=4, fontfamily=self.config.FONT_FAMILY
            )

    def _draw_self_referencing_relationship(self, table_name):
        """Draws a loop for a self-referencing foreign key."""
        pos = self.positions[table_name]
        x, y, w, h = pos['x'], pos['y'], pos['w'], pos['h']
        
        # Define the loop points on the right side of the table
        start_point = (x + w, y + h * 0.6)
        end_point = (x + w, y + h * 0.4)

        # Use FancyArrowPatch with a curved connection style
        arrow = patches.FancyArrowPatch(
            start_point, end_point,
            connectionstyle=f"arc3,rad={self.config.SELF_REF_LOOP_SIZE}",
            color=self.config.RELATION_COLOR,
            arrowstyle=self.config.ARROW_STYLE,
            mutation_scale=self.config.ARROW_MUTATION_SCALE,
            linewidth=self.config.ARROW_LINEWIDTH,
            zorder=0
        )
        self.ax.add_patch(arrow)


    def _draw_relationship(self, from_table_name, to_table_name):
        """Draws a curved arrow between two tables."""
        from_pos = self.positions[from_table_name]
        to_pos = self.positions[to_table_name]

        # Center points of the tables
        from_cx, from_cy = from_pos['x'] + from_pos['w'] / 2, from_pos['y'] + from_pos['h'] / 2
        to_cx, to_cy = to_pos['x'] + to_pos['w'] / 2, to_pos['y'] + to_pos['h'] / 2

        # Determine best anchor points (left, right, top, bottom)
        if abs(from_cx - to_cx) > abs(from_cy - to_cy): # More horizontal than vertical
            if from_cx < to_cx: # from_table is to the left of to_table
                start_point = (from_pos['x'] + from_pos['w'], from_cy)
                end_point = (to_pos['x'], to_cy)
                rad = self.config.RELATION_ARC_RADIUS
            else: # from_table is to the right
                start_point = (from_pos['x'], from_cy)
                end_point = (to_pos['x'] + to_pos['w'], to_cy)
                rad = -self.config.RELATION_ARC_RADIUS
        else: # More vertical than horizontal
            if from_cy < to_cy: # from_table is below to_table
                start_point = (from_cx, from_pos['y'] + from_pos['h'])
                end_point = (to_cx, to_pos['y'])
                rad = self.config.RELATION_ARC_RADIUS
            else: # from_table is above
                start_point = (from_cx, from_pos['y'])
                end_point = (to_cx, to_pos['y'] + to_pos['h'])
                rad = -self.config.RELATION_ARC_RADIUS

        arrow = patches.FancyArrowPatch(
            start_point, end_point,
            connectionstyle=f"arc3,rad={rad}",
            color=self.config.RELATION_COLOR,
            arrowstyle=self.config.ARROW_STYLE,
            mutation_scale=self.config.ARROW_MUTATION_SCALE,
            linewidth=self.config.ARROW_LINEWIDTH,
            alpha=0.9, zorder=0
        )
        self.ax.add_patch(arrow)

    def generate(self, filename="database_schema_improved.png"):
        """Generates and saves the complete schema diagram."""
        # Estimate required figure size
        num_groups = len(self.layout)
        est_width = num_groups * (self.config.TABLE_WIDTH + self.config.H_SPACING)
        # A rough estimation for height, can be tuned
        est_height = max(len(v) for v in self.layout.values()) * (self.config.COLUMN_HEIGHT * 15 + self.config.V_SPACING)

        self.fig, self.ax = plt.subplots(figsize=(est_width / 2, est_height / 2))
        self.fig.patch.set_facecolor(self.config.BACKGROUND_COLOR)
        
        # Calculate positions and get final canvas dimensions
        total_width, total_height = self._calculate_layout()
        
        # Draw all tables
        for table_name in self.schema.keys():
            self._draw_table(table_name)
        
        # Draw all relationships
        for from_table, details in self.schema.items():
            for _, to_ref in details.get('fk', {}).items():
                to_table, _ = to_ref.split('.')
                if from_table == to_table:
                    self._draw_self_referencing_relationship(from_table)
                elif to_table in self.schema:
                    self._draw_relationship(from_table, to_table)

        # Final plot adjustments
        self.ax.set_xlim(-self.config.H_SPACING/2, total_width - self.config.H_SPACING/2)
        self.ax.set_ylim(-total_height - self.config.V_SPACING, self.config.V_SPACING * 2)
        self.ax.axis('off')
        
        self.fig.suptitle(
            'Database Schema Diagram', fontsize=self.config.TITLE_FONT_SIZE,
            fontweight='bold', color=self.config.TEXT_COLOR, fontfamily=self.config.FONT_FAMILY
        )
        plt.tight_layout(rect=[0, 0, 1, 0.96])
        
        # Save and show the plot
        plt.savefig(filename, dpi=150, bbox_inches='tight', facecolor=self.fig.get_facecolor())
        print(f"Schema diagram saved to {filename}")
        plt.show()


# ----------------------------------------------------------------------------
# 1. SCHEMA AND LAYOUT DEFINITION
# ----------------------------------------------------------------------------
schema_definition = {
    # Core Organization and User Tables
    "organizations": {"columns": ["id", "slug", "name", "default_logo_color", "created_at", "openai_api_key", "openai_free_trial"], "pk": "id", "fk": {}},
    "users": {"columns": ["id", "email", "first_name", "middle_name", "last_name", "default_dp_color", "created_at"], "pk": "id", "fk": {}},
    "user_organizations": {"columns": ["id", "user_id", "org_id", "role", "created_at"], "pk": "id", "fk": {"user_id": "users.id", "org_id": "organizations.id"}},
    "org_api_keys": {"columns": ["id", "org_id", "hashed_key", "created_at"], "pk": "id", "fk": {"org_id": "organizations.id"}},
    # Learning Hub Tables
    "hubs": {"columns": ["id", "org_id", "name", "description", "created_at"], "pk": "id", "fk": {"org_id": "organizations.id"}},
    "posts": {"columns": ["id", "hub_id", "user_id", "parent_id", "title", "content", "post_type", "created_at"], "pk": "id", "fk": {"hub_id": "hubs.id", "user_id": "users.id", "parent_id": "posts.id"}},
    "post_votes": {"columns": ["id", "post_id", "user_id", "vote_type", "created_at"], "pk": "id", "fk": {"post_id": "posts.id", "user_id": "users.id"}},
    "post_links": {"columns": ["id", "post_id", "item_type", "item_id", "created_at"], "pk": "id", "fk": {"post_id": "posts.id"}},
    # Course Structure Tables
    "courses": {"columns": ["id", "org_id", "name", "created_at"], "pk": "id", "fk": {"org_id": "organizations.id"}},
    "cohorts": {"columns": ["id", "name", "org_id"], "pk": "id", "fk": {"org_id": "organizations.id"}},
    "user_cohorts": {"columns": ["id", "user_id", "cohort_id", "role", "joined_at"], "pk": "id", "fk": {"user_id": "users.id", "cohort_id": "cohorts.id"}},
    "course_cohorts": {"columns": ["id", "course_id", "cohort_id", "is_drip_enabled", "frequency_value", "frequency_unit", "publish_at", "created_at"], "pk": "id", "fk": {"course_id": "courses.id", "cohort_id": "cohorts.id"}},
    "milestones": {"columns": ["id", "org_id", "name", "color"], "pk": "id", "fk": {"org_id": "organizations.id"}},
    "course_milestones": {"columns": ["id", "course_id", "milestone_id", "ordering", "created_at"], "pk": "id", "fk": {"course_id": "courses.id", "milestone_id": "milestones.id"}},
    # Task and Question Tables
    "tasks": {"columns": ["id", "org_id", "type", "blocks", "title", "status", "created_at", "deleted_at", "scheduled_publish_at"], "pk": "id", "fk": {"org_id": "organizations.id"}},
    "course_tasks": {"columns": ["id", "task_id", "course_id", "ordering", "created_at", "milestone_id"], "pk": "id", "fk": {"task_id": "tasks.id", "course_id": "courses.id", "milestone_id": "milestones.id"}},
    "questions": {"columns": ["id", "task_id", "type", "blocks", "answer", "input_type", "coding_language", "generation_model", "response_type", "position", "created_at", "deleted_at", "max_attempts", "is_feedback_shown", "context", "title"], "pk": "id", "fk": {"task_id": "tasks.id"}},
    # User Progress and Interaction Tables
    "task_completions": {"columns": ["id", "user_id", "task_id", "question_id", "created_at"], "pk": "id", "fk": {"user_id": "users.id", "task_id": "tasks.id", "question_id": "questions.id"}},
    "chat_history": {"columns": ["id", "user_id", "question_id", "role", "content", "response_type", "created_at"], "pk": "id", "fk": {"user_id": "users.id", "question_id": "questions.id"}},
    "code_drafts": {"columns": ["id", "user_id", "question_id", "code", "updated_at"], "pk": "id", "fk": {"user_id": "users.id", "question_id": "questions.id"}},
    # Assessment and Job Tables
    "scorecards": {"columns": ["id", "org_id", "title", "criteria", "created_at", "status"], "pk": "id", "fk": {"org_id": "organizations.id"}},
    "question_scorecards": {"columns": ["id", "question_id", "scorecard_id", "created_at"], "pk": "id", "fk": {"question_id": "questions.id", "scorecard_id": "scorecards.id"}},
    "course_generation_jobs": {"columns": ["id", "uuid", "course_id", "status", "job_details", "created_at"], "pk": "id", "fk": {"course_id": "courses.id"}},
    "task_generation_jobs": {"columns": ["id", "uuid", "task_id", "course_id", "status", "job_details", "created_at"], "pk": "id", "fk": {"task_id": "tasks.id", "course_id": "courses.id"}},
}

# Group tables logically for better visualization
layout_groups = {
    "Core": ["organizations", "users", "user_organizations", "org_api_keys"],
    "Course Structure": ["courses", "cohorts", "user_cohorts", "course_cohorts", "milestones", "course_milestones"],
    "Content & Tasks": ["tasks", "questions", "course_tasks"],
    "User Progress": ["task_completions", "chat_history", "code_drafts"],
    "Learning Hub": ["hubs", "posts", "post_votes", "post_links"],
    "Assessment & Jobs": ["scorecards", "question_scorecards", "course_generation_jobs", "task_generation_jobs"],
}

# ----------------------------------------------------------------------------
# 2. SCRIPT EXECUTION
# ----------------------------------------------------------------------------
if __name__ == '__main__':
    # Create an instance of the configuration
    config = Config()
    
    # Create the visualizer and generate the diagram
    visualizer = SchemaVisualizer(schema_definition, layout_groups, config)
    visualizer.generate()