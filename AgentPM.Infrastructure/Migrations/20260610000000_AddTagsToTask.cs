using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AgentPM.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTagsToTask : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS \"Tags\" jsonb NOT NULL DEFAULT '[]'::jsonb;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "ALTER TABLE tasks DROP COLUMN IF EXISTS \"Tags\";");
        }
    }
}
