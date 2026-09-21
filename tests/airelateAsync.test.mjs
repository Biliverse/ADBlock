import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { gzipSync } from "node:zlib";
import gRPC from "@nsnanocat/grpc";
import { BinaryWriter, WireType } from "@protobuf-ts/runtime";
import HonoWorkerAdapter from "../src/class/HonoWorkerAdapter.mjs";
import { Response } from "../src/process/Response.mjs";
import { Module } from "../src/protobuf/bilibili/app/viewunite/v1/viewunite.js";

const service = "bilibili.app.viewunite.v1.View";
const url = `https://grpc.biliapi.net/${service}/AIRelateAsync`;
const bytesField = (number, value) => new BinaryWriter().tag(number, WireType.LengthDelimited).bytes(value).finish();
const concat = (...parts) => Uint8Array.from(Buffer.concat(parts));

// Synthetic wire fixture: AIRelateAsync carries CM in field 1, recommendation
// modules in field 2, and other metadata in field 3. No captured user data.
const any = type => new BinaryWriter().tag(1, WireType.LengthDelimited).string(`type.googleapis.com/bilibili.ad.v1.${type}`).finish();
const cm = bytesField(1, concat(bytesField(2, any("AdsControlDto")), bytesField(5, bytesField(1, any("SourceContentDto")))));
const module = Module.toBinary(
	Module.create({
		type: 28,
		data: {
			oneofKind: "relates",
			relates: { cards: [{ relateCardType: 1 }, { relateCardType: 1 }, { relateCardType: 8 }] },
		},
	}),
);
const preserved = concat(bytesField(2, bytesField(1, module)), bytesField(3, new TextEncoder().encode("opaque metadata")), new BinaryWriter().tag(100, WireType.Varint).uint64("9007199254740993").finish());
const scalarField = (number, value) => new BinaryWriter().tag(number, WireType.Varint).int32(value).finish();
const opaque = bytesField(100, new TextEncoder().encode("undeclared data"));
const normalCard = concat(scalarField(1, 1), opaque, bytesField(12, opaque), bytesField(2, opaque));
const unmarkedCard = concat(scalarField(1, 8), opaque);
const futureCard = concat(scalarField(1, 99), opaque);
const adCards = [...[4, 5, 11].map(type => concat(scalarField(1, type), opaque)), concat(scalarField(1, 1), bytesField(11, new Uint8Array()), opaque), concat(scalarField(1, 8), bytesField(12, bytesField(6, new TextEncoder().encode("promotion"))), opaque)];
const recommendationModule = cards => concat(scalarField(1, 28), bytesField(22, concat(...cards.map(card => bytesField(1, card)), opaque)), opaque);
const recommendationReply = cards => concat(bytesField(2, concat(bytesField(1, recommendationModule(cards)), bytesField(1, concat(scalarField(1, 1), opaque)), bytesField(1, recommendationModule([unmarkedCard])), opaque)), bytesField(3, opaque), opaque);

function gzipFrame(payload) {
	const compressed = gzipSync(payload);
	const header = Buffer.alloc(5);
	header[0] = 1;
	header.writeUInt32BE(compressed.length, 1);
	return concat(header, compressed);
}

async function process(payload, { enabled = true, compressed = false } = {}) {
	HonoWorkerAdapter.buildArgument({ url, headers: { "biliverse-args": `View.AD=${enabled}&LogLevel=OFF` } });
	return Response(
		{ method: "POST", url, headers: { "user-agent": "grpc-c++/1 bili-universal/90000000", "x-bili-moss-engine-type": "1" } },
		{
			status: 200,
			// The original response can omit grpc-status. The iOS client needs it
			// after rewriting or it drops the entire reply, including recommendations.
			headers: { "content-type": "application/grpc", "grpc-encoding": "gzip" },
			body: compressed ? gzipFrame(payload) : gRPC.encode(payload),
		},
	);
}

test("AIRelateAsync removes CM and preserves ad-free recommendations, metadata and iOS gRPC status", async () => {
	for (const compressed of [false, true]) {
		const result = await process(concat(cm, preserved), { compressed });
		assert.deepEqual(gRPC.decode(result.body), preserved);
		assert.equal(result.headers["grpc-status"], "0");
	}
});

test("AIRelateAsync respects View.AD=false", async () => {
	const payload = concat(cm, preserved);
	const result = await process(payload, { enabled: false, compressed: true });
	assert.deepEqual(gRPC.decode(result.body), payload);
	assert.equal(result.headers["grpc-status"], "0");
});

test("AIRelateAsync preserves ad-free replies without CM", async () => {
	for (const payload of [preserved, new Uint8Array()]) {
		const result = await process(payload);
		assert.deepEqual(gRPC.decode(result.body), payload);
	}
});

test("AIRelateAsync filters recommendation ads while preserving ordinary card bytes and unknown metadata", async () => {
	for (const compressed of [false, true]) {
		for (const banner of [new Uint8Array(), cm]) {
			const payload = concat(banner, recommendationReply([normalCard, ...adCards, unmarkedCard, futureCard]));
			const result = await process(payload, { compressed });
			assert.deepEqual(gRPC.decode(result.body), recommendationReply([normalCard, unmarkedCard, futureCard]));
			assert.equal(result.headers["grpc-status"], "0");
		}
	}
});

test("AIRelateAsync preserves recommendation ads when View.AD=false", async () => {
	const payload = concat(cm, recommendationReply([normalCard, ...adCards]));
	const result = await process(payload, { enabled: false, compressed: true });
	assert.deepEqual(gRPC.decode(result.body), payload);
});

test("AIRelateAsync keeps recommendation modules and metadata when all cards are ads", async () => {
	const result = await process(recommendationReply(adCards));
	assert.deepEqual(gRPC.decode(result.body), recommendationReply([]));
});

test("AIRelateAsync leaves replies with no ads byte-identical", async () => {
	const payload = recommendationReply([normalCard, unmarkedCard, futureCard]);
	const result = await process(payload);
	assert.deepEqual(gRPC.decode(result.body), payload);
});

test("AIRelateAsync filters every recommendation module and preserves other module types", async () => {
	const otherModule = concat(scalarField(1, 99), bytesField(22, bytesField(1, adCards[0])), opaque);
	const payload = bytesField(2, concat(bytesField(1, recommendationModule([normalCard, adCards[0]])), bytesField(1, recommendationModule([adCards[1], unmarkedCard])), bytesField(1, otherModule)));
	const expected = bytesField(2, concat(bytesField(1, recommendationModule([normalCard])), bytesField(1, recommendationModule([unmarkedCard])), bytesField(1, otherModule)));
	const result = await process(payload);
	assert.deepEqual(gRPC.decode(result.body), expected);
});

test("playback response templates match AIRelateAsync without matching other services", async () => {
	for (const name of await readdir(new URL("../template/", import.meta.url))) {
		if (!name.endsWith(".handlebars") || name.includes("rewrite")) continue;
		const template = await readFile(new URL(`../template/${name}`, import.meta.url), "utf8");
		const line = template.split("\n").find(line => line.includes("viewunite"));
		assert.ok(line, name);
		const pattern = name.startsWith("stash") ? line.trim().slice("- match: ".length) : line.includes("pattern=") ? line.match(/pattern=([^,]+)/)[1] : line.startsWith("http-response ") ? line.split(" ")[1] : line.split(" ")[0];
		const matcher = new RegExp(pattern);
		for (const host of ["grpc.biliapi.net", "app.bilibili.com"]) {
			assert.ok(matcher.test(`https://${host}/${service}/AIRelateAsync`), name);
			assert.ok(matcher.test(`https://${host}/${service}/View`), name);
			assert.ok(matcher.test(`https://${host}/${service}/RelatesFeed`), name);
			assert.equal(matcher.test(`https://${host}/bilibili.app.view.v1.View/AIRelateAsync`), false, name);
			assert.equal(matcher.test(`https://${host}/${service}/AIRelateAsyncExtra`), false, name);
		}
	}
});

test("worker rewrite templates route AIRelateAsync through the shared response handler", async () => {
	for (const name of ["surge", "loon", "shadowrocket", "stash"]) {
		const template = await readFile(new URL(`../template/${name}.rewrite.handlebars`, import.meta.url), "utf8");
		const line = template.split("\n").find(line => line.includes("AIRelateAsync"));
		assert.ok(line, name);
		const pattern = name === "stash" ? line.trim().slice(2).split(" ")[0] : line.split(" ")[0];
		const matcher = new RegExp(pattern);
		for (const host of ["grpc.biliapi.net", "app.bilibili.com"]) {
			for (const query of ["", "?test=1"]) {
				const upstream = `https://${host}/${service}/AIRelateAsync${query}`;
				const match = upstream.match(matcher);
				assert.ok(match, name);
				const forwarded = new URL(`https://adblock.workers.dev/${match[1]}/${match[2]}`);
				const restored = HonoWorkerAdapter.routeRewrite(forwarded, forwarded.pathname.slice(1));
				assert.equal(restored.href, upstream, name);
			}
			assert.equal(matcher.test(`https://${host}/bilibili.app.view.v1.View/AIRelateAsync`), false, name);
			assert.equal(matcher.test(`https://${host}/${service}/AIRelateAsyncExtra`), false, name);
		}
	}
});
