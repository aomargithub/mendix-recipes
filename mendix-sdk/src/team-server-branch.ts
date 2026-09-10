/**
 * Creates a Team Server branch.
 *
 * Neither the Platform SDK nor the App Repository API can create one: they only read branches and
 * commit working copies into branches that already exist. So the branch is made the way any other
 * Git client would make it, by pushing the base branch's head to a new ref. The working copy
 * commit that follows carries the Mendix metadata, so the branch ends up indistinguishable from
 * one created in Studio Pro.
 */
import { execFileSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const TEAM_SERVER = "https://git.api.mendix.com";

/**
 * Git reads the token through an askpass helper rather than from the URL, so it never appears in
 * a command line, in `ps` output or in a remote configured on disk.
 */
function withAskpass<T>(action: (env: NodeJS.ProcessEnv) => T): T {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "mx-askpass-"));
    const script = path.join(directory, "askpass.sh");
    fs.writeFileSync(script, '#!/bin/sh\nexec printf "%s" "$MENDIX_TOKEN"\n', { mode: 0o700 });
    try {
        return action({ ...process.env, GIT_ASKPASS: script, GIT_TERMINAL_PROMPT: "0" });
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
}

function git(args: string[], options: { cwd?: string; env: NodeJS.ProcessEnv }): string {
    return execFileSync("git", args, { cwd: options.cwd, env: options.env, encoding: "utf8" });
}

export function ensureBranch(appId: string, branch: string, baseBranch: string): "existed" | "created" {
    if (!process.env.MENDIX_TOKEN) throw new Error("MENDIX_TOKEN is not set in the environment.");
    const url = `${TEAM_SERVER.replace("https://", "https://pat@")}/${appId}.git`;

    return withAskpass(env => {
        if (git(["ls-remote", "--heads", url, branch], { env }).trim() !== "") return "existed";

        const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "mx-branch-"));
        try {
            git(["init", "--quiet"], { cwd: workspace, env });
            git(["remote", "add", "origin", url], { cwd: workspace, env });
            git(["fetch", "--quiet", "--depth", "1", "origin", baseBranch], { cwd: workspace, env });
            git(["push", "--quiet", "origin", `FETCH_HEAD:refs/heads/${branch}`], { cwd: workspace, env });
            return "created";
        } finally {
            fs.rmSync(workspace, { recursive: true, force: true });
        }
    });
}
