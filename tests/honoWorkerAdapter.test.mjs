import assert from "node:assert/strict";
import test from "node:test";
import { DmSegMobileReply, DmSegMobileReq } from "@biliverse/protobuf/bilibili/community/service/dm/v1/dm.js";
import gRPC from "@nsnanocat/grpc";
import { Console, Storage } from "@nsnanocat/util";
import HonoWorkerAdapter from "../src/class/HonoWorkerAdapter.mjs";
import database from "../src/function/database.mjs";
import setENV from "../src/function/setENV.mjs";
import { Request } from "../src/process/Request.mjs";
import { Response as DevResponse } from "../src/process/Response.dev.mjs";

test("rewrites Pages and Workers paths to the original upstream host", () => {
	const pages = HonoWorkerAdapter.routeRewrite(new URL("https://adblock-dux.pages.dev/api.bilibili.com/x/v2/feed/index?foo=bar"), "api.bilibili.com/x/v2/feed/index");
	assert.equal(pages.toString(), "https://api.bilibili.com/x/v2/feed/index?foo=bar");

	const workers = HonoWorkerAdapter.routeRewrite(new URL("https://adblock.nanocat.workers.dev/grpc.biliapi.net/bilibili.app.view.v1.View/View"), "grpc.biliapi.net/bilibili.app.view.v1.View/View");
	assert.equal(workers.toString(), "https://grpc.biliapi.net/bilibili.app.view.v1.View/View");
});

test("extracts module arguments from the header and removes the transport header", () => {
	const request = {
		url: "https://api.bilibili.com/x/v2/feed/index",
		headers: { "biliverse-args": "Settings.Switch=false&Settings.Types=AD" },
	};
	HonoWorkerAdapter.buildArgument(request);
	assert.deepEqual(globalThis.$argument, { Settings: { Switch: "false", Types: "AD" } });
	assert.deepEqual(request.headers, {});
});

test("extracts query arguments and removes module settings from the upstream URL", () => {
	const request = {
		url: "https://api.bilibili.com/x/v2/feed/index?Settings.Switch=false&Settings.Types=AD&foo=bar",
		headers: {},
	};
	HonoWorkerAdapter.buildArgument(request);
	assert.deepEqual(globalThis.$argument, { Settings: { Switch: "false", Types: "AD" }, foo: "bar" });
	assert.equal(request.url, "https://api.bilibili.com/x/v2/feed/index?foo=bar");
});

test("loads ADBlock caches from the request-scoped Worker KV adapter", async () => {
	const requestedKeys = [];
	const KV = {
		async getItem(key) {
			requestedKeys.push(key);
			return { banner_hash: "worker-cache" };
		},
	};
	const { Caches } = await setENV("Biliverse", "ADBlock", database, KV);
	assert.deepEqual(requestedKeys, ["@Biliverse.ADBlock.Caches"]);
	assert.deepEqual(Caches, { banner_hash: "worker-cache" });
});

test("template Storage controls commercial blocking and log priority without using the persisted selector", async () => {
	const originalGetItem = Storage.getItem;
	const originalArgument = globalThis.$argument;
	const originalLogLevel = Console.logLevel;
	const originalDefaults = database.Default.Settings;
	Storage.getItem = () => ({ ADBlock: { Settings: { Storage: "Argument", Privacy: { BlockBiliCommercial: true }, LogLevel: "ERROR" } } });
	try {
		for (const [mode, blocked, logLevel] of [
			[undefined, true, "ERROR"],
			["PersistentStore", true, "ERROR"],
			["Argument", false, "OFF"],
			["database", false, "WARN"],
		]) {
			database.Default.Settings = structuredClone(originalDefaults);
			const request = { method: "POST", url: "https://cm.bilibili.com/cm/api/conversion/mobile/v2", headers: { "biliverse-args": `${mode ? `Storage=${mode}&` : ""}Privacy.BlockBiliCommercial=false&LogLevel=OFF` } };
			HonoWorkerAdapter.buildArgument(request);
			const { $response } = await Request(request);
			assert.equal($response?.status, blocked ? 200 : undefined, mode);
			if (blocked) assert.deepEqual(JSON.parse($response.body), { code: 0, message: "success" });
			assert.equal(Console.logLevel, logLevel, mode);
			assert.equal(globalThis.$argument.Storage, mode);
			assert.deepEqual(request.headers, {});
		}
	} finally {
		Storage.getItem = originalGetItem;
		globalThis.$argument = originalArgument;
		Console.logLevel = originalLogLevel;
		database.Default.Settings = originalDefaults;
	}
});

test("development response parses the Airborne request payload", async () => {
	HonoWorkerAdapter.buildArgument({
		url: "https://grpc.biliapi.net/bilibili.community.service.dm.v1.DM/DmSegMobile",
		headers: { "biliverse-args": "DM.Airborne=true&DM.Colorful=false&LogLevel=OFF" },
	});
	const requestBody = gRPC.encode(DmSegMobileReq.toBinary(DmSegMobileReq.create({ pid: "1", oid: "2", type: 2, segmentIndex: "1" })));
	const responseBody = gRPC.encode(DmSegMobileReply.toBinary(DmSegMobileReply.create({ elems: [], state: 0, colorfulSrc: [] })));
	const originalDecode = gRPC.decode;
	let decodeCount = 0;
	gRPC.decode = body => {
		decodeCount += 1;
		return originalDecode.call(gRPC, body);
	};
	try {
		await DevResponse({ method: "POST", url: "https://grpc.biliapi.net/bilibili.community.service.dm.v1.DM/DmSegMobile", headers: { "user-agent": "bili-universal/80000100" }, body: requestBody }, { status: 200, headers: { "content-type": "application/grpc" }, body: responseBody });
	} finally {
		gRPC.decode = originalDecode;
	}
	assert.equal(decodeCount, 2);
});
