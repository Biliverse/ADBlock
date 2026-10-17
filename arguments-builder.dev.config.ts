import { defineConfig } from "@iringo/arguments-builder";
import { dm, dynamic, feed, logLevel, pgc, privacy, reply, search, splash, storage, view, xlive } from "./arguments-builder.full.config";

export default defineConfig({
	args: [...splash, ...feed, ...search, ...pgc, ...xlive, ...dynamic, ...view, ...dm, ...reply, ...privacy, ...storage, ...logLevel],
	output: {
		surge: {
			path: "./dist/BiliBili.ADBlock.dev.sgmodule",
			template: "./template/surge.dev.handlebars",
			transformEgern: { enable: true, path: "./dist/BiliBili.ADBlock.dev.yaml" },
		},
		loon: { path: "./dist/BiliBili.ADBlock.dev.plugin", template: "./template/loon.dev.handlebars" },
		customItems: [
			{ path: "./dist/BiliBili.ADBlock.dev.srmodule", template: "./template/shadowrocket.dev.handlebars" },
			{ path: "./dist/BiliBili.ADBlock.dev.snippet", template: "./template/quantumultx.dev.handlebars" },
			{ path: "./dist/BiliBili.ADBlock.dev.stoverride", template: "./template/stash.dev.handlebars" },
		],
		boxjsSettings: { path: "./dist/BiliBili.ADBlock.dev.boxjs.json", scope: "@Biliverse.ADBlock.Settings" },
	},
});
