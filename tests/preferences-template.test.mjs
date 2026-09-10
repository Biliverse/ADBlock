import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

test("settings integration installs versioned JSON and the common latest API", async () => {
	for (const name of await readdir(new URL("../template/", import.meta.url))) {
		if (!name.endsWith(".handlebars") || name.includes("rewrite")) continue;
		const template = await readFile(new URL(`../template/${name}`, import.meta.url), "utf8");
		assert.ok(template.includes("https://github.com/NSNanoCat/PreferencePanes/releases/latest/download/api.js"), name);
		assert.ok(template.includes("api\\/(?:get|set|delete)"), name);
		assert.ok(template.includes("settings\\/(?:[a-zA-Z0-9_-]+"), name);
		const line = template.split("\n").find(line => line.includes("configs") && line.includes("biliverse"));
		assert.ok(line, name);
		const pattern = line.startsWith("response if") ? line.match(/~= \/(.+)\/ then/)[1] : name.startsWith("shadowrocket") ? line.match(/pattern=([^,]+)/)[1] : name.startsWith("stash") ? line.trim().slice("- match: ".length) : line.split(" ")[0];
		const matcher = new RegExp(pattern);
		assert.ok(matcher.test("https://biliverse.github.io/configs/ADBlock"));
		assert.ok(matcher.test("https://app.bilibili.com/configs/ADBlock"));
		assert.equal(matcher.test("https://app.bilibili.com/x/v2/account/mine"), false);
		assert.ok(matcher.test("https://biliverse.github.io/configs/ADBlock?v=1"));
		for (const pathname of ["/api/ADBlock/", "/settings/", "/settings/ADBlock", "/configs/Unknown", "/settings/assets/ADBlock.boxjs.json", "/settings/assets/ADBlock.config.js"]) assert.equal(matcher.test(`https://biliverse.github.io${pathname}`), false, name);
		assert.doesNotMatch(template, /biliverse\.github\.io\/settings\/assets\//);
		const development = name.includes(".dev.");
		const source = development ? "https://gist.githubusercontent.com/VirgilClyne/0b0c5ac2b8977d5461d4b3276d120896/raw/" : "https://github.com/Biliverse/ADBlock/releases/download/v{{@package 'version'}}/";
		const file = /^(surge|loon)/.test(name) ? `BiliBili.ADBlock${development ? ".dev" : ""}.boxjs.json` : `config${development ? ".dev" : ""}.bundle.js`;
		assert.ok(template.includes(source + file), name);
	}
});
