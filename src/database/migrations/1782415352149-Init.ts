import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1782415352149 implements MigrationInterface {
    name = 'Init1782415352149'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "examples" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ea56499b0a3a29593d3405080e8" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "examples"`);
    }

}
