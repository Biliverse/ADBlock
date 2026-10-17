import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

for (const platform of ["surge", "shadowrocket", "loon", "stash", "quantumultx"]) {
	test(`${platform} serves DefaultWords through a native empty gRPC mock`, async () => {
		for (const development of [false, true]) {
			const name = `${platform}${development ? ".dev" : ""}.handlebars`;
			const template = await readFile(new URL(`../template/${name}`, import.meta.url), "utf8");
			const lines = template.split("\n").filter(line => !line.trimStart().startsWith("#") && line.includes("DefaultWords"));
			assert.equal(lines.length, 1, name);
			const [line] = lines;
			assert.doesNotMatch(line, /script-request|type=http-request|script-path|request\.grpc/, name);
			let pattern;
			let body;
			switch (platform) {
				case "surge":
				case "shadowrocket": {
					const [, match, base64, status, header] = line.match(/^(.*?) data-type=base64 data="([^"]+)" status-code=(\d+) header="([^"]+)"$/);
					pattern = match;
					body = Buffer.from(base64, "base64");
					const headers = Object.fromEntries(header.split("|").map(field => field.split(":")));
					assert.equal(status, "200");
					assert.equal(headers["Content-Type"], "application/grpc");
					assert.equal(headers["grpc-status"], "0");
					assert.equal(Number(headers["Content-Length"]), body.byteLength);
					break;
				}
				case "loon": {
					const [, match, base64] = line.match(/^response if \$\{url\} ~= \/(.+)\/ then response\.body\.mock\("text", "([^"]+)", 200, true\)/);
					pattern = match;
					body = Buffer.from(base64, "base64");
					assert.ok(line.includes('response.header.set("Content-Type", "application/grpc")'));
					assert.ok(line.includes('response.header.set("grpc-status", "0")'));
					break;
				}
				case "stash": {
					const [, block] = template.match(/ {2}mock:\n([\s\S]*?)(?=\n {2}[a-z-]+:|\n\S|$)/);
					assert.ok(block.includes(line));
					pattern = line.trim().slice("- match: ".length);
					body = Buffer.from(block.match(/base64: "([^"]+)"/)[1], "base64");
					assert.match(block, /status-code: 200/);
					assert.match(block, /Content-Type: application\/grpc/);
					assert.match(block, /grpc-status: "0"/);
					assert.doesNotMatch(template, /ADBlock\.request\.grpc/);
					break;
				}
				case "quantumultx": {
					const [, match, resource] = line.match(/^(.*?) url echo-response application\/grpc\\r\\ngrpc-status: 0 echo-response (.+)$/);
					pattern = match;
					assert.equal(resource, `https://raw.githubusercontent.com/Biliverse/ADBlock/${development ? "dev" : "v{{@package 'version'}}"}/src/assets/empty.grpc`);
					body = await readFile(new URL("../src/assets/empty.grpc", import.meta.url));
					break;
				}
			}
			assert.deepEqual([...body], [0, 0, 0, 0, 0], name);
			const matcher = new RegExp(pattern);
			for (const hostname of ["grpc.biliapi.net", "app.biliapi.net", "app.bilibili.com", "app.biliapi.com"]) {
				for (const scheme of ["http", "https"]) assert.ok(matcher.test(`${scheme}://${hostname}/bilibili.app.interface.v1.Search/DefaultWords`), name);
			}
			for (const url of ["https://example.com/bilibili.app.interface.v1.Search/DefaultWords", "https://app.bilibili.com/bilibili.app.interface.v1.Search/DefaultWordsExtra", "https://app.bilibili.com/bilibili.app.viewunite.v1.View/AIRelateAsync"]) assert.equal(matcher.test(url), false, name);
		}
	});
}
