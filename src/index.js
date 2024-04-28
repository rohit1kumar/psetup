import path from "path";
import { promisify } from "util";
import { exec as execCallback } from "child_process";

import fs from "fs-extra";

import {
    eslintContent,
    getPackageJsonContent,
    getProjectDetails,
    gitignoreContent,
    indexFileContent,
    log,
    prettierContent,
} from "./utils.js";

const exec = promisify(execCallback);
export default async function createProject() {
    let rootDir;
    try {
        const { projectName, description, gitRepo, author } =
            await getProjectDetails();

        rootDir = path.join(process.cwd(), projectName);

        const srcDir = path.join(rootDir, "src");

        await fs.ensureDir(srcDir);

        const packageJson = getPackageJsonContent({
            projectName,
            description,
            author,
            gitRepo,
        });

        log.info(`- creating directories & files for ${projectName}`);

        await fs.writeFile(
            path.join(rootDir, "package.json"),
            JSON.stringify(packageJson, null, 2),
        );

        await fs.writeFile(
            path.join(rootDir, ".prettierrc.json"),
            JSON.stringify(prettierContent, null, 2),
        );

        await fs.writeFile(
            path.join(rootDir, ".eslintrc.json"),
            JSON.stringify(eslintContent, null, 2),
        );

        await fs.writeFile(path.join(rootDir, ".gitignore"), gitignoreContent);

        await fs.writeFile(path.join(rootDir, "README.md"), `# ${projectName}`);

        await fs.writeFile(path.join(srcDir, "index.js"), indexFileContent);

        const { stderr: changeDirError } = await exec(`cd ${rootDir}`);
        if (changeDirError) throw new Error(changeDirError);

        log.info("- installing dependencies");

        const { stderr: npmInstallError } = await exec("npm install", {
            cwd: rootDir,
        });

        if (npmInstallError) throw new Error(npmInstallError);

        const { stdout: gitVersion } = await exec("git --version", {
            cwd: rootDir,
        }).catch(() => {
            log.warn("- git not found. Skipping initialization.");
            return { stdout: null };
        });

        if (gitVersion) {
            await exec("git init", { cwd: rootDir });

            if (gitRepo) {
                await exec(`git remote add origin ${gitRepo}`, {
                    cwd: rootDir,
                });
            }

            const { stderr: huskyInitError } = await exec("npx husky init", {
                cwd: rootDir,
            });
            if (huskyInitError) throw new Error(huskyInitError);

            await fs.writeFile(
                path.join(rootDir, ".husky", "pre-commit"),
                "npx lint-staged\n",
            );

            const { stderr: huskyInstallError } = await exec(
                'npm pkg set scripts.prepare="husky || true"',
                { cwd: rootDir },
            );
            if (huskyInstallError) throw new Error(huskyInstallError);

            await exec("git add .", { cwd: rootDir });
            await exec(`git commit -m "setup: initial commit"`, {
                cwd: rootDir,
            });
            log.info("- git repository initialized and initial commit made.");
        }

        log.success(`- ${projectName} is ready!`);
    } catch (err) {
        if (rootDir) await fs.remove(rootDir);
        log.error(`psetup failed: ${err}`);
    }
}
