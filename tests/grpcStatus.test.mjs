import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { AIRelateReply } from "@biliverse/protobuf/bilibili/app/viewunite/v1/airelate.js";
import { MainListReply } from "@biliverse/protobuf/bilibili/main/community/reply/v1/reply.js";
import gRPC from "@nsnanocat/grpc";
import { Console } from "@nsnanocat/util";
import HonoWorkerAdapter from "../src/class/HonoWorkerAdapter.mjs";
import fixHeaders from "../src/function/fixHeaders.mjs";
import { Request } from "../src/process/Request.mjs";
import { Response } from "../src/process/Response.mjs";

Console.logLevel = "OFF";
const clients = ["bili-universal", "bili-hd2", "bili-overseas", "bili-blue", "bili-inter", "unknown"];
const url = "https://grpc.biliapi.net/bilibili.app.viewunite.v1.View/AIRelateAsync";
const unknown = Uint8Array.from([0xa0, 0x06, 0x07]);
const recommendations = AIRelateReply.create({ tab: { modules: [{ type: 28, data: { oneofKind: "relates", relates: { cards: [{ relateCardType: 1 }] } } }] } });
const comments = MainListReply.create({ replies: [{ id: "42", content: { message: "normal comment" } }] });
const fixtures = [
	{ url, payload: Uint8Array.from([...AIRelateReply.toBinary(AIRelateReply.create({ ...recommendations, cm: {} })), ...unknown]), expected: Uint8Array.from([...AIRelateReply.toBinary(recommendations), ...unknown]) },
	{
		url: "https://grpc.biliapi.net/bilibili.main.community.reply.v1.Reply/MainList",
		payload: Uint8Array.from([...MainListReply.toBinary(MainListReply.create({ ...comments, cm: {} })), ...unknown]),
		expected: Uint8Array.from([...MainListReply.toBinary(comments), ...unknown]),
	},
];

test("Surge DefaultWords mocks return a complete empty gRPC response", async () => {
	for (const name of ["surge.handlebars", "surge.dev.handlebars"]) {
		const template = await readFile(new URL(`../template/${name}`, import.meta.url), "utf8");
		const rule = template.split("\n").find(line => line.startsWith("^") && line.includes("DefaultWords"));
		const [, pattern, data, status, header] = rule.match(/^(.*?) data-type=base64 data="([^"]+)" status-code=(\d+) header="([^"]+)"$/);
		const headers = Object.fromEntries(header.split("|").map(field => field.split(":")));
		const body = Buffer.from(data, "base64");
		for (const hostname of ["grpc.biliapi.net", "app.biliapi.net", "app.bilibili.com", "app.biliapi.com"]) {
			assert.match(`https://${hostname}/bilibili.app.interface.v1.Search/DefaultWords`, new RegExp(pattern));
		}
		assert.equal(status, "200");
		assert.equal(headers["Content-Type"], "application/grpc");
		assert.equal(Number(headers["Content-Length"]), body.byteLength);
		assert.deepEqual([...body], [0, 0, 0, 0, 0]);
		assert.equal(headers["grpc-status"], "0", name);
		assert.equal(gRPC.decode(body).byteLength, 0);
	}
});

test("gRPC completion follows the client and Moss engine without overwriting existing status", () => {
	for (const client of clients) {
		for (const moss of ["1", "0", undefined]) {
			for (const status of [undefined, "0", "7", "16"]) {
				for (const capitalized of [false, true]) {
					const request = { [capitalized ? "User-Agent" : "user-agent"]: `grpc-c++/1 ${client}/90000000` };
					if (moss !== undefined) request[capitalized ? "X-Bili-Moss-Engine-Type" : "x-bili-moss-engine-type"] = moss;
					const statusKey = capitalized ? "Grpc-Status" : "grpc-status";
					const headers = { keep: "yes" };
					if (status !== undefined) headers[statusKey] = status;
					const expected = { ...headers };
					const requiresStatus = client === "bili-blue" || (["bili-universal", "bili-hd2", "bili-overseas"].includes(client) && moss === "1");
					if (status === undefined && requiresStatus) expected[statusKey] = "0";
					if (client === "bili-blue") expected[capitalized ? "grpc-status" : "Grpc-Status"] = "0";
					if (client === "bili-inter" && status === "0") delete expected[statusKey];
					assert.deepEqual(fixHeaders(request, headers), expected, JSON.stringify({ client, moss, status, capitalized }));
				}
			}
		}
	}
});

test("lowercase and capitalized metadata are read and updated independently", () => {
	assert.deepEqual(fixHeaders({ "User-Agent": "bili-hd2/1", "X-Bili-Moss-Engine-Type": "0", "x-bili-moss-engine-type": "1" }, {}), { "grpc-status": "0" });
	assert.deepEqual(fixHeaders({ "User-Agent": "bili-hd2/1", "X-Bili-Moss-Engine-Type": "1", "x-bili-moss-engine-type": "0" }, {}), { "Grpc-Status": "0" });
	assert.deepEqual(fixHeaders({ "User-Agent": "bili-inter/1" }, { "Grpc-Status": "7", "grpc-status": "0" }), { "Grpc-Status": "7" });
	assert.deepEqual(fixHeaders({ "User-Agent": "bili-inter/1" }, { "Grpc-Status": "0", "grpc-status": "16" }), { "grpc-status": "16" });
	assert.deepEqual(fixHeaders({ "User-Agent": "bili-hd2/1", "X-Bili-Moss-Engine-Type": "1", "x-bili-moss-engine-type": "1" }, { "Grpc-Status": "7", "grpc-status": "16" }), { "Grpc-Status": "7", "grpc-status": "16" });
});

test("phone, HD and overseas rewrites complete while retaining recommendations, comments and unknown fields", async () => {
	for (const fixture of fixtures) {
		for (const client of ["bili-universal", "bili-hd2", "bili-overseas"]) {
			for (const compressed of [false, true]) {
				HonoWorkerAdapter.buildArgument({ url: fixture.url, headers: { "biliverse-args": "View.AD=true&Reply.AD=true&LogLevel=OFF" } });
				const result = await Response(
					{ method: "POST", url: fixture.url, headers: { "User-Agent": `grpc-c++/1 ${client}/90000000`, "X-Bili-Moss-Engine-Type": "1" } },
					{ status: 200, headers: { "content-type": "application/grpc", "grpc-encoding": compressed ? "gzip" : "identity" }, body: gRPC.encode(fixture.payload, compressed ? "gzip" : "identity") },
				);
				assert.deepEqual(gRPC.decode(result.body), fixture.expected);
				assert.equal(result.headers["Grpc-Status"], "0");
			}
		}
	}
});

test("DefaultWords returns the complete empty response for each client and Moss engine", async () => {
	for (const hostname of ["grpc.biliapi.net", "app.biliapi.net", "app.bilibili.com", "app.biliapi.com"]) {
		const searchUrl = `https://${hostname}/bilibili.app.interface.v1.Search/DefaultWords`;
		for (const client of clients) {
			for (const moss of ["1", "0", undefined]) {
				HonoWorkerAdapter.buildArgument({ url: searchUrl, headers: { "biliverse-args": "LogLevel=OFF" } });
				const headers = { "user-agent": `grpc-c++/1 ${client}/90000000` };
				if (moss !== undefined) headers["x-bili-moss-engine-type"] = moss;
				const { $response } = await Request({ method: "POST", url: searchUrl, headers });
				assert.equal($response.status, 200);
				assert.equal($response.headers["Content-Type"], "application/grpc");
				assert.equal($response.headers["Content-Length"], "5");
				assert.deepEqual([...$response.body], [0, 0, 0, 0, 0]);
				assert.equal($response.headers["grpc-status"], "0");
			}
		}
	}
});
