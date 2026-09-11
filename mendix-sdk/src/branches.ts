import { MendixPlatformClient } from "mendixplatformsdk";
import { APP_ID } from "./common";

async function main() {
    const client = new MendixPlatformClient();
    const app = client.getApp(APP_ID);
    const repository = app.getRepository();
    console.log("Repository info:", JSON.stringify(await repository.getInfo(), null, 2));
    const branches = await repository.getBranches();
    console.log("Branches:", JSON.stringify(branches, null, 2));
    for (const branch of branches.items ?? []) {
        const commits = await repository.getBranchCommits(branch.name, { limit: 10 } as any);
        console.log(`\nCommits on ${branch.name}:`);
        for (const commit of commits.items ?? []) {
            console.log(`  ${commit.id?.slice(0, 10)}  ${commit.date}  ${JSON.stringify(commit.message)}`);
        }
    }
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
