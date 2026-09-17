import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import gRPC from "@nsnanocat/grpc";
import ADBlock from "../src/class/ADBlock.mjs";
import HonoWorkerAdapter from "../src/class/HonoWorkerAdapter.mjs";
import fixHeaders from "../src/function/fixHeaders.mjs";
import { Request } from "../src/process/Request.mjs";
import { Response as DevResponse } from "../src/process/Response.dev.mjs";
import { Response as ReleaseResponse } from "../src/process/Response.mjs";
import { DynAllPersonalReply, DynVideoReply } from "../src/protobuf/bilibili/app/dynamic/v2/dynamic.js";
import { FragmentType, PlayViewUniteReply } from "../src/protobuf/bilibili/app/playerunite/v1/playerunite.js";
import { PlayerRelatesReply, ViewProgressReply, RelatesFeedReply as ViewRelatesFeedReply, ViewReply } from "../src/protobuf/bilibili/app/view/v1/view.js";
import { ViewProgressReply as ViewUniteProgressReply } from "../src/protobuf/bilibili/app/viewunite/v1/viewprogress.js";
import { RelatesFeedReply as LocalViewUniteRelatesFeedReply, ViewReply as LocalViewUniteReply } from "../src/protobuf/bilibili/app/viewunite/v1/viewunite.js";
import { SubjectDescriptionReply } from "../src/protobuf/bilibili/main/community/reply/v2/reply.js";

test("local protobuf subsets preserve undeclared response fields", () => {
	const unknownField = Uint8Array.from([0xa0, 0x06, 0x07]); // field 100, varint 7
	assert.deepEqual(ViewReply.toBinary(ViewReply.fromBinary(unknownField)), unknownField);
});

test("fixHeaders tolerates missing headers and user-agent values", () => {
	assert.deepEqual(fixHeaders(), {});
	assert.deepEqual(fixHeaders({}, undefined), {});
	assert.deepEqual(fixHeaders({ "user-agent": "bili-blue/1" }, undefined), { "grpc-status": "0" });
	assert.deepEqual(fixHeaders({ "user-agent": "bili-inter/1" }, { "grpc-status": "0", keep: "yes" }), { keep: "yes" });
	assert.deepEqual(fixHeaders({ "user-agent": "bili-universal/1", "x-bili-moss-engine-type": "1" }, null), { "grpc-status": "0" });
});

test("ADBlock centralizes search ad and tracking cleanup", () => {
	const adBlock = new ADBlock();
	const json = {
		track_id: "track",
		url: "https://example.com/video?spm_id_from=feed&foo=bar",
	};
	const search = {
		data: [{ type: "trending" }, { type: "history" }],
		trackId: "track",
		jumpUrl: "https://example.com/video?trackid=1&foo=bar",
	};

	assert.equal(adBlock.cleanTracking(json), 2);
	assert.equal(json.track_id, undefined);
	assert.equal(json.url, "https://example.com/video?foo=bar");
	assert.equal(adBlock.cleanTracking(search, "Search"), 2);
	assert.equal(search.trackId, "");
	assert.equal(search.jumpUrl, "https://example.com/video?foo=bar");
});

test("returns a minimal valid gRPC response for DefaultWords", async () => {
	for (const hostname of ["grpc.biliapi.net", "app.biliapi.net", "app.bilibili.com", "app.biliapi.com"]) {
		const url = `https://${hostname}/bilibili.app.interface.v1.Search/DefaultWords`;
		HonoWorkerAdapter.buildArgument({ url, headers: { "biliverse-args": "LogLevel=OFF" } });
		const { $response } = await Request({
			method: "GET",
			url,
			headers: { "user-agent": "bili-universal/80000100" },
		});

		assert.equal($response.status, 200);
		assert.equal($response.headers["Content-Type"], "application/grpc");
		assert.equal($response.headers["Content-Length"], "5");
		assert.deepEqual([...$response.body], [0, 0, 0, 0, 0]);
	}
});

test("returns a local success response for blocked Bilibili commercial reports", async () => {
	HonoWorkerAdapter.buildArgument({
		url: "https://cm.bilibili.com/cm/api/conversion/mobile/v2",
		headers: { "biliverse-args": "Privacy.BlockBiliCommercial=true&LogLevel=OFF" },
	});
	const { $response } = await Request({
		method: "POST",
		url: "https://cm.bilibili.com/cm/api/conversion/mobile/v2",
		headers: { "content-type": "application/json" },
	});

	assert.equal($response.status, 200);
	assert.deepEqual(JSON.parse($response.body), { code: 0, message: "success" });
});

test("filters personal dynamic advertising cards with the local protobuf binding", async () => {
	HonoWorkerAdapter.buildArgument({
		url: "https://grpc.biliapi.net/bilibili.app.dynamic.v2.Dynamic/DynAllPersonal",
		headers: { "biliverse-args": "Dynamic.PersonalAdCard=true&LogLevel=OFF" },
	});
	const responseBody = gRPC.encode(
		DynAllPersonalReply.toBinary(
			DynAllPersonalReply.create({
				list: [{ cardType: 15 }, { cardType: 8 }],
			}),
		),
	);
	const result = await DevResponse(
		{
			method: "POST",
			url: "https://grpc.biliapi.net/bilibili.app.dynamic.v2.Dynamic/DynAllPersonal",
			headers: { "user-agent": "bili-universal/80000100" },
		},
		{ status: 200, headers: { "content-type": "application/grpc" }, body: responseBody },
	);
	const decoded = DynAllPersonalReply.fromBinary(gRPC.decode(result.body));

	assert.deepEqual(
		decoded.list.map(item => item.cardType),
		[8],
	);
});

test("filters advertising cards from the dynamic video feed", async () => {
	HonoWorkerAdapter.buildArgument({
		url: "https://grpc.biliapi.net/bilibili.app.dynamic.v2.Dynamic/DynVideo",
		headers: { "biliverse-args": "Dynamic.AdCard=true&LogLevel=OFF" },
	});
	const responseBody = gRPC.encode(
		DynVideoReply.toBinary(
			DynVideoReply.create({
				dynamicList: { list: [{ cardType: 15 }, { cardType: 8 }] },
			}),
		),
	);
	const result = await DevResponse(
		{
			method: "POST",
			url: "https://grpc.biliapi.net/bilibili.app.dynamic.v2.Dynamic/DynVideo",
			headers: { "user-agent": "bili-universal/80000100" },
		},
		{ status: 200, headers: { "content-type": "application/grpc" }, body: responseBody },
	);
	const decoded = DynVideoReply.fromBinary(gRPC.decode(result.body));

	assert.deepEqual(
		decoded.dynamicList.list.map(item => item.cardType),
		[8],
	);
});

test("filters legacy playback-related advertising cards", async () => {
	for (const [method, ReplyType] of [
		["RelatesFeed", ViewRelatesFeedReply],
		["PlayerRelates", PlayerRelatesReply],
	]) {
		const url = `https://grpc.biliapi.net/bilibili.app.view.v1.View/${method}`;
		HonoWorkerAdapter.buildArgument({
			url,
			headers: { "biliverse-args": "View.AD=true&LogLevel=OFF" },
		});
		const responseBody = gRPC.encode(
			ReplyType.toBinary(
				ReplyType.create({
					list: [
						{ title: "normal", goto: "av" },
						{ title: "cm", goto: "cm" },
						{ title: "game", goto: "game" },
						{ title: "cm-field", goto: "av", cm: {} },
						{ title: "unique-id", goto: "av", uniqueId: "ad-material" },
					],
				}),
			),
		);
		const result = await DevResponse({ method: "POST", url, headers: { "user-agent": "bili-universal/80000100" } }, { status: 200, headers: { "content-type": "application/grpc" }, body: responseBody });
		const decoded = ReplyType.fromBinary(gRPC.decode(result.body));

		assert.deepEqual(
			decoded.list.map(item => item.title),
			["normal"],
		);
	}
});

test("clears legacy playback-page advertising fields", async () => {
	const url = "https://grpc.biliapi.net/bilibili.app.view.v1.View/View";
	HonoWorkerAdapter.buildArgument({
		url,
		headers: { "biliverse-args": "View.AD=true&LogLevel=OFF" },
	});
	const responseBody = gRPC.encode(
		ViewReply.toBinary(
			ViewReply.create({
				cms: [{}],
				cmConfig: {},
				cmIpad: {},
				cmUnderPlayer: {},
				tab: { otype: 3 },
				relates: [
					{ title: "normal", goto: "av" },
					{ title: "cm", goto: "cm" },
				],
			}),
		),
	);
	const result = await DevResponse({ method: "POST", url, headers: { "user-agent": "bili-universal/80000100" } }, { status: 200, headers: { "content-type": "application/grpc" }, body: responseBody });
	const decoded = ViewReply.fromBinary(gRPC.decode(result.body));

	assert.deepEqual(decoded.cms, []);
	assert.equal(decoded.cmConfig, undefined);
	assert.equal(decoded.cmIpad, undefined);
	assert.equal(decoded.cmUnderPlayer, undefined);
	assert.equal(decoded.tab, undefined);
	assert.deepEqual(
		decoded.relates.map(item => item.title),
		["normal"],
	);
});

test("local unified-view protobuf filters responses without losing unrelated fields", async () => {
	const unknownField = Uint8Array.from([0xa0, 0x06, 0x07]);
	const viewUrl = "https://grpc.biliapi.net/bilibili.app.viewunite.v1.View/View";
	HonoWorkerAdapter.buildArgument({ url: viewUrl, headers: { "biliverse-args": "View.AD=true&LogLevel=OFF" } });
	const viewPayload = LocalViewUniteReply.toBinary(
		LocalViewUniteReply.create({
			cm: {},
			tab: {
				tabModule: [
					{
						tab: {
							oneofKind: "introduction",
							introduction: {
								modules: [
									{
										type: 28,
										data: {
											oneofKind: "relates",
											relates: { cards: [{ relateCardType: 1 }, { relateCardType: 5 }] },
										},
									},
									{ type: 55 },
									{ type: 1 },
								],
							},
						},
					},
				],
			},
		}),
	);
	const viewResult = await DevResponse({ method: "POST", url: viewUrl, headers: { "user-agent": "bili-universal/80000100" } }, { status: 200, headers: { "content-type": "application/grpc" }, body: gRPC.encode(Uint8Array.from([...viewPayload, ...unknownField])) });
	const viewResultPayload = gRPC.decode(viewResult.body);
	const decodedView = LocalViewUniteReply.fromBinary(viewResultPayload);
	const modules = decodedView.tab.tabModule[0].tab.introduction.modules;
	assert.equal(decodedView.cm, undefined);
	assert.deepEqual(
		modules.map(module => module.type),
		[28, 1],
	);
	assert.deepEqual(
		modules[0].data.relates.cards.map(card => card.relateCardType),
		[1],
	);
	assert.deepEqual([...viewResultPayload.slice(-unknownField.length)], [...unknownField]);

	const relatesUrl = "https://grpc.biliapi.net/bilibili.app.viewunite.v1.View/RelatesFeed";
	HonoWorkerAdapter.buildArgument({ url: relatesUrl, headers: { "biliverse-args": "View.AD=true&LogLevel=OFF" } });
	const relatesPayload = LocalViewUniteRelatesFeedReply.toBinary(LocalViewUniteRelatesFeedReply.create({ relates: [{ relateCardType: 1 }, { relateCardType: 4 }, { relateCardType: 1, cmStock: {} }] }));
	const relatesResult = await DevResponse({ method: "POST", url: relatesUrl, headers: { "user-agent": "bili-universal/80000100" } }, { status: 200, headers: { "content-type": "application/grpc" }, body: gRPC.encode(relatesPayload) });
	assert.deepEqual(
		LocalViewUniteRelatesFeedReply.fromBinary(gRPC.decode(relatesResult.body)).relates.map(card => card.relateCardType),
		[1],
	);
});

test("returns an empty gRPC message for pause and end-page ads only when View.AD is enabled", async () => {
	const originalPayload = Uint8Array.from([0x08, 0x01]);
	for (const method of ["PlayPause", "ViewEndPage"]) {
		const url = `https://grpc.biliapi.net/bilibili.app.viewunite.v1.View/${method}`;
		for (const [enabled, expected] of [
			[true, []],
			[false, [...originalPayload]],
		]) {
			HonoWorkerAdapter.buildArgument({
				url,
				headers: { "biliverse-args": `View.AD=${enabled}&LogLevel=OFF` },
			});
			const result = await DevResponse({ method: "POST", url, headers: { "user-agent": "bili-universal/80000100", "x-bili-moss-engine-type": "1" } }, { status: 200, headers: { "content-type": "application/grpc" }, body: gRPC.encode(originalPayload) });

			assert.deepEqual([...gRPC.decode(result.body)], expected);
			assert.equal(result.headers["grpc-status"], "0");
		}
	}
});

test("blocks playback-page advertising materials only when View.AD is enabled", async () => {
	const url = "https://api.bilibili.com/x/vip/ads/materials?position=52";
	const original = { code: 0, message: "success", data: { materials: [{ id: 1 }] } };
	for (const enabled of [true, false]) {
		HonoWorkerAdapter.buildArgument({
			url,
			headers: { "biliverse-args": `View.AD=${enabled}&LogLevel=OFF` },
		});
		const result = await DevResponse({ method: "GET", url, headers: { "user-agent": "bili-universal/80000100" } }, { status: 200, headers: { "content-type": "application/json" }, body: JSON.stringify(original) });
		assert.deepEqual(JSON.parse(result.body), enabled ? { code: -404, message: "-404", ttl: 1, data: null } : original);
	}
});

test("release and development handlers agree on the new playback-ad routes", async () => {
	const cases = [
		{
			url: "https://api.bilibili.com/x/vip/ads/materials?position=52",
			response: { status: 200, headers: { "content-type": "application/json" }, body: JSON.stringify({ code: 0, data: { materials: [{}] } }) },
		},
		{
			url: "https://grpc.biliapi.net/bilibili.app.viewunite.v1.View/PlayPause",
			response: { status: 200, headers: { "content-type": "application/grpc" }, body: gRPC.encode(Uint8Array.from([0x08, 0x01])) },
		},
	];
	for (const { url, response } of cases) {
		const results = [];
		for (const handler of [ReleaseResponse, DevResponse]) {
			HonoWorkerAdapter.buildArgument({
				url,
				headers: { "biliverse-args": "View.AD=true&LogLevel=OFF" },
			});
			results.push(await handler({ method: "GET", url, headers: { "user-agent": "bili-universal/80000100" } }, structuredClone(response)));
		}
		assert.deepEqual(results[0], results[1]);
	}
});

test("filters explicit ad fragments and the promotional prompt from PlayViewUnite", async () => {
	const url = "https://grpc.biliapi.net/bilibili.app.playerunite.v1.Player/PlayViewUnite";
	HonoWorkerAdapter.buildArgument({
		url,
		headers: { "biliverse-args": "View.AD=true&LogLevel=OFF" },
	});
	const unknownField = Uint8Array.from([0xa0, 0x06, 0x07]);
	const payload = PlayViewUniteReply.toBinary(
		PlayViewUniteReply.create({
			viewInfo: { promptBar: {} },
			fragmentVideo: {
				videos: [{ fragmentInfo: { index: 1, fragmentType: FragmentType.AD_FRAGMENT } }, { fragmentInfo: { index: 2, fragmentType: FragmentType.OGV_FRAGMENT } }, {}],
			},
		}),
	);
	const result = await DevResponse({ method: "POST", url, headers: { "user-agent": "bili-universal/80000100" } }, { status: 200, headers: { "content-type": "application/grpc" }, body: gRPC.encode(Uint8Array.from([...payload, ...unknownField])) });
	const resultPayload = gRPC.decode(result.body);
	const decoded = PlayViewUniteReply.fromBinary(resultPayload);

	assert.equal(decoded.viewInfo?.promptBar, undefined);
	assert.deepEqual(
		decoded.fragmentVideo.videos.map(item => item.fragmentInfo?.fragmentType),
		[FragmentType.OGV_FRAGMENT, undefined],
	);
	assert.deepEqual([...resultPayload.slice(-unknownField.length)], [...unknownField]);
});

test("preserves PlayViewUnite ads when View.AD is disabled", async () => {
	const url = "https://grpc.biliapi.net/bilibili.app.playerunite.v1.Player/PlayViewUnite";
	HonoWorkerAdapter.buildArgument({
		url,
		headers: { "biliverse-args": "View.AD=false&LogLevel=OFF" },
	});
	const payload = PlayViewUniteReply.toBinary(
		PlayViewUniteReply.create({
			viewInfo: { promptBar: {} },
			fragmentVideo: { videos: [{ fragmentInfo: { fragmentType: FragmentType.AD_FRAGMENT } }] },
		}),
	);
	const result = await DevResponse({ method: "POST", url, headers: { "user-agent": "bili-universal/80000100" } }, { status: 200, headers: { "content-type": "application/grpc" }, body: gRPC.encode(payload) });

	assert.deepEqual([...gRPC.decode(result.body)], [...payload]);
});

test("removes playback-process promotional guides without deleting unrelated fields", async () => {
	const unknownField = Uint8Array.from([0xa0, 0x06, 0x07]);
	for (const [service, ReplyType, value, verify] of [
		["bilibili.app.view.v1.View", ViewProgressReply, { videoGuide: {} }, decoded => assert.equal(decoded.videoGuide, undefined)],
		[
			"bilibili.app.viewunite.v1.View",
			ViewUniteProgressReply,
			{
				videoGuide: {
					material: [{ text: "promotion", url: "https://example.com/ad" }],
					videoPoint: { pointPermanent: true },
					contractCard: { playDisplaySwitch: true },
				},
				arcShot: { pvData: "keep" },
			},
			decoded => {
				assert.deepEqual(decoded.videoGuide.material, []);
				assert.equal(decoded.videoGuide.videoPoint?.pointPermanent, true);
				assert.equal(decoded.videoGuide.contractCard?.playDisplaySwitch, true);
				assert.equal(decoded.arcShot?.pvData, "keep");
			},
		],
	]) {
		const url = `https://grpc.biliapi.net/${service}/ViewProgress`;
		HonoWorkerAdapter.buildArgument({
			url,
			headers: { "biliverse-args": "View.AD=true&LogLevel=OFF" },
		});
		const payload = ReplyType.toBinary(ReplyType.create(value));
		const framedPayload = Uint8Array.from([...payload, ...unknownField]);
		const result = await DevResponse({ method: "POST", url, headers: { "user-agent": "bili-universal/80000100" } }, { status: 200, headers: { "content-type": "application/grpc" }, body: gRPC.encode(framedPayload) });
		const resultPayload = gRPC.decode(result.body);
		verify(ReplyType.fromBinary(resultPayload));
		assert.deepEqual([...resultPayload.slice(-unknownField.length)], [...unknownField]);

		HonoWorkerAdapter.buildArgument({
			url,
			headers: { "biliverse-args": "View.AD=false&LogLevel=OFF" },
		});
		const disabledResult = await DevResponse({ method: "POST", url, headers: { "user-agent": "bili-universal/80000100" } }, { status: 200, headers: { "content-type": "application/grpc" }, body: gRPC.encode(framedPayload) });
		assert.deepEqual([...gRPC.decode(disabledResult.body)], [...framedPayload]);
	}
});

test("keeps every client template and the BoxJS control synchronized", async () => {
	const templates = [
		"loon.dev.handlebars",
		"loon.handlebars",
		"loon.rewrite.handlebars",
		"quantumultx.dev.handlebars",
		"quantumultx.handlebars",
		"shadowrocket.handlebars",
		"shadowrocket.rewrite.handlebars",
		"stash.dev.handlebars",
		"stash.handlebars",
		"stash.rewrite.handlebars",
		"surge.dev.handlebars",
		"surge.handlebars",
		"surge.rewrite.handlebars",
	];
	for (const template of templates) {
		const content = await readFile(new URL(`../template/${template}`, import.meta.url), "utf8");
		for (const token of ["PlayPause", "ViewEndPage", "ViewProgress", "PlayViewUnite", "vip\\/ads\\/materials"]) assert.match(content, new RegExp(token.replaceAll("/", "\\/")), template);
	}

	const boxjs = JSON.parse(await readFile(new URL("../template/boxjs.settings.json", import.meta.url), "utf8"));
	const controls = boxjs.filter(item => item.id === "@Biliverse.ADBlock.Settings.View.AD");
	assert.equal(controls.length, 1);
	assert.equal(controls[0].val, true);
	assert.equal(controls[0].desc, "是否启用此处修改");
});

test("filters commercial Reply v2 editor buttons with the local protobuf binding", async () => {
	HonoWorkerAdapter.buildArgument({
		url: "https://grpc.biliapi.net/bilibili.main.community.reply.v2.Reply/SubjectDescription",
		headers: { "biliverse-args": "Reply.SubjectDescriptionCommercial=true&LogLevel=OFF" },
	});
	const responseBody = gRPC.encode(
		SubjectDescriptionReply.toBinary(
			SubjectDescriptionReply.create({
				input: {
					funcButtons: {
						buttons: [
							{ type: 5, name: "goods" },
							{ type: 8, name: "assistant" },
							{ type: 1, name: "screenshot" },
						],
					},
				},
			}),
		),
	);
	const result = await DevResponse(
		{
			method: "POST",
			url: "https://grpc.biliapi.net/bilibili.main.community.reply.v2.Reply/SubjectDescription",
			headers: { "user-agent": "bili-universal/80000100" },
		},
		{ status: 200, headers: { "content-type": "application/grpc" }, body: responseBody },
	);
	const decoded = SubjectDescriptionReply.fromBinary(gRPC.decode(result.body));

	assert.deepEqual(
		decoded.input.funcButtons.buttons.map(button => button.type),
		[1],
	);
});
