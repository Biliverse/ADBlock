import gRPC from "@nsnanocat/grpc";
import { Console, fetch, Storage } from "@nsnanocat/util";
import { DmColorfulType, DmSegMobileReq } from "../protobuf/bilibili/community/service/dm/v1/dm.js";

const AIRBORNE_REQUEST_CACHE_PREFIX = "BiliBili.ADBlock.Airborne";

function getAirborneRequestCacheKey(requestId) {
	if (typeof requestId !== "string" || !requestId) return undefined;
	return `${AIRBORNE_REQUEST_CACHE_PREFIX}.${encodeURIComponent(requestId)}`;
}

function getBinaryRequestBody(request) {
	const body = request?.bodyBytes ?? request?.body;
	if (body instanceof Uint8Array) return body;
	if (body instanceof ArrayBuffer) return new Uint8Array(body);
	if (ArrayBuffer.isView(body)) return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
	return new Uint8Array();
}

/**
 * 在请求阶段解析并缓存空降助手所需参数。
 *
 * @param {{id?: string, body?: unknown, bodyBytes?: unknown}} request
 * @returns {void}
 */
export function cacheAirborneRequest(request) {
	const cacheKey = getAirborneRequestCacheKey(request?.id);
	const rawBody = getBinaryRequestBody(request);
	if (!cacheKey || !rawBody.length) {
		Console.warn("空降助手: Segment 请求参数未缓存");
		return;
	}
	try {
		const { oid, pid, type } = DmSegMobileReq.fromBinary(gRPC.decode(rawBody));
		if (Storage.setItem(cacheKey, { oid, pid, type })) Console.debug("空降助手: Segment 请求参数已缓存");
		else {
			Storage.removeItem(cacheKey);
			Console.warn("空降助手: Segment 请求参数缓存失败");
		}
	} catch (error) {
		Storage.removeItem(cacheKey);
		Console.error("空降助手: Segment 请求参数解析失败", error);
	}
}

/**
 * 获取当前响应对应的请求参数。缓存只允许消费一次，读取后必须删除。
 *
 * @param {{id?: string, body?: unknown, bodyBytes?: unknown}} request
 * @returns {{oid: string, pid: string, type: number}|undefined}
 */
export function takeAirborneRequest(request) {
	const cacheKey = getAirborneRequestCacheKey(request?.id);
	try {
		const rawBody = getBinaryRequestBody(request);
		if (rawBody.length) return DmSegMobileReq.fromBinary(gRPC.decode(rawBody));
		return cacheKey ? Storage.getItem(cacheKey, undefined) : undefined;
	} finally {
		// 该缓存仅用于关联同一次请求和响应，读取后必须立即删除。
		if (cacheKey) Storage.removeItem(cacheKey);
	}
}

/**
 * 根据稿件和分段信息生成空降助手弹幕。
 *
 * @param {string} pid 稿件 avid
 * @param {string} oid 视频 cid
 * @returns {Promise<object[]>}
 */
export async function getAirborneDanmaku(pid, oid) {
	const segments = await fetchSponsorBlock(toBvid(pid), oid);
	return createAirborneDanmaku(segments);
}

function toBvid(avid) {
	const XOR_CODE = 23442827791579n;
	const MAX_AID = 1n << 51n;
	const BASE = 58n;
	const data = "FcwAPNKTMug3GV5Lj7EJnHpWsx4tb8haYeviqBz6rkCy12mUSDQX9RdoZf";
	const bytes = ["B", "V", "1", "0", "0", "0", "0", "0", "0", "0", "0", "0"];
	let bvIndex = bytes.length - 1;
	let value = (MAX_AID | BigInt(avid)) ^ XOR_CODE;
	while (value > 0) {
		bytes[bvIndex] = data[Number(value % BASE)];
		value /= BASE;
		bvIndex -= 1;
	}
	[bytes[3], bytes[9]] = [bytes[9], bytes[3]];
	[bytes[4], bytes[7]] = [bytes[7], bytes[4]];
	return bytes.join("");
}

async function fetchSponsorBlock(videoId, cid) {
	try {
		const { status, body } = await getSkipSegments(videoId, cid);
		Console.debug("[SponsorBlock]", { videoId, status, body });
		if (status !== 200 || !body || body === "[]") return [];
		return parseSegments(body);
	} catch (error) {
		Console.info("[SponsorBlock]", error);
		return [];
	}
}

function getSkipSegments(videoId, cid = "") {
	cid = cid !== "0" ? cid : "";
	return fetch(`https://bsbsb.top/api/skipSegments?videoID=${videoId}&cid=${cid}&category=sponsor`, {
		headers: {
			origin: "https://github.com/kokoryh/Sparkle/blob/master/release/surge/module/bilibili.sgmodule",
			"x-ext-version": "1.0.0",
		},
		timeout: 3,
	});
}

function parseSegments(body) {
	return JSON.parse(body).reduce((segments, { actionType, segment }) => {
		if (actionType === "skip" && segment[1] - segment[0] >= 8) segments.push(segment);
		return segments;
	}, []);
}

function createAirborneDanmaku(segments) {
	const offset = 2000;
	return segments.map((segment, index) => {
		const id = String(index + 1);
		const start = Math.floor(segment[0] * 1000) + offset;
		const end = Math.floor(segment[1] * 1000);
		return {
			id,
			progress: start,
			mode: 5,
			fontsize: 50,
			color: 16777215,
			midHash: "1948dd5d",
			content: "空指部已就位",
			ctime: "1735660800",
			weight: 11,
			action: `airborne:${end}`,
			pool: 0,
			idStr: id,
			attr: 1310724,
			animation: "",
			// extra: "", // 当前精简 protobuf 未声明该字段，保留原值供协议补充时恢复。
			colorful: DmColorfulType.NoneType,
			type: 1,
			oid: "212364987",
			dmFrom: 1,
		};
	});
}
