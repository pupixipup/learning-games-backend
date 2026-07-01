import { MigrationInterface, QueryRunner } from "typeorm";

export class AddGameTables1782824906349 implements MigrationInterface {
    name = 'AddGameTables1782824906349'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "games" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "template_id" text NOT NULL, "title" text NOT NULL, "config" jsonb NOT NULL DEFAULT '{}', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_c9b16b62917b5595af982d66337" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "game_templates" ("id" text NOT NULL, "config" jsonb, "path" text NOT NULL, CONSTRAINT "PK_82ddaa337d0011639ee19cfa8dc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "games" ADD CONSTRAINT "FK_4cd1b2a3016fba918f1b92faa4a" FOREIGN KEY ("template_id") REFERENCES "game_templates"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "games" DROP CONSTRAINT "FK_4cd1b2a3016fba918f1b92faa4a"`);
        await queryRunner.query(`DROP TABLE "game_templates"`);
        await queryRunner.query(`DROP TABLE "games"`);
    }

}
