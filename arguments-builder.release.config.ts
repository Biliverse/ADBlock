import { defineConfig } from "@iringo/arguments-builder";
import { dm, dynamic, feed, logLevel, output, pgc, privacy, reply, search, splash, storage, view, xlive } from "./arguments-builder.full.config";

export default defineConfig({
	output: { ...output, boxjsSettings: { ...output.boxjsSettings, path: "./dist/BiliBili.ADBlock.boxjs.json" } },
	args: [...splash, ...feed, ...search, ...pgc, ...xlive, ...dynamic, ...view, ...dm, ...reply, ...privacy, ...storage, ...logLevel],
});
