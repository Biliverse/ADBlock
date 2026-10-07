import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { ArgumentsBuilder } from "@iringo/arguments-builder";
import { loadConfigFile } from "@iringo/utils";
import { configAsset } from "../rollup.config.mjs";

test("both release channels compile configuration responses from their own JSON artifact", async () => {
	const root = await mkdtemp(path.join(tmpdir(), "adblock-artifacts-"));
	const original = process.cwd();
	const originalVersion = process.env.BUILD_VERSION;
	try {
		await mkdir(path.join(root, "dist"));
		process.chdir(root);
		for (const suffix of ["", ".dev"]) {
			const version = suffix ? "dev.candidate" : "0.7.3";
			process.env.BUILD_VERSION = version;
			const json = [{ id: "@Root.Module.Settings.flag", name: suffix || "release", type: "boolean", val: true }];
			await writeFile(`dist/BiliBili.ADBlock${suffix}.boxjs.json`, JSON.stringify(json));
			const files = new Map();
			await configAsset(suffix).generateBundle.call({ emitFile: ({ fileName, source }) => files.set(fileName, source) });
			assert.deepEqual([...files.keys()], [`config${suffix}.bundle.js`]);
			const response = await new Promise(resolve =>
				vm.runInNewContext(files.get(`config${suffix}.bundle.js`), {
					$environment: { "surge-version": "test" },
					$script: { startTime: Date.now() / 1000 },
					$request: { url: "https://biliverse.github.io/api/ADBlock", method: "GET" },
					$done: result => resolve(result.response),
					console: { log() {}, error() {} },
				}),
			);
			assert.equal(response.status, 200);
			assert.equal(response.headers["X-PreferencePanes-Version"], version);
			assert.deepEqual(JSON.parse(response.body), json);
			const head = await new Promise(resolve =>
				vm.runInNewContext(files.get(`config${suffix}.bundle.js`), {
					$environment: { "surge-version": "test" },
					$script: { startTime: Date.now() / 1000 },
					$request: { url: "https://biliverse.github.io/api/ADBlock", method: "HEAD" },
					$done: result => resolve(result.response),
					console: { log() {}, error() {} },
				}),
			);
			assert.equal(head.status, 200);
			assert.equal(head.body, "");
		}
	} finally {
		process.chdir(original);
		if (originalVersion === undefined) delete process.env.BUILD_VERSION;
		else process.env.BUILD_VERSION = originalVersion;
		await rm(root, { recursive: true, force: true });
	}
});

test("release and development builders expose Storage only through template arguments", async () => {
	for (const channel of ["release", "dev"]) {
		const { config } = await loadConfigFile({ configPath: path.resolve(`arguments-builder.${channel}.config.ts`) });
		const builder = new ArgumentsBuilder(config);
		assert.match(builder.buildSurgeArguments().scriptParams, /Storage="\{\{\{Storage\}\}\}"/);
		assert.match(builder.buildLoonArguments().scriptParams, /\{Storage\}/);
		assert.equal(
			builder.buildBoxJsSettings("@Biliverse.ADBlock.Settings").some(({ id }) => id.endsWith(".Storage")),
			false,
		);
		assert.doesNotMatch(builder.buildDtsArguments(), /Storage\??:/);
	}
});
